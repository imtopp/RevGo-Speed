import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { formatRupiah, formatTanggalPendek } from "@/lib/service-status";
import Link from "next/link";
import { BranchPicker } from "../stok/branch-picker";
import { SubmitButton } from "@/components/submit-button";
import { DownloadLink } from "@/components/download-link";
import { OPNAME_NOTE_PREFIX, opnameDeltaValue } from "@/lib/opname";

export const metadata = { title: "Laporan" };

function monthBounds() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Parse param YYYY-MM-DD ketat — nilai aneh jangan jadi Invalid Date (500). */
function parseDateParam(s: string | undefined, endOfDay: boolean, fallback: Date): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return fallback;
  const d = new Date(s + (endOfDay ? "T23:59:59.999" : "T00:00:00"));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>;
}) {
  await requireStaffRole(["OWNER", "ADMIN"]);
  const params = await searchParams;
  const branchIdStaff = await getStaffBranchId();

  const branches = await prisma.branch.findMany({
    where: { aktif: true },
    orderBy: { name: "asc" },
  });
  const activeBranchId = branchIdStaff ?? params.branch ?? branches[0]?.id ?? null;
  const branchFilter = branchIdStaff ? branchIdStaff : activeBranchId;

  const bounds = monthBounds();
  const from = parseDateParam(params.from, false, bounds.from);
  const to = parseDateParam(params.to, true, bounds.to);
  const branchWhere = branchFilter ? { branchId: branchFilter } : {};

  const [doneServices, payments, cashflows, opnameMoves] = await Promise.all([
    prisma.service.findMany({
      where: {
        ...branchWhere,
        status: "DONE",
        finishedAt: { gte: from, lte: to },
      },
      include: {
        parts: { select: { price: true, quantity: true, cost: true } },
        customer: { select: { name: true } },
        vehicle: { select: { plateNumber: true } },
      },
      orderBy: { finishedAt: "asc" },
    }),
    prisma.payment.findMany({
      where: { voidedAt: null, paidAt: { gte: from, lte: to } },
      include: { service: { select: { branchId: true } } },
    }),
    prisma.cashflow.findMany({
      where: { ...branchWhere, createdAt: { gte: from, lte: to } },
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

  const scopedPayments = branchFilter
    ? payments.filter((p) => p.service?.branchId === branchFilter)
    : payments;

  // Laba per servis: revenue − HPP (snapshot cost part)
  const rows = doneServices.map((s) => {
    const revenue = s.laborCost + s.parts.reduce((sum, p) => sum + p.price * p.quantity, 0);
    const hpp = s.parts.reduce((sum, p) => sum + p.cost * p.quantity, 0);
    return { s, revenue, hpp, laba: revenue - hpp };
  });
  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalHpp = rows.reduce((sum, r) => sum + r.hpp, 0);

  // Selisih opname periode: OUT (hilang) = beban, IN (temuan) = untung.
  // Divaluasi dengan buyPrice — harga jual part tidak ikut berubah.
  const opnameDelta = opnameDeltaValue(
    opnameMoves.map((m) => ({
      type: m.type,
      quantity: m.quantity,
      unitCost: m.part.buyPrice,
    })),
  );
  const totalLaba = totalRevenue - totalHpp + opnameDelta;

  const omzet = scopedPayments.reduce((sum, p) => sum + p.amount, 0);
  const kasMasuk = cashflows.filter((c) => c.type === "INCOME").reduce((s, c) => s + c.amount, 0);
  const kasKeluar = cashflows.filter((c) => c.type === "EXPENSE").reduce((s, c) => s + c.amount, 0);

  // Rekap per kantong
  const rekap = { KAS: { masuk: 0, keluar: 0 }, BANK: { masuk: 0, keluar: 0 } };
  for (const c of cashflows) {
    if (c.type === "INCOME") rekap[c.account].masuk += c.amount;
    else rekap[c.account].keluar += c.amount;
  }

  const exportUrl = `/api/laporan/export?from=${iso(from)}&to=${iso(to)}${
    branchFilter ? `&branch=${branchFilter}` : ""
  }`;

  const summary = [
    { label: "Omzet (kas masuk bayar)", value: formatRupiah(omzet) },
    { label: "Laba kotor (rev − HPP ± opname)", value: formatRupiah(totalLaba), accent: totalLaba >= 0 },
    { label: "Selisih opname (beban/temuan)", value: formatRupiah(opnameDelta), accent: opnameDelta >= 0 },
    { label: "Servis selesai", value: String(doneServices.length) },
    { label: "Saldo kas periode", value: formatRupiah(kasMasuk - kasKeluar) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Laporan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {from.toLocaleDateString("id-ID")} – {to.toLocaleDateString("id-ID")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!branchIdStaff && branches.length > 1 && (
            <BranchPicker
              branches={branches}
              current={activeBranchId}
              basePath="/dashboard/laporan"
              params={{ from: iso(from), to: iso(to) }}
            />
          )}
          <DownloadLink
            href={exportUrl}
            filename="laporan-revgo.csv"
            className="rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm font-medium text-foreground"
          >
            Export CSV
          </DownloadLink>
        </div>
      </div>

      {/* Filter tanggal */}
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-xl bg-surface p-3 ring-1 ring-slate-200 shadow-card">
        {activeBranchId && <input type="hidden" name="branch" value={activeBranchId} />}
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Dari</label>
          <input type="date" name="from" defaultValue={iso(from)} className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground">Sampai</label>
          <input type="date" name="to" defaultValue={iso(to)} className="mt-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </div>
        <SubmitButton
          pendingText="Menerapkan..."
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
        >
          Terapkan
        </SubmitButton>
      </form>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
            <p className={`text-lg font-bold tabular-nums ${s.accent === false ? "text-danger" : s.accent ? "text-success" : ""}`}>
              {s.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Rekap kantong + Laba per servis — 2 kolom di desktop */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <h2 className="text-sm font-semibold text-foreground">Rekap per Kantong</h2>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1">Kantong</th>
              <th className="py-1 text-right">Masuk</th>
              <th className="py-1 text-right">Keluar</th>
              <th className="py-1 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {(["KAS", "BANK"] as const).map((k) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="py-1.5 font-medium">{k}</td>
                <td className="py-1.5 text-right text-success">{formatRupiah(rekap[k].masuk)}</td>
                <td className="py-1.5 text-right text-danger">{formatRupiah(rekap[k].keluar)}</td>
                <td className="py-1.5 text-right font-semibold">{formatRupiah(rekap[k].masuk - rekap[k].keluar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Laba per servis */}
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Laba per Servis</h2>
          <span className="text-xs text-muted-foreground">
            Rev {formatRupiah(totalRevenue)} · HPP {formatRupiah(totalHpp)}
            {opnameDelta !== 0 && <> · Opname {formatRupiah(opnameDelta)}</>}
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Tidak ada servis selesai di periode ini.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {rows.map(({ s, revenue, hpp, laba }) => (
              <li key={s.id} className="py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/dashboard/servis/${s.id}`} className="font-medium underline underline-offset-2">
                      {s.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {s.customer.name} · {s.vehicle.plateNumber} · {formatTanggalPendek(s.finishedAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-semibold ${laba >= 0 ? "text-success" : "text-danger"}`}>
                      {formatRupiah(laba)}
                    </p>
                    <p className="text-xs text-slate-400">
                      rev {formatRupiah(revenue)} · hpp {formatRupiah(hpp)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>
    </div>
  );
}
