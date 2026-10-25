import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/service-status";
import {
  HARI_MS,
  daftarSlot,
  daftarTanggal,
  dateStrOf,
  jendelaDari,
  startOfDayWib,
  statusTanggal,
  type Jendela,
} from "@/lib/availability";
import { getBookingConfig } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branch") ?? "";
  const date = url.searchParams.get("date");
  if (!branchId) {
    return NextResponse.json({ error: "branch wajib diisi." }, { status: 400 });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date tidak valid." }, { status: 400 });
  }

  const branch = await prisma.branch.findFirst({ where: { id: branchId, aktif: true } });
  if (!branch) {
    return NextResponse.json({ error: "Cabang tidak ditemukan." }, { status: 404 });
  }

  const config = await getBookingConfig();
  const now = Date.now();
  const tanggalList = daftarTanggal(now, config.horizonDays);
  const hariMulai = startOfDayWib(now);
  const hariAkhir = hariMulai + config.horizonDays * HARI_MS + HARI_MS - 1;

  const rows = await prisma.service.findMany({
    where: {
      branchId,
      status: { in: ACTIVE_STATUSES },
      scheduledAt: { not: null, gte: new Date(hariMulai), lte: new Date(hariAkhir) },
    },
    select: { scheduledAt: true, estimasiMenit: true },
  });

  const perTanggal = new Map<string, Jendela[]>();
  for (const r of rows) {
    const mulai = r.scheduledAt!.getTime();
    const ds = dateStrOf(mulai);
    const arr = perTanggal.get(ds) ?? [];
    arr.push(
      jendelaDari(mulai, r.estimasiMenit ?? 60, config.bufferMinutes),
    );
    perTanggal.set(ds, arr);
  }

  const tanggal = tanggalList.map((d) => ({
    date: d,
    status: statusTanggal({
      dateStr: d,
      now,
      jamBuka: branch.jamBuka,
      jamTutup: branch.jamTutup,
      hariAktif: branch.hariAktif,
      kuotaParalel: branch.kuotaParalel,
      jendelas: perTanggal.get(d) ?? [],
    }),
  }));

  let slots: ReturnType<typeof daftarSlot> | null = null;
  let statusDipilih: string | null = null;
  if (date) {
    statusDipilih = tanggalList.includes(date)
      ? (tanggal.find((t) => t.date === date)?.status ?? "tutup")
      : "lewat";
    slots = statusDipilih === "kosong" || statusDipilih === "penuh"
      ? daftarSlot({
          dateStr: date,
          jamBuka: branch.jamBuka,
          jamTutup: branch.jamTutup,
          kuotaParalel: branch.kuotaParalel,
          jendelas: perTanggal.get(date) ?? [],
        })
      : [];
  }

  return NextResponse.json(
    {
      ok: true,
      now,
      jamBuka: branch.jamBuka,
      jamTutup: branch.jamTutup,
      hariAktif: branch.hariAktif,
      kuotaParalel: branch.kuotaParalel,
      config,
      tanggal,
      slots,
      statusDipilih,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
