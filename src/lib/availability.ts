// Semua waktu dihitung dalam zona WIB tanpa mengandalkan TZ runtime:
// - parse/format dari komponen UTC + offset WIB, agar identik di dev lokal (WIB) & Vercel (UTC).

const WIB_OFFSET_MS = 7 * 3600 * 1000;
export const HARI_MS = 24 * 3600 * 1000;

export const SLOT_STEP_MENIT = 60;
export const DURASI_DEFAULT_MENIT = 60;
export const DURASI_MIN_MENIT = 5;
export const DURASI_MAX_MENIT = 1440;

export type BookingConfig = {
  leadMinutes: number;
  horizonDays: number;
  bufferMinutes: number;
};

export const BOOKING_CONFIG_DEFAULT: BookingConfig = {
  leadMinutes: 120,
  horizonDays: 14,
  bufferMinutes: 15,
};

export const BOOKING_SETTING_KEYS = [
  "booking_lead_minutes",
  "booking_horizon_days",
  "booking_buffer_minutes",
] as const;

const BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const HARI_NAMA = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export type Jendela = { mulai: number; selesai: number };
export type Alternatif = { date: string; jam: string };

export function parseBookingConfig(
  rows: { key: string; value: string }[],
): BookingConfig {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const ambil = (key: string, def: number, min: number, max: number): number => {
    const raw = map.get(key);
    if (raw === undefined || raw.trim() === "") return def;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) return def;
    return n;
  };
  return {
    leadMinutes: ambil("booking_lead_minutes", BOOKING_CONFIG_DEFAULT.leadMinutes, 0, 10080),
    horizonDays: ambil("booking_horizon_days", BOOKING_CONFIG_DEFAULT.horizonDays, 1, 90),
    bufferMinutes: ambil("booking_buffer_minutes", BOOKING_CONFIG_DEFAULT.bufferMinutes, 0, 120),
  };
}

type WibParts = { y: number; mo: number; d: number; dow: number; hh: number; mm: number };

export function wibParts(ms: number): WibParts {
  const d = new Date(ms + WIB_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth() + 1,
    d: d.getUTCDate(),
    dow: d.getUTCDay(),
    hh: d.getUTCHours(),
    mm: d.getUTCMinutes(),
  };
}

export function epochFromWall(
  y: number,
  mo: number,
  d: number,
  hh: number,
  mm: number,
): number {
  return Date.UTC(y, mo - 1, d, hh, mm) - WIB_OFFSET_MS;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parse "YYYY-MM-DDTHH:mm" (detik opsional) → epoch, null bila tidak valid. */
export function parseJadwal(raw: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(raw.trim());
  if (!m) return null;
  const [y, mo, d, hh, mm] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
  if (hh > 23 || mm > 59) return null;
  const epoch = epochFromWall(y, mo, d, hh, mm);
  const cek = wibParts(epoch);
  if (cek.y !== y || cek.mo !== mo || cek.d !== d) return null;
  return epoch;
}

export function dateStrOf(ms: number): string {
  const p = wibParts(ms);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

export function jamOf(ms: number): string {
  const p = wibParts(ms);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

export function parseJam(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return hh * 60 + mm;
}

export function parseHariAktif(s: string): Set<number> {
  const out = new Set<number>();
  for (const part of s.split(",")) {
    const teks = part.trim();
    if (!teks) continue;
    const n = Number(teks);
    if (Number.isInteger(n) && n >= 0 && n <= 6) out.add(n);
  }
  return out;
}

export function startOfDayWib(ms: number): number {
  const p = wibParts(ms);
  return epochFromWall(p.y, p.mo, p.d, 0, 0);
}

function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Titik kedatangan (epoch WIB) pada satu tanggal — grid per SLOT_STEP menit dari jam buka. */
export function slotTitikHari(
  dateStr: string,
  jamBuka: string,
  jamTutup: string,
): number[] {
  if (!isValidDateStr(dateStr)) return [];
  const buka = parseJam(jamBuka);
  const tutup = parseJam(jamTutup);
  if (buka === null || tutup === null || buka >= tutup) return [];
  const [y, mo, d] = dateStr.split("-").map(Number);
  const base = epochFromWall(y, mo, d, 0, 0);
  const pts: number[] = [];
  for (let menit = buka; menit < tutup; menit += SLOT_STEP_MENIT) {
    pts.push(base + menit * 60000);
  }
  return pts;
}

/** Window blokir: [mulai, +durasi+buffer) — di-cap akhir hari WIB yang sama. */
export function jendelaDari(
  mulai: number,
  durasiMenit: number,
  bufferMenit: number,
): Jendela {
  const total = Math.max(1, durasiMenit + bufferMenit) * 60000;
  const besok = startOfDayWib(mulai) + HARI_MS;
  return { mulai, selesai: Math.min(mulai + total, besok) };
}

function jumlahYangMenutup(t: number, jendelas: Jendela[]): number {
  let n = 0;
  for (const j of jendelas) {
    if (j.mulai <= t && t < j.selesai) n++;
  }
  return n;
}

/**
 * Dua jendela pengerjaan [mulai, selesai) saling tumpang tindih?
 * Jendela yang hanya bersebelahan (09–11 vs 11–12) TIDAK dianggap bentrok.
 * Durasi < 1 menit diperlakukan sebagai 1 menit.
 */
export function jendelaBentrok(
  aMulai: number,
  aDurasiMenit: number,
  bMulai: number,
  bDurasiMenit: number,
): boolean {
  const aSelesai = aMulai + Math.max(1, aDurasiMenit) * 60000;
  const bSelesai = bMulai + Math.max(1, bDurasiMenit) * 60000;
  return aMulai < bSelesai && bMulai < aSelesai;
}

export function sisaKuota(t: number, jendelas: Jendela[], kuota: number): number {
  return Math.max(0, kuota - jumlahYangMenutup(t, jendelas));
}

/** Grid point di dalam window (untuk dateStr = hari mulai-nya window). */
function titikDalam(
  jw: Jendela,
  jamBuka: string,
  jamTutup: string,
): number[] {
  return slotTitikHari(dateStrOf(jw.mulai), jamBuka, jamTutup).filter(
    (t) => t >= jw.mulai && t < jw.selesai,
  );
}

/** Semua titik yang harus bebas agar booking pada `mulai` valid. */
function titikKunci(mulai: number, jw: Jendela, jamBuka: string, jamTutup: string): number[] {
  const pts = titikDalam(jw, jamBuka, jamTutup);
  if (!pts.includes(mulai)) return [mulai, ...pts];
  return pts;
}

export function cekKapasitas(
  mulai: number,
  durasiMenit: number,
  bufferMenit: number,
  jendelas: Jendela[],
  kuota: number,
  jamBuka: string,
  jamTutup: string,
): number | null {
  const jw = jendelaDari(mulai, durasiMenit, bufferMenit);
  for (const t of titikKunci(mulai, jw, jamBuka, jamTutup)) {
    if (sisaKuota(t, jendelas, kuota) < 1) return t;
  }
  return null;
}

export type CekSlotInput = {
  epoch: number;
  now: number;
  config: BookingConfig;
  kuotaParalel: number;
  jamBuka: string;
  jamTutup: string;
  hariAktif: string;
  jendelas: Jendela[];
  durasiMenit: number;
  /** false = alur staff (reservasi/walk-in): lead time tidak berlaku. */
  pakaiLeadTime: boolean;
};

export type CekSlotOk = { ok: true };
export type CekSlotError = { ok: false; error: string; alternatif: Alternatif[] };
export type CekSlotHasil = CekSlotOk | CekSlotError;

export function cariAlternatif(input: CekSlotInput, dari: number): Alternatif[] {
  const hasil: Alternatif[] = [];
  const hariSet = parseHariAktif(input.hariAktif);
  const buka = parseJam(input.jamBuka);
  const tutup = parseJam(input.jamTutup);
  if (buka === null || tutup === null || buka >= tutup) return hasil;

  const batasLead = input.now + (input.pakaiLeadTime ? input.config.leadMinutes * 60000 : 0);
  const akhirHorizon = dateStrOf(input.now + input.config.horizonDays * HARI_MS);
  const mulaiScan = Math.max(dari, batasLead);
  const hariPertama = startOfDayWib(mulaiScan);

  for (let i = 0; hasil.length < 5 && i <= input.config.horizonDays; i++) {
    const hariMs = hariPertama + i * HARI_MS;
    const ds = dateStrOf(hariMs);
    if (ds > akhirHorizon) break;
    if (!hariSet.has(wibParts(hariMs).dow)) continue;
    for (const t of slotTitikHari(ds, input.jamBuka, input.jamTutup)) {
      if (t < mulaiScan) continue;
      const jw = jendelaDari(t, input.durasiMenit, input.config.bufferMinutes);
      const penuh = titikKunci(t, jw, input.jamBuka, input.jamTutup).some(
        (pt) => sisaKuota(pt, input.jendelas, input.kuotaParalel) < 1,
      );
      if (!penuh) hasil.push({ date: ds, jam: jamOf(t) });
      if (hasil.length >= 5) break;
    }
  }
  return hasil;
}

export function validasiSlot(input: CekSlotInput): CekSlotHasil {
  const { epoch, now, config } = input;
  if (!Number.isFinite(epoch)) return { ok: false, error: "Jadwal tidak valid.", alternatif: [] };

  if (epoch < now) {
    return { ok: false, error: "Jadwal sudah lewat — pilih waktu mendatang.", alternatif: [] };
  }

  if (input.pakaiLeadTime && epoch < now + config.leadMinutes * 60000) {
    const alt = cariAlternatif(input, now + config.leadMinutes * 60000);
    return {
      ok: false,
      error: `Minimal booking ${formatDurasi(config.leadMinutes)} sebelum kedatangan.`,
      alternatif: alt,
    };
  }

  const tgl = dateStrOf(epoch);
  const batasHorizon = dateStrOf(now + config.horizonDays * HARI_MS);
  if (tgl > batasHorizon) {
    return {
      ok: false,
      error: `Maksimal booking ${config.horizonDays} hari ke depan.`,
      alternatif: cariAlternatif(input, epoch),
    };
  }

  const p = wibParts(epoch);
  const hariSet = parseHariAktif(input.hariAktif);
  if (hariSet.size === 0) {
    return { ok: false, error: "Cabang tidak punya hari operasional.", alternatif: [] };
  }
  if (!hariSet.has(p.dow)) {
    return {
      ok: false,
      error: `Bengkel tutup pada hari ${HARI_NAMA[p.dow]}.`,
      alternatif: cariAlternatif(input, epoch),
    };
  }

  const buka = parseJam(input.jamBuka);
  const tutup = parseJam(input.jamTutup);
  if (buka === null || tutup === null || buka >= tutup) {
    return { ok: false, error: "Jam operasional cabang tidak valid.", alternatif: [] };
  }
  const menit = p.hh * 60 + p.mm;
  if (menit < buka || menit >= tutup) {
    return {
      ok: false,
      error: `Di luar jam operasional (buka ${input.jamBuka.replace(":", ".")}–${input.jamTutup.replace(":", ".")}).`,
      alternatif: cariAlternatif(input, epoch),
    };
  }

  const tglPenuh = cekKapasitas(
    epoch,
    input.durasiMenit,
    config.bufferMinutes,
    input.jendelas,
    input.kuotaParalel,
    input.jamBuka,
    input.jamTutup,
  );
  if (tglPenuh !== null) {
    return {
      ok: false,
      error: `Slot ${jamOf(tglPenuh).replace(":", ".")} sudah penuh (kuota ${input.kuotaParalel} pit).`,
      alternatif: cariAlternatif(input, epoch),
    };
  }

  return { ok: true };
}

function dowOfDateStr(ds: string): number {
  const [y, mo, d] = ds.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

export type StatusTanggal = "lewat" | "tutup" | "penuh" | "kosong";

export function statusTanggal(opts: {
  dateStr: string;
  now: number;
  jamBuka: string;
  jamTutup: string;
  hariAktif: string;
  kuotaParalel: number;
  jendelas: Jendela[];
}): StatusTanggal {
  if (!isValidDateStr(opts.dateStr)) return "lewat";
  if (opts.dateStr < dateStrOf(opts.now)) return "lewat";
  if (!parseHariAktif(opts.hariAktif).has(dowOfDateStr(opts.dateStr))) return "tutup";
  const titik = slotTitikHari(opts.dateStr, opts.jamBuka, opts.jamTutup);
  if (titik.length === 0) return "tutup";
  if (titik.some((t) => sisaKuota(t, opts.jendelas, opts.kuotaParalel) > 0)) return "kosong";
  return "penuh";
}

export type SlotInfo = {
  jam: string;
  epoch: number;
  sisa: number;
  penuh: boolean;
};

export function daftarSlot(opts: {
  dateStr: string;
  jamBuka: string;
  jamTutup: string;
  kuotaParalel: number;
  jendelas: Jendela[];
}): SlotInfo[] {
  return slotTitikHari(opts.dateStr, opts.jamBuka, opts.jamTutup).map((t) => {
    const sisa = sisaKuota(t, opts.jendelas, opts.kuotaParalel);
    return { jam: jamOf(t), epoch: t, sisa, penuh: sisa < 1 };
  });
}

export function daftarTanggal(now: number, horizonDays: number): string[] {
  const hariPertama = startOfDayWib(now);
  const out: string[] = [];
  for (let i = 0; i <= horizonDays; i++) out.push(dateStrOf(hariPertama + i * HARI_MS));
  return out;
}

export function formatDurasi(menit: number): string {
  if (menit < 60) return `${menit} menit`;
  if (menit % 60 === 0) return `${menit / 60} jam`;
  return `${Math.floor(menit / 60)} jam ${menit % 60} menit`;
}

export function formatAlternatif(alts: Alternatif[]): string {
  if (alts.length === 0) return "";
  const per = new Map<string, string[]>();
  for (const a of alts) {
    const arr = per.get(a.date) ?? [];
    arr.push(a.jam.replace(":", "."));
    per.set(a.date, arr);
  }
  const bagian = [...per.entries()].map(([date, jams]) => {
    const [, m, d] = date.split("-").map(Number);
    return `${d} ${BULAN[m - 1]} ${jams.join(", ")}`;
  });
  return ` Alternatif: ${bagian.join("; ")}.`;
}

export function pesanDitolak(hasil: CekSlotError): string {
  return hasil.error + formatAlternatif(hasil.alternatif);
}
