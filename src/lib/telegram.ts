/**
 * Telegram Bot — channel cadangan notifikasi STAF (booking baru & stok
 * menipis), gratis & andal di HP agresif (push native app Telegram).
 *
 * ATURAN:
 * - Fitur MATI SENYAP tanpa env `TELEGRAM_BOT_TOKEN` (instance tanpa env
 *   aman — mis. sebelum bot dibuat).
 * - Config disimpan di SystemSetting `telegram_config` (JSON):
 *   botUsername, webhookSecret, chats (userId → chatId), tokens
 *   (token jemput satu-pakai → userId).
 * - Alur hubungkan: user tap link `t.me/<bot>?start=<token>` → bot terima
 *   `/start <token>` di webhook → chatId diikat ke userId (token dibuang).
 * - Kirim via Bot API `sendMessage` (plain text + tombol "Buka") — setiap
 *   percobaan dibungkus try/catch, gagal = no-op (tidak pernah menjatuhkan
 *   aksi bisnis).
 */

import type { Prisma, PrismaClient } from "@db/prisma/client";
import { prisma } from "@/lib/prisma";

export const TELEGRAM_CONFIG_KEY = "telegram_config";

export type TelegramConfig = {
  botUsername?: string;
  webhookSecret?: string;
  /** userId → chatId (akun Telegram yang sudah terhubung). */
  chats: Record<string, string>;
  /** token jemput satu-pakai → userId (dibuang setelah dipakai). */
  tokens: Record<string, string>;
};

const CHAT_ID_PATTERN = /^-?\d+$/;
const TOKEN_JEMPUT_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

// ─── Murni (diuji unit test) ──────────────────────────────────────────

export function sanitasiTelegramConfig(raw: string): TelegramConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { chats: {}, tokens: {} };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { chats: {}, tokens: {} };
  }
  const o = parsed as Record<string, unknown>;
  const out: TelegramConfig = { chats: {}, tokens: {} };
  if (typeof o.botUsername === "string" && o.botUsername.trim()) {
    out.botUsername = o.botUsername.trim();
  }
  if (typeof o.webhookSecret === "string" && o.webhookSecret.trim()) {
    out.webhookSecret = o.webhookSecret.trim();
  }
  for (const [k, v] of Object.entries(o.chats ?? {})) {
    if (typeof v === "string" && CHAT_ID_PATTERN.test(v)) out.chats[k] = v;
  }
  for (const [k, v] of Object.entries(o.tokens ?? {})) {
    if (
      typeof v === "string" &&
      TOKEN_JEMPUT_PATTERN.test(k) &&
      v.length > 0
    ) {
      out.tokens[k] = v;
    }
  }
  return out;
}

/** Token jemput satu-pakai (hex 32 — aman dibagikan lewat deep link). */
export function buatTokenJemput(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function urlJemput(botUsername: string, token: string): string {
  return `https://t.me/${botUsername}?start=${token}`;
}

/** `"/start abc123"` → `"abc123"`; bukan perintah start valid → null. */
export function parseStartToken(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const m = text.trim().match(/^\/start\s+([A-Za-z0-9_-]{8,64})$/);
  return m ? m[1] : null;
}

/**
 * Ikat chatId ke userId lewat token jemput — token dipakai sekali
 * (dihapus). Token tak dikenal → null (config tidak berubah).
 */
export function hubungkanChat(
  config: TelegramConfig,
  token: string,
  chatId: string,
): { config: TelegramConfig; userId: string } | null {
  if (!CHAT_ID_PATTERN.test(chatId)) return null;
  const userId = config.tokens[token];
  if (!userId) return null;
  const tokens = { ...config.tokens };
  delete tokens[token];
  return {
    config: {
      ...config,
      chats: { ...config.chats, [userId]: chatId },
      tokens,
    },
    userId,
  };
}

export function putuskanChat(
  config: TelegramConfig,
  userId: string,
): TelegramConfig {
  const chats = { ...config.chats };
  delete chats[userId];
  return { ...config, chats };
}

/** chatId untuk userId yang terhubung saja, urut sesuai input, unik. */
export function chatIdsUntuk(
  config: TelegramConfig,
  userIds: string[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of userIds) {
    const chat = config.chats[id];
    if (chat && !seen.has(chat)) {
      seen.add(chat);
      out.push(chat);
    }
  }
  return out;
}

/** Teks pesan: judul + isi (isi kosong → hanya judul). */
export function teksPesanTelegram(title: string, body: string): string {
  const isi = body.trim();
  return isi ? `${title}\n${isi}` : title;
}

// ─── Impure (server) ──────────────────────────────────────────────────

export function telegramEnabled(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

export function webhookUrlTelegram(): string | null {
  const base = process.env.AUTH_URL?.replace(/\/$/, "");
  return base ? `${base}/api/telegram/webhook` : null;
}

export async function muatTelegramConfig(): Promise<TelegramConfig> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: TELEGRAM_CONFIG_KEY },
    });
    if (!row) return { chats: {}, tokens: {} };
    return sanitasiTelegramConfig(row.value);
  } catch {
    return { chats: {}, tokens: {} };
  }
}

export async function simpanTelegramConfig(
  config: TelegramConfig,
  updatedBy?: string,
  db: Prisma.TransactionClient | PrismaClient = prisma,
): Promise<void> {
  const value = JSON.stringify(config);
  await db.systemSetting.upsert({
    where: { key: TELEGRAM_CONFIG_KEY },
    update: { value, updatedBy: updatedBy ?? null },
    create: { key: TELEGRAM_CONFIG_KEY, value, updatedBy: updatedBy ?? null },
  });
}

async function telegramApi<T>(
  method: string,
  payload: Record<string, unknown>,
): Promise<T | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; result?: T };
    return data.ok ? (data.result ?? (null as T)) : null;
  } catch {
    return null;
  }
}

export async function telegramGetMe(): Promise<{ username: string } | null> {
  return telegramApi<{ username: string }>("getMe", {});
}

export async function telegramSetWebhook(
  url: string,
  secret: string,
): Promise<boolean> {
  const result = await telegramApi<unknown>("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
  });
  return result !== null;
}

/**
 * Kirim pesan ke daftar chatId — plain text + tombol "Buka" bila ada url.
 * Best effort: tiap chat dibungkus try/catch; mengembalikan jumlah sukses.
 */
export async function kirimTelegram(
  chatIds: string[],
  title: string,
  body: string,
  url?: string,
): Promise<number> {
  if (chatIds.length === 0 || !telegramEnabled()) return 0;
  let sukses = 0;
  await Promise.all(
    chatIds.map(async (chatId) => {
      const ok = await telegramApi<unknown>("sendMessage", {
        chat_id: chatId,
        text: teksPesanTelegram(title, body),
        disable_web_page_preview: true,
        ...(url
          ? { reply_markup: { inline_keyboard: [[{ text: "Buka", url }]] } }
          : {}),
      });
      if (ok !== null) sukses += 1;
    }),
  );
  return sukses;
}

/**
 * Kirim payload push ke chat Telegram staf yang terhubung (event staf:
 * booking baru, stok menipis). Tanpa env / tanpa yang terhubung = no-op.
 */
export async function kirimTelegramStaf(
  userIds: string[],
  payload: { title: string; body: string; url: string },
): Promise<void> {
  try {
    if (!telegramEnabled() || userIds.length === 0) return;
    const config = await muatTelegramConfig();
    const chats = chatIdsUntuk(config, userIds);
    if (chats.length === 0) return;
    const base = process.env.AUTH_URL?.replace(/\/$/, "");
    await kirimTelegram(
      chats,
      payload.title,
      payload.body,
      base ? `${base}${payload.url}` : undefined,
    );
  } catch {
    /* no-op */
  }
}
