/**
 * Konfigurasi alur DP booking (§C1–C5) — pembaca SystemSetting `dp_*`.
 *
 * - `parseDpConfig` MURNI (tanpa prisma) — diuji unit test.
 * - `getDpConfig` = loader (ikuti pola `getBookingConfig`).
 * - `dp_nominal = 0` → DP nonaktif (booking langsung PENDING, tanpa tahap DP).
 * - `dp_policy` kosong/tidak dikenal → fallback `TANPA_REFUND`.
 * - `labelTerlambat` — badge overdue render-time (tanpa kolom baru): muncul
 *   sejak jadwal lewat; suffix kebijakan mulai lewat `noShowDays`.
 */

import { prisma } from "@/lib/prisma";

export type DpPolicy = "TANPA_REFUND" | "REFUND_PENUH";

export type DpConfig = {
  /** Tanda jadi; 0 = DP nonaktif. */
  nominal: number;
  transferEnabled: boolean;
  bank: string;
  accountNumber: string;
  accountName: string;
  qrisEnabled: boolean;
  /** Data URL / URL gambar QRIS (kosong = belum ada). */
  qrisImage: string;
  /** Pekan setelah jadwal lewat → suffix label overdue muncul. */
  noShowDays: number;
  policy: DpPolicy;
};

export const DP_CONFIG_DEFAULT: DpConfig = {
  nominal: 50_000,
  transferEnabled: false,
  bank: "",
  accountNumber: "",
  accountName: "",
  qrisEnabled: false,
  qrisImage: "",
  noShowDays: 7,
  policy: "TANPA_REFUND",
};

export const DP_SETTING_KEYS = [
  "dp_nominal",
  "dp_transfer_enabled",
  "dp_bank",
  "dp_account_number",
  "dp_account_name",
  "dp_qris_enabled",
  "dp_qris_image",
  "dp_no_show_days",
  "dp_policy",
] as const;

export function parseDpConfig(
  rows: { key: string; value: string }[],
): DpConfig {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const ambilAngka = (key: string, def: number, min: number, max: number): number => {
    const raw = map.get(key);
    if (raw === undefined || raw.trim() === "") return def;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) return def;
    return n;
  };
  const ambilTeks = (key: string): string => (map.get(key) ?? "").trim();
  const policyRaw = ambilTeks("dp_policy");
  return {
    nominal: ambilAngka(
      "dp_nominal",
      DP_CONFIG_DEFAULT.nominal,
      0,
      2_000_000_000,
    ),
    transferEnabled: map.get("dp_transfer_enabled") === "true",
    bank: ambilTeks("dp_bank"),
    accountNumber: ambilTeks("dp_account_number"),
    accountName: ambilTeks("dp_account_name"),
    qrisEnabled: map.get("dp_qris_enabled") === "true",
    qrisImage: ambilTeks("dp_qris_image"),
    noShowDays: ambilAngka(
      "dp_no_show_days",
      DP_CONFIG_DEFAULT.noShowDays,
      0,
      90,
    ),
    policy: policyRaw === "REFUND_PENUH" ? "REFUND_PENUH" : "TANPA_REFUND",
  };
}

/** DP aktif = nominal > 0 (booking melewati tahap WAITING_DP). */
export function dpAktif(cfg: DpConfig): boolean {
  return cfg.nominal > 0;
}

type Db = Pick<typeof prisma, "systemSetting">;

export async function getDpConfig(db: Db = prisma): Promise<DpConfig> {
  const rows = await db.systemSetting.findMany({
    where: { key: { startsWith: "dp_" } },
    select: { key: true, value: true },
  });
  return parseDpConfig(rows);
}

/**
 * Badge "Terlambat X hr Y jam" (+ suffix kebijakan setelah `noShowDays`) —
 * render-time, tanpa kolom baru. `null` bila belum lewat / tanpa jadwal.
 * Status difilter pemanggil (WAITING_DP/PENDING/WAITING_APPROVAL/CONFIRMED).
 */
export function labelTerlambat(
  scheduledAt: Date | null,
  now: Date,
  cfg: DpConfig,
): string | null {
  if (!scheduledAt) return null;
  const lewat = now.getTime() - scheduledAt.getTime();
  if (lewat <= 0) return null;

  const totalMenit = Math.floor(lewat / 60_000);
  const hr = Math.floor(totalMenit / (60 * 24));
  const jam = Math.floor((totalMenit % (60 * 24)) / 60);
  const menit = totalMenit % 60;
  let teks: string;
  if (hr > 0) teks = `Terlambat ${hr} hr ${jam} jam`;
  else if (jam > 0) teks = `Terlambat ${jam} jam`;
  else teks = `Terlambat ${menit} menit`;

  if (lewat >= cfg.noShowDays * 86_400_000) {
    teks +=
      cfg.policy === "REFUND_PENUH"
        ? " · jika dibatalkan, DP direfund"
        : " · boleh dibatalkan, DP hangus";
  }
  return teks;
}
