"use client";

/**
 * Kartu status/hubungkan Telegram — dipasang di Beranda staff (OWNER/ADMIN,
 * audiens yang sama dengan penerima notifikasi staf & kartu push).
 * Aktifkan webhook hanya untuk OWNER/SYS_ADMIN; hubungkan/putus akun sendiri
 * juga untuk ADMIN (Admin cabang penerima notifikasi harus bisa ikut).
 */

import { useActionState } from "react";
import {
  aktifkanTelegramWebhook,
  buatLinkHubungkanTelegram,
  putuskanTelegramSaya,
} from "@/app/(staff)/dashboard/pengaturan/notifikasi/actions";

export function TelegramOptInCard({
  enabled,
  webhookAktif,
  sayaTerhubung,
  bawahAktifkan,
}: {
  /** false = env TELEGRAM_BOT_TOKEN belum ada. */
  enabled: boolean;
  webhookAktif: boolean;
  sayaTerhubung: boolean;
  /** true = OWNER/SYS_ADMIN boleh mengaktifkan webhook dari kartu ini. */
  bawahAktifkan: boolean;
}) {
  const [whState, whAction, whPending] = useActionState(
    aktifkanTelegramWebhook,
    {},
  );
  const [hubState, hubAction, hubPending] = useActionState(
    buatLinkHubungkanTelegram,
    {},
  );
  const [putState, putAction, putPending] = useActionState(
    putuskanTelegramSaya,
    {},
  );

  const error = whState.error ?? hubState.error ?? putState.error;
  const success = whState.success ?? hubState.success ?? putState.success;

  if (!enabled) return null;

  return (
    <section className="space-y-3 rounded-2xl bg-surface p-4 shadow-card">
      <div>
        <h2 className="text-base font-semibold text-secondary">
          Notifikasi Telegram
        </h2>
        <p className="text-sm text-muted-foreground">
          Cadangan gratis bila notifikasi HP tertahan HP agresif — booking baru
          &amp; stok menipis masuk ke chat Telegram.
        </p>
      </div>

      {!webhookAktif ? (
        bawahAktifkan ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Bot belum terhubung ke server — aktifkan webhook dulu.
            </p>
            <form action={whAction}>
              <button
                type="submit"
                disabled={whPending}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {whPending ? "Mengaktifkan…" : "Aktifkan Webhook"}
              </button>
            </form>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Menunggu Owner mengaktifkan webhook Telegram.
          </p>
        )
      ) : sayaTerhubung ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-success">Akun Telegram Anda terhubung.</p>
          <form action={putAction}>
            <button
              type="submit"
              disabled={putPending}
              className="shrink-0 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-secondary disabled:opacity-50"
            >
              {putPending ? "…" : "Putuskan"}
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-2">
          <form action={hubAction}>
            <button
              type="submit"
              disabled={hubPending}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {hubPending ? "…" : "Hubungkan Telegram Saya"}
            </button>
          </form>
          {hubState.link && (
            <div className="space-y-1">
              <a
                href={hubState.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground"
              >
                Buka Telegram &amp; tap Start
              </a>
              <p className="text-xs text-muted-foreground">
                Link sekali pakai — tap Start, akun langsung terhubung.
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}
    </section>
  );
}
