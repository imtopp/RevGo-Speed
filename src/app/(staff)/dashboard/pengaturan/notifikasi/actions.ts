"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrSysAdmin, assertActiveUser } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import {
  kumpulkanTemplateDariForm,
  NOTIF_TEMPLATES_KEY,
} from "@/lib/notif-template";
import { revalidatePath } from "next/cache";
import {
  buatTokenJemput,
  muatTelegramConfig,
  putuskanChat,
  simpanTelegramConfig,
  TELEGRAM_CONFIG_KEY,
  telegramEnabled,
  telegramGetMe,
  telegramSetWebhook,
  urlJemput,
  webhookUrlTelegram,
} from "@/lib/telegram";

export type TemplateState = {
  error?: string;
  success?: string;
  link?: string;
};

async function requireOwnerOrSysAdminAction() {
  const session = await auth();
  if (!session?.user || !isOwnerOrSysAdmin(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  await assertActiveUser(session.user.id);
  return session;
}

export async function updateNotifTemplates(
  _prev: TemplateState,
  formData: FormData,
): Promise<TemplateState> {
  const session = await requireOwnerOrSysAdminAction();
  const { overrides, error } = kumpulkanTemplateDariForm(formData);
  if (error) return { error };

  const value = JSON.stringify(overrides);
  const prev = await prisma.systemSetting.findUnique({
    where: { key: NOTIF_TEMPLATES_KEY },
  });

  await prisma.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key: NOTIF_TEMPLATES_KEY },
      update: { value, updatedBy: session.user.id },
      create: { key: NOTIF_TEMPLATES_KEY, value, updatedBy: session.user.id },
    });
    await logAudit(tx, session.user, {
      action: "SETTING_UPDATE",
      entityType: "SystemSetting",
      entityId: NOTIF_TEMPLATES_KEY,
      summary: "Template notifikasi diubah",
      before: prev ? { value: prev.value } : undefined,
      after: { value },
    });
  });

  revalidatePath("/dashboard/pengaturan/notifikasi");
  return { success: "Template notifikasi tersimpan." };
}

export async function resetNotifTemplates(): Promise<TemplateState> {
  const session = await requireOwnerOrSysAdminAction();
  const prev = await prisma.systemSetting.findUnique({
    where: { key: NOTIF_TEMPLATES_KEY },
  });
  if (!prev) {
    return { success: "Template sudah memakai default." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.systemSetting.delete({ where: { key: NOTIF_TEMPLATES_KEY } });
    await logAudit(tx, session.user, {
      action: "SETTING_UPDATE",
      entityType: "SystemSetting",
      entityId: NOTIF_TEMPLATES_KEY,
      summary: "Template notifikasi dikembalikan ke default",
      before: { value: prev.value },
      after: {},
    });
  });

  revalidatePath("/dashboard/pengaturan/notifikasi");
  return { success: "Semua template dikembalikan ke default." };
}

export async function aktifkanTelegramWebhook(): Promise<TemplateState> {
  const session = await requireOwnerOrSysAdminAction();
  if (!telegramEnabled()) {
    return { error: "Env TELEGRAM_BOT_TOKEN belum diatur di Vercel." };
  }
  const url = webhookUrlTelegram();
  if (!url) {
    return {
      error:
        "AUTH_URL belum diatur — webhook butuh URL publik (set AUTH_URL di Vercel).",
    };
  }
  const me = await telegramGetMe();
  if (!me) {
    return {
      error: "Token TELEGRAM_BOT_TOKEN tidak valid — cek lagi di @BotFather.",
    };
  }

  const prev = await muatTelegramConfig();
  const secret = prev.webhookSecret ?? buatTokenJemput();
  const ok = await telegramSetWebhook(url, secret);
  if (!ok) {
    return { error: "Gagal mengatur webhook di Telegram — coba lagi." };
  }
  const next = {
    ...prev,
    webhookSecret: secret,
    botUsername: me.username,
  };

  await prisma.$transaction(async (tx) => {
    await simpanTelegramConfig(next, session.user.id, tx);
    await logAudit(tx, session.user, {
      action: "SETTING_UPDATE",
      entityType: "SystemSetting",
      entityId: TELEGRAM_CONFIG_KEY,
      summary: `Webhook Telegram diaktifkan (@${me.username})`,
      before: prev.webhookSecret ? { webhook: "aktif" } : { webhook: "mati" },
      after: { webhook: "aktif", botUsername: me.username },
    });
  });

  revalidatePath("/dashboard/pengaturan/notifikasi");
  return { success: `Webhook aktif untuk @${me.username} → ${url}` };
}

export async function buatLinkHubungkanTelegram(): Promise<TemplateState> {
  const session = await requireOwnerOrSysAdminAction();
  if (!telegramEnabled()) {
    return { error: "Env TELEGRAM_BOT_TOKEN belum diatur di Vercel." };
  }
  const config = await muatTelegramConfig();
  if (!config.webhookSecret) {
    return { error: "Aktifkan webhook dulu sebelum menghubungkan akun." };
  }
  const me = config.botUsername
    ? { username: config.botUsername }
    : await telegramGetMe();
  if (!me) {
    return {
      error: "Token TELEGRAM_BOT_TOKEN tidak valid — cek lagi di @BotFather.",
    };
  }

  const token = buatTokenJemput();
  const tokens: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.tokens)) {
    if (v !== session.user.id) tokens[k] = v; // token lama user ini dibuang
  }
  tokens[token] = session.user.id;
  const next = { ...config, botUsername: me.username, tokens };

  await simpanTelegramConfig(next, session.user.id);
  revalidatePath("/dashboard/pengaturan/notifikasi");
  return {
    success: "Buka link di bawah ini, lalu tap Start di bot Telegram.",
    link: urlJemput(me.username, token),
  };
}

export async function putuskanTelegramSaya(): Promise<TemplateState> {
  const session = await requireOwnerOrSysAdminAction();
  const prev = await muatTelegramConfig();
  if (!prev.chats[session.user.id]) {
    return { error: "Akun Telegram Anda belum terhubung." };
  }
  const next = putuskanChat(prev, session.user.id);

  await prisma.$transaction(async (tx) => {
    await simpanTelegramConfig(next, session.user.id, tx);
    await logAudit(tx, session.user, {
      action: "SETTING_UPDATE",
      entityType: "SystemSetting",
      entityId: TELEGRAM_CONFIG_KEY,
      summary: "Akun Telegram diputus dari notifikasi staf",
      before: { chats: prev.chats },
      after: { chats: next.chats },
    });
  });

  revalidatePath("/dashboard/pengaturan/notifikasi");
  return { success: "Akun Telegram Anda diputus." };
}
