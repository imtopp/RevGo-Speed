import { prisma } from "@/lib/prisma";
import { ACTIVE_STATUSES } from "@/lib/service-status";
import type { Prisma } from "@db/prisma/client";
import {
  DURASI_DEFAULT_MENIT,
  HARI_MS,
  jendelaBentrok,
  jendelaDari,
  parseBookingConfig,
  startOfDayWib,
  validasiSlot,
  type BookingConfig,
  type CekSlotHasil,
  type Jendela,
} from "@/lib/availability";

type Db = Pick<typeof prisma, "branch" | "systemSetting" | "service">;

export async function getBookingConfig(db: Db = prisma): Promise<BookingConfig> {
  const rows = await db.systemSetting.findMany({
    where: { key: { startsWith: "booking_" } },
    select: { key: true, value: true },
  });
  return parseBookingConfig(rows);
}

/** Window blokir semua servis AKTIF pada satu hari WIB (window di-cap akhir hari). */
export async function getJendelaAktif(opts: {
  branchId: string;
  epoch: number;
  excludeId?: string;
  bufferMenit: number;
  db?: Db;
}): Promise<Jendela[]> {
  const db = opts.db ?? prisma;
  const hariMulai = startOfDayWib(opts.epoch);
  const rows = await db.service.findMany({
    where: {
      branchId: opts.branchId,
      status: { in: ACTIVE_STATUSES },
      scheduledAt: {
        not: null,
        gte: new Date(hariMulai),
        lte: new Date(hariMulai + HARI_MS - 1),
      },
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
    },
    select: { scheduledAt: true, estimasiMenit: true },
  });
  return rows.map((r) =>
    jendelaDari(
      r.scheduledAt!.getTime(),
      r.estimasiMenit ?? DURASI_DEFAULT_MENIT,
      opts.bufferMenit,
    ),
  );
}

/**
 * ID mekanik yang sudah di-assign ke servis AKTIF lain dengan jendela
 * pengerjaan tumpang tindih pada [epoch, epoch+durasi) di cabang yang sama.
 * Servis tanpa scheduledAt diabaikan (tidak bisa diposisikan dalam waktu).
 */
export async function mekanikSibuk(opts: {
  branchId: string;
  epoch: number | null;
  durasiMenit: number;
  excludeId?: string;
  db?: Db;
}): Promise<Set<string>> {
  if (opts.epoch === null) return new Set();
  const db = opts.db ?? prisma;
  const rows = await db.service.findMany({
    where: {
      branchId: opts.branchId,
      mechanicId: { not: null },
      status: { in: ACTIVE_STATUSES },
      scheduledAt: { not: null },
      ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}),
    },
    select: { mechanicId: true, scheduledAt: true, estimasiMenit: true },
  });
  const sibuk = new Set<string>();
  for (const r of rows) {
    if (
      jendelaBentrok(
        opts.epoch,
        opts.durasiMenit,
        r.scheduledAt!.getTime(),
        r.estimasiMenit ?? DURASI_DEFAULT_MENIT,
      )
    ) {
      sibuk.add(r.mechanicId!);
    }
  }
  return sibuk;
}

export type CekSlotDb = {
  branchId: string;
  epoch: number;
  durasiMenit: number;
  excludeId?: string;
  /** false = alur staff: lead time tidak berlaku. */
  pakaiLeadTime: boolean;
  now?: number;
  db?: Db;
};

export async function cekSlotTersedia(input: CekSlotDb): Promise<CekSlotHasil> {
  const db = input.db ?? prisma;
  const branch = await db.branch.findUnique({ where: { id: input.branchId } });
  if (!branch || !branch.aktif) {
    return { ok: false, error: "Cabang tidak valid.", alternatif: [] };
  }
  const config = await getBookingConfig(db);
  const jendelas = await getJendelaAktif({
    branchId: input.branchId,
    epoch: input.epoch,
    excludeId: input.excludeId,
    bufferMenit: config.bufferMinutes,
    db,
  });
  return validasiSlot({
    epoch: input.epoch,
    now: input.now ?? Date.now(),
    config,
    kuotaParalel: branch.kuotaParalel,
    jamBuka: branch.jamBuka,
    jamTutup: branch.jamTutup,
    hariAktif: branch.hariAktif,
    jendelas,
    durasiMenit: input.durasiMenit,
    pakaiLeadTime: input.pakaiLeadTime,
  });
}

/**
 * Kunci advisory per cabang+tanggal (held sampai commit) — serialisasi cek
 * kapasitas vs pembuatan booking pada slot yang sama (anti double-booking).
 */
export async function kunciSlot(
  tx: Prisma.TransactionClient,
  branchId: string,
  epoch: number,
): Promise<void> {
  const kunci = `slot:${branchId}:${Math.floor(startOfDayWib(epoch) / HARI_MS)}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${kunci}))`;
}
