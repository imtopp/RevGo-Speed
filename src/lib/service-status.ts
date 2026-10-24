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
  }).format(date);
}
