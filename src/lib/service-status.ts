import type { ServiceStatus } from "@db/prisma/client";

export const STATUS_LABEL: Record<ServiceStatus, string> = {
  PENDING: "Booking Masuk",
  WAITING_APPROVAL: "Menunggu Persetujuan",
  CONFIRMED: "Dikonfirmasi",
  CHECKED_IN: "Unit Diterima",
  IN_PROGRESS: "Dikerjakan",
  WAITING_PARTS: "Menunggu Part",
  DONE: "Selesai",
  CANCELLED: "Dibatalkan",
};

export const STATUS_COLOR: Record<ServiceStatus, string> = {
  PENDING: "bg-slate-100 text-foreground",
  WAITING_APPROVAL: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  CHECKED_IN: "bg-cyan-100 text-cyan-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  WAITING_PARTS: "bg-orange-100 text-orange-800",
  DONE: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-800",
};

/** Nama aksi berikutnya per status — dipakai sticky bar & panel aksi. */
export const NEXT_ACTION_LABEL: Record<ServiceStatus, string> = {
  PENDING: "Beri estimasi & jadwal",
  WAITING_APPROVAL: "Setujui estimasi",
  CONFIRMED: "Terima unit masuk",
  CHECKED_IN: "Mulai kerja",
  IN_PROGRESS: "Selesaikan pengerjaan",
  WAITING_PARTS: "Lanjutkan pengerjaan",
  DONE: "Servis selesai",
  CANCELLED: "Servis dibatalkan",
};

/** Status yang masih terbuka (aktif dikerjakan / menunggu aksi). */
export const ACTIVE_STATUSES: ServiceStatus[] = [
  "PENDING",
  "WAITING_APPROVAL",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "WAITING_PARTS",
];

/** Status yang menerima pembayaran: saat booking/awal (DP) atau setelah SELESAI. */
const STATUS_BAYAR_AWAL: ServiceStatus[] = [
  "PENDING",
  "WAITING_APPROVAL",
  "CONFIRMED",
];

/**
 * Urutan kas: bayar hanya saat booking/awal (DP) atau setelah servis SELESAI —
 * unit yang sedang dikerjakan menunggu QC lolos dulu sebelum ada pembayaran.
 */
export function bolehBayar(status: ServiceStatus): boolean {
  return STATUS_BAYAR_AWAL.includes(status) || status === "DONE";
}

/** Pesan untuk status yang menahan pembayaran (unit sedang dikerjakan). */
export const PESAN_BAYAR_DITAHAN =
  "Pembayaran ditahan — DP saat booking, pelunasan setelah servis SELESAI (QC lolos).";

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatTanggal(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function formatTanggalPendek(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/** Format jadwal kedatangan — selalu WIB, apa pun TZ runtime server. */
export function formatTanggalWIB(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/**
 * Window hari WIB untuk filter tanggal tunggal di param URL ("YYYY-MM-DD").
 * Timestamp disimpan UTC, tapi hari yang dipilih user = hari WIB (+07:00);
 * hasilnya rentang setengah terbuka [00:00, 00:00 hari berikutnya) siap pakai
 * di filter Prisma (`scheduledAt: windowHariWIB(...)`).
 * Kembalikan null bila format salah atau tanggal tidak valid — nilai asing
 * jangan pernah jadi Invalid Date (500) atau lolos ke query.
 */
export function windowHariWIB(
  tanggal?: string | null,
): { gte: string; lt: string } | null {
  if (!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return null;
  const probe = new Date(`${tanggal}T00:00:00Z`);
  // NaN = komponen tak terbaca; selain itu JS suka "meloloskan" tanggal
  // guling (2026-02-31 → 3 Mar) — cocokkan round-trip-nya juga.
  if (
    Number.isNaN(probe.getTime()) ||
    probe.toISOString().slice(0, 10) !== tanggal
  )
    return null;
  const berikut = new Date(probe.getTime() + 24 * 60 * 60 * 1000);
  return {
    gte: `${tanggal}T00:00:00+07:00`,
    lt: `${berikut.toISOString().slice(0, 10)}T00:00:00+07:00`,
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Batas bulan berjalan menurut kalender WIB — bukan waktu lokal server. */
function bulanBerjalanWIB(now: Date): { gte: string; lt: string } {
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const y = wib.getUTCFullYear();
  const m = wib.getUTCMonth();
  const berikut = new Date(Date.UTC(y, m + 1, 1));
  return {
    gte: `${y}-${pad2(m + 1)}-01T00:00:00+07:00`,
    lt: `${berikut.getUTCFullYear()}-${pad2(berikut.getUTCMonth() + 1)}-01T00:00:00+07:00`,
  };
}

/**
 * Periode laporan: param `from`/`to` = tanggal pilihan user (hari WIB),
 * default = bulan berjalan WIB. Hasil berupa rentang setengah terbuka
 * `[gte, lt)` siap pakai di filter Prisma — semua batas +07:00, bukan
 * waktu lokal server (Vercel = UTC), supaya laporan tidak meleset 7 jam.
 * `dari`/`sampai` = tanggal "YYYY-MM-DD" untuk value input & URL export.
 */
export function periodeWIB(
  from?: string | null,
  to?: string | null,
  now: Date = new Date(),
): { gte: string; lt: string; dari: string; sampai: string } {
  const default_ = bulanBerjalanWIB(now);
  const f = windowHariWIB(from);
  const t = windowHariWIB(to);
  const gte = f?.gte ?? default_.gte;
  const lt = t?.lt ?? default_.lt;
  const dari = gte.slice(0, 10);
  // lt = 00:00 hari SETELAH hari terakhir → hari terakhir = lt − 1 hari.
  const akhir = new Date(`${lt.slice(0, 10)}T00:00:00Z`);
  akhir.setUTCDate(akhir.getUTCDate() - 1);
  return { gte, lt, dari, sampai: akhir.toISOString().slice(0, 10) };
}
