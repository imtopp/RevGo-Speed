"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import { DownloadLink } from "@/components/download-link";
import { SubmitButton } from "@/components/submit-button";
import { doUpdate, type UpdateState } from "./actions";
import {
  CONFIRM_PULL_WORD,
  CONFIRM_ROLLBACK_WORD,
  PENDING_TTL_MS,
  shortSha,
  type ChannelStatus,
  type HistoryEntry,
  type PendingUpdate,
} from "@/lib/update-channel";

type Props = {
  appName: string;
  channelBranch: string | null;
  configured: boolean;
  status: ChannelStatus;
  currentSha: string | null;
  latestSha: string | null;
  latestMessage: string | null;
  latestDate: string | null;
  fetchError: string | null;
  history: HistoryEntry[];
  rollbackTo: string | null;
  pending: PendingUpdate | null;
  pendingFresh: boolean;
};

type BuildingInfo = { from: string; to: string; beforeVersion: string };

type Phase = "idle" | "building" | "done" | "timeout";

const STATUS_LABEL: Record<ChannelStatus, string> = {
  NOT_CONFIGURED: "Belum dikonfigurasi",
  LOCAL: "Mode lokal",
  BUILDING: "Build berjalan…",
  UP_TO_DATE: "Sudah terbaru",
  UPDATE_AVAILABLE: "Ada versi baru",
  UNKNOWN: "Versi terbaru tak terbaca",
};

const STATUS_CLASS: Record<ChannelStatus, string> = {
  NOT_CONFIGURED: "bg-slate-100 text-muted-foreground",
  LOCAL: "bg-slate-100 text-muted-foreground",
  BUILDING: "bg-warning/15 text-warning",
  UP_TO_DATE: "bg-success/15 text-success",
  UPDATE_AVAILABLE: "bg-primary text-white",
  UNKNOWN: "bg-slate-100 text-muted-foreground",
};

const CARD =
  "space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card";
const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";
const BTN_PRIMARY =
  "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60";
const BTN_SECONDARY =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-foreground active:opacity-90 disabled:opacity-60";

function formatWaktu(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export function UpdateClient(props: Props) {
  const [terminal, setTerminal] = useState<"done" | "timeout" | null>(null);
  const [actionState, action] = useActionState<UpdateState, FormData>(
    doUpdate,
    {},
  );

  const building = useMemo<BuildingInfo | null>(() => {
    const p = actionState.pending;
    if (p) return { from: p.from, to: p.to, beforeVersion: p.beforeVersion };
    if (props.pendingFresh && props.pending) {
      return {
        from: props.pending.from,
        to: props.pending.to,
        beforeVersion: props.pending.beforeVersion,
      };
    }
    return null;
  }, [actionState.pending, props.pending, props.pendingFresh]);

  const phase: Phase = terminal ?? (building ? "building" : "idle");

  useEffect(() => {
    if (phase !== "building" || !building) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = new Date().getTime() + PENDING_TTL_MS;

    async function tick() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data: { version?: string } = await res.json();
        if (data.version && data.version !== building!.beforeVersion) {
          setTerminal("done");
          return;
        }
      } catch {
        // server version belum terbaca — coba lagi di tick berikutnya
      }
      if (new Date().getTime() > deadline) {
        setTerminal("timeout");
        return;
      }
      timer = setTimeout(tick, 5000);
    }

    timer = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, building]);

  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => window.location.reload(), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  const showForms =
    props.configured &&
    Boolean(props.currentSha) &&
    (phase === "idle" || phase === "timeout");
  const showActionForm =
    showForms &&
    (props.status === "UPDATE_AVAILABLE" ||
      props.status === "UP_TO_DATE" ||
      props.status === "UNKNOWN");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Update</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tarik versi terbaru dari rilis utama ke{" "}
          <span className="font-medium">{props.channelBranch ?? "channel"}</span>{" "}
          — atau kembalikan ke versi sebelumnya
        </p>
      </div>

      <section className={CARD}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Status Versi</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[props.status]}`}
          >
            {STATUS_LABEL[props.status]}
          </span>
        </div>
        <dl className="space-y-1.5 text-sm">
          <InfoRow
            label="Berjalan di aplikasi"
            value={
              props.currentSha ? shortSha(props.currentSha) : "Lokal / bukan produksi"
            }
          />
          <InfoRow
            label="Terbaru di rilis utama"
            value={
              props.latestSha
                ? shortSha(props.latestSha)
                : props.fetchError
                  ? "Gagal dibaca"
                  : "—"
            }
          />
          <InfoRow label="Channel" value={props.channelBranch ?? "—"} />
        </dl>
        {props.latestMessage && (
          <p className="text-xs text-slate-400">
            “{props.latestMessage}”
            {props.latestDate ? ` · ${formatWaktu(props.latestDate)}` : ""}
          </p>
        )}
        {props.fetchError && (
          <p className="text-sm text-danger">{props.fetchError}</p>
        )}
        {props.status === "NOT_CONFIGURED" && (
          <p className="text-sm text-muted-foreground">
            Fitur belum aktif: env <code>UPDATE_CHANNEL_BRANCH</code>,{" "}
            <code>GITHUB_REPO</code>, dan <code>GITHUB_TOKEN</code> belum
            terisi di server.
          </p>
        )}
        {props.status === "LOCAL" && (
          <p className="text-sm text-muted-foreground">
            Update hanya dijalankan dari deployment produksi — environment
            lokal/dev tidak menarik versi.
          </p>
        )}
      </section>

      {phase === "building" && building && (
        <section className={CARD}>
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            <h2 className="text-sm font-semibold text-foreground">
              Build sedang berjalan…
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {shortSha(building.from)} → {shortSha(building.to)}. Deploy baru
            aktif dalam beberapa menit, halaman akan memuat ulang otomatis.
            Boleh tinggalkan halaman — proses tetap berjalan di Vercel.
          </p>
        </section>
      )}

      {phase === "done" && (
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-success">
            Update aktif — memuat ulang…
          </h2>
          <p className="text-sm text-muted-foreground">
            Versi baru sudah dilayani. Halaman dimuat ulang otomatis.
          </p>
        </section>
      )}

      {phase === "timeout" && (
        <section className="rounded-xl bg-warning/10 p-4 ring-1 ring-warning/40">
          <h2 className="text-sm font-semibold text-warning">
            Build belum selesai (lewat 8 menit)
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Kemungkinan build gagal — cek log di Vercel. Ref channel sudah
            dipindah, jadi jika build gagal gunakan tombol{" "}
            <strong>Kembalikan</strong> di bawah (mengembalikan ref ke kode
            lama) atau perbaiki dulu lalu tarik ulang.
          </p>
        </section>
      )}

      {showForms && (
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-foreground">
            Langkah Wajib Sebelum Update
          </h2>
          <p className="text-sm text-muted-foreground">
            Unduh backup JSON dulu &amp; simpan di tempat aman. Backup dipakai
            untuk memulihkan data bila ada masalah setelah update.
          </p>
          <DownloadLink
            href="/api/backup/export"
            filename="backup-sebelum-update.json"
            className="inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-foreground active:opacity-90"
          >
            Unduh Backup JSON
          </DownloadLink>
        </section>
      )}

      {showActionForm && (
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-foreground">Terapkan</h2>
          {props.status === "UP_TO_DATE" && (
            <p className="text-sm text-success">
              Aplikasi sudah berjalan di versi terbaru.
            </p>
          )}
          {props.rollbackTo && (
            <p className="text-sm text-muted-foreground">
              Rollback mengembalikan channel ke{" "}
              <span className="font-medium tabular-nums">
                {shortSha(props.rollbackTo)}
              </span>{" "}
              (Vercel membangun ulang kode lama).
            </p>
          )}
          <form
            action={action}
            onSubmit={() => setTerminal(null)}
            className="space-y-3"
          >
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="backupDone"
                value="1"
                required
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                Saya sudah mengunduh &amp; menyimpan file backup di tempat aman
              </span>
            </label>
            <input
              name="confirm"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder={`Ketik ${CONFIRM_PULL_WORD} / ${CONFIRM_ROLLBACK_WORD} sesuai tombol`}
              aria-label={`Ketik ${CONFIRM_PULL_WORD} atau ${CONFIRM_ROLLBACK_WORD} sesuai tombol yang ditekan`}
              className={INPUT}
            />
            <div className="flex flex-wrap gap-2">
              <SubmitButton
                name="mode"
                value="pull"
                pendingText="Menarik versi…"
                disabled={props.status === "UP_TO_DATE"}
                className={BTN_PRIMARY}
              >
                Perbarui Sekarang
              </SubmitButton>
              {props.rollbackTo && (
                <SubmitButton
                  name="mode"
                  value="rollback"
                  pendingText="Mengembalikan…"
                  className={BTN_SECONDARY}
                >
                  Kembalikan {shortSha(props.rollbackTo)}
                </SubmitButton>
              )}
            </div>
            {actionState.error && (
              <p className="text-sm text-danger">{actionState.error}</p>
            )}
            {!actionState.pending && actionState.success && (
              <p className="text-sm text-success">{actionState.success}</p>
            )}
          </form>
        </section>
      )}

      {props.history.length > 0 && (
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-foreground">
            Riwayat Update
          </h2>
          <ul className="space-y-2">
            {props.history.slice(0, 10).map((h, i) => (
              <li key={`${h.to}-${i}`} className="text-sm">
                <span className="tabular-nums text-muted-foreground">
                  {formatWaktu(h.at)}
                </span>{" "}
                — {h.type === "pull" ? "tarik" : "rollback"}{" "}
                <span className="tabular-nums">
                  {h.from ? `${shortSha(h.from)} → ` : ""}
                  {shortSha(h.to)}
                </span>
                {h.actor ? (
                  <span className="text-muted-foreground"> · {h.actor}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
