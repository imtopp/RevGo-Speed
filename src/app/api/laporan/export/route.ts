import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { periodeWIB } from "@/lib/service-status";
import { OPNAME_NOTE_PREFIX, opnameDeltaValue } from "@/lib/opname";
import { totalPenjualan } from "@/lib/sale";

function csvEscape(v: unknown): string {
  let s = String(v ?? "");
  // Anti formula-injection Excel: sel berawalan = + - @ ditulis sebagai teks.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export async function GET(request: Request) {
  await requireStaffRole(["OWNER", "ADMIN"]);
  const branchIdStaff = await getStaffBranchId();
  const url = new URL(request.url);
  const p = url.searchParams;

  // Rentang WIB setengah terbuka [gte, lt) — default bulan berjalan WIB,
  // sinkron dengan halaman laporan (bukan waktu lokal server/UTC).
  const periode = periodeWIB(p.get("from"), p.get("to"));
  const branchFilter = branchIdStaff ?? p.get("branch") ?? null;
  const branchWhere = branchFilter ? { branchId: branchFilter } : {};

  const [doneServices, cashflows, opnameMoves, partSales] = await Promise.all([
    prisma.service.findMany({
      where: {
        ...branchWhere,
        status: "DONE",
        finishedAt: { gte: periode.gte, lt: periode.lt },
      },
      include: {
        parts: { select: { price: true, quantity: true, cost: true } },
        customer: { select: { name: true } },
        vehicle: { select: { plateNumber: true } },
        branch: { select: { name: true } },
      },
      orderBy: { finishedAt: "asc" },
    }),
    prisma.cashflow.findMany({
      where: { ...branchWhere, createdAt: { gte: periode.gte, lt: periode.lt } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: {
        note: { startsWith: OPNAME_NOTE_PREFIX },
        createdAt: { gte: periode.gte, lt: periode.lt },
        ...(branchFilter ? { part: { branchId: branchFilter } } : {}),
      },
      include: { part: { select: { buyPrice: true } } },
    }),
    prisma.partSale.findMany({
      where: { ...branchWhere, soldAt: { gte: periode.gte, lt: periode.lt } },
      include: { items: { select: { quantity: true, price: true, cost: true } } },
      orderBy: { soldAt: "asc" },
    }),
  ]);

  // Bagian 1: laba per servis
  const servisRows: unknown[][] = [
    ["Kode", "Cabang", "Customer", "Plat", "Selesai", "Pendapatan", "HPP", "Laba"],
  ];
  let totRev = 0, totHpp = 0;
  for (const s of doneServices) {
    const revenue = s.laborCost + s.parts.reduce((x, p) => x + p.price * p.quantity, 0);
    const hpp = s.parts.reduce((x, p) => x + p.cost * p.quantity, 0);
    totRev += revenue; totHpp += hpp;
    servisRows.push([
      s.code, s.branch.name, s.customerName ?? s.customer?.name ?? "",
      s.vehicle.plateNumber,
      s.finishedAt ? new Date(s.finishedAt).toLocaleDateString("id-ID") : "",
      revenue, hpp, revenue - hpp,
    ]);
  }
  servisRows.push(["TOTAL", "", "", "", "", totRev, totHpp, totRev - totHpp]);

  // Selisih opname: OUT (hilang) = beban negatif, IN (temuan) = positif.
  // Cost gerakan = snapshot saat kejadian; part lama fallback buyPrice.
  const opnameDelta = opnameDeltaValue(
    opnameMoves.map((m) => ({
      type: m.type,
      quantity: m.quantity,
      unitCost: m.cost ?? m.part.buyPrice,
    })),
  );
  servisRows.push(["SELISIH OPNAME", "", "", "", "", "", "", opnameDelta]);

  // Bagian 2: penjualan part tanpa servis
  const jualRows: unknown[][] = [
    ["Kode", "Tanggal", "Item", "Pendapatan", "HPP", "Laba"],
  ];
  let totJual = 0, totHppJual = 0;
  for (const sale of partSales) {
    const rev = totalPenjualan(sale.items);
    const hpp = sale.items.reduce((x, i) => x + i.cost * i.quantity, 0);
    totJual += rev; totHppJual += hpp;
    jualRows.push([
      sale.code,
      new Date(sale.soldAt).toLocaleDateString("id-ID"),
      sale.items.length,
      rev, hpp, rev - hpp,
    ]);
  }
  jualRows.push(["TOTAL", "", "", totJual, totHppJual, totJual - totHppJual]);
  const labaJualPart = totJual - totHppJual;
  servisRows.push([
    "LABA BERSIH", "", "", "", "", "", "",
    totRev - totHpp + opnameDelta + labaJualPart,
  ]);

  // Bagian 3: arus kas
  const kasRows: unknown[][] = [
    ["Tanggal", "Tipe", "Kategori", "Kantong", "Jumlah", "Keterangan"],
  ];
  for (const c of cashflows) {
    kasRows.push([
      new Date(c.createdAt).toLocaleDateString("id-ID"), c.type, c.category,
      c.account, c.amount, c.description ?? "",
    ]);
  }

  const body = [
    `LAPORAN SERVIS (${periode.dari} - ${periode.sampai})`,
    "",
    toCsv(servisRows),
    "",
    "PENJUALAN PART (TANPA SERVIS)",
    "",
    toCsv(jualRows),
    "",
    "ARUS KAS",
    "",
    toCsv(kasRows),
  ].join("\n");

  const filename = `laporan-${periode.dari}_${periode.sampai}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
