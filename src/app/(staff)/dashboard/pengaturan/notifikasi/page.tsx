import { requireOwnerOrSysAdmin } from "@/lib/guard";
import { muatTemplateNotif } from "@/lib/notif-template-db";
import {
  muatTelegramConfig,
  telegramEnabled,
  webhookUrlTelegram,
} from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { BackLink } from "@/components/back-link";
import { TemplateEditor } from "./template-editor";
import { TelegramPanel } from "./telegram-panel";

export const metadata = { title: "Template Notifikasi" };

export default async function NotifikasiPage() {
  const session = await requireOwnerOrSysAdmin();
  const initial = await muatTemplateNotif();

  const tgEnabled = telegramEnabled();
  const tgConfig = await muatTelegramConfig();
  const webhookAktif = !!tgConfig.webhookSecret && !!webhookUrlTelegram();
  const connectedIds = Object.keys(tgConfig.chats);
  const connected = connectedIds.length
    ? await prisma.user.findMany({
        where: { id: { in: connectedIds } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <div>
        <BackLink
          href="/dashboard/pengaturan"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          &larr; Kembali ke Pengaturan
        </BackLink>
        <h1 className="mt-2 text-xl font-bold tracking-tight">
          Template Notifikasi
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ubah teks push notifikasi &amp; pesan WhatsApp — hanya OWNER &amp;
          SYS_ADMIN
        </p>
      </div>

      <TemplateEditor initial={initial} />

      <TelegramPanel
        enabled={tgEnabled}
        webhookAktif={webhookAktif}
        botUsername={tgConfig.botUsername}
        sayaTerhubung={!!tgConfig.chats[session.user.id]}
        connected={connected}
        sayaId={session.user.id}
      />
    </div>
  );
}
