"use client";

import { useActionState } from "react";
import {
  aktifkanTelegramWebhook,
  buatLinkHubungkanTelegram,
  putuskanTelegramSaya,
} from "./actions";

type Props = {
  enabled: boolean;
  webhookAktif: boolean;
  botUsername?: string;
  sayaTerhubung: boolean;
  connected: { id: string; name: string }[];
  sayaId: string;
};

export function TelegramPanel({
  enabled,
  webhookAktif,
  botUsername,
  sayaTerhubung,
  connected,
  sayaId,
}: Props) {
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

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">
        Telegram — channel cadangan staf
      </h2>

      {!enabled && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm text-muted-foreground">
            Notifikasi Telegram <b>belum aktif</b> — masih memakai push. Untuk
            mengaktifkan (gratis, andal di HP agresif):
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Chat{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                @BotFather
              </a>{" "}
              di Telegram → kirim <code>/newbot</code> → salin token.
            </li>
            <li>
              Tambah env <code>TELEGRAM_BOT_TOKEN</code> di Vercel (project
              ini) → redeploy.
            </li>
            <li>Buka lagi halaman ini → &quot;Aktifkan webhook&quot;.</li>
          </ol>
        </div>
      )}

      {enabled && !webhookAktif && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm text-muted-foreground">
            Bot terdeteksi, tapi webhook belum aktif — aktifkan agar bot bisa
            menerima perintah /start untuk menghubungkan akun.
          </p>
          <form action={whAction} className="mt-3">
            <button
              type="submit"
              disabled={whPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white active:opacity-90 disabled:opacity-50"
            >
              {whPending ? "Mengaktifkan…" : "Aktifkan webhook"}
            </button>
          </form>
        </div>
      )}

      {enabled && webhookAktif && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">
              Bot{" "}
              <span className="font-medium text-foreground">
                {botUsername ? `@${botUsername}` : "aktif"}
              </span>{" "}
              <span className="text-success">✓ webhook aktif</span>
            </p>
          </div>

          {connected.length > 0 && (
            <ul className="mt-3 space-y-1">
              {connected.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-foreground">
                    {u.name}
                    {u.id === sayaId && (
                      <span className="text-muted-foreground"> (Anda)</span>
                    )}
                  </span>
                  <span className="text-xs text-success">Terhubung</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 space-y-3">
            {!sayaTerhubung && (
              <form action={hubAction}>
                <button
                  type="submit"
                  disabled={hubPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white active:opacity-90 disabled:opacity-50"
                >
                  {hubPending ? "Membuat link…" : "Hubungkan Telegram saya"}
                </button>
              </form>
            )}
            {hubState.link && !sayaTerhubung && (
              <div className="space-y-2">
                <a
                  href={hubState.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-white active:opacity-90"
                >
                  Buka Telegram &amp; tap Start
                </a>
                <p className="text-xs text-muted-foreground">
                  Token sekali pakai — setelah tap Start, akun Anda langsung
                  terhubung.
                </p>
              </div>
            )}
            {sayaTerhubung && (
              <form action={putAction}>
                <button
                  type="submit"
                  disabled={putPending}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-danger ring-1 ring-slate-200 active:opacity-90 disabled:opacity-50"
                >
                  {putPending ? "Memutus…" : "Putuskan Telegram saya"}
                </button>
              </form>
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Event staf (booking baru &amp; stok menipis) terkirim ke semua akun
            di atas — teksnya mengikuti template push di atas.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      {success && <p className="text-sm text-success">{success}</p>}
    </section>
  );
}
