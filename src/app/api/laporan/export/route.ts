import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { OPNAME_NOTE_PREFIX, opnameDeltaValue } from "@/lib/opname";

/** Parse param tanggal YYYY-MM-DD ketat — nilai aneh jangan pernah jadi Invalid Date. */
function parseDateParam(s: string | null, endOfDay: boolean, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  const d = new Date(s + (endOfDay ? "T23:59:59.999" : "T00:00:00"));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

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

  const now = new Date();
  const from = parseDateParam(
    p.get("from"),
    false,
    new Date(now.getFullYear(), now.getMonth(), 1),
  );
  const to = parseDateParam(
    p.get("to"),
    true,
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
  );
  const branchFilter = branchIdStaff ?? p.get("branch") ?? null;
  const branchWhere = branchFilter ? { branchId: branchFilter } : {};

  const [doneServices, cashflows, opnameMoves] = await Promise.all([
    prisma.service.findMany({
      where: { ...branchWhere, status: "DONE", finishedAt: { gte: from, lte: to } },
      include: {
        parts: { select: { price: true, quantity: true, cost: true } },
        customer: { select: { name: true } },
        vehicle: { select: { plateNumber: true } },
        branch: { select: { name: true } },
      },
      orderBy: { finishedAt: "asc" },
    }),
    prisma.cashflow.findMany({
      where: { ...branchWhere, createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: {
        note: { startsWith: OPNAME_NOTE_PREFIX },
        createdAt: { gte: from, lte: to },
        ...(branchFilter ? { part: { branchId: branchFilter } } : {}),
      },
      include: { part: { select: { buyPrice: true } } },
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
      s.code, s.branch.name, s.customer.name, s.vehicle.plateNumber,
      s.finishedAt ? new Date(s.finishedAt).toLocaleDateString("id-ID") : "",
      revenue, hpp, revenue - hpp,
    ]);
  }
  servisRows.push(["TOTAL", "", "", "", "", totRev, totHpp, totRev - totHpp]);

  // Selisih opname: OUT (hilang) = beban negatif, IN (temuan) = positif.
  const opnameDelta = opnameDeltaValue(
    opnameMoves.map((m) => ({
      type: m.type,
      quantity: m.quantity,
      unitCost: m.part.buyPrice,
    })),
  );
  servisRows.push(["SELISIH OPNAME", "", "", "", "", "", "", opnameDelta]);
  servisRows.push(["LABA BERSIH", "", "", "", "", "", "", totRev - totHpp + opnameDelta]);

  // Bagian 2: arus kas
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
    `LAPORAN SERVIS (${from.toLocaleDateString("id-ID")} - ${to.toLocaleDateString("id-ID")})`,
    "",
    toCsv(servisRows),
    "",
    "ARUS KAS",
    "",
    toCsv(kasRows),
  ].join("\n");

  const filename = `laporan-${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
