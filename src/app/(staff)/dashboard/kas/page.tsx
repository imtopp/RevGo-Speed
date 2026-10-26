import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { formatRupiah } from "@/lib/service-status";
import { ManualCashflowForm, RiwayatList } from "./kas-panels";
import { BranchPicker } from "../stok/branch-picker";

export const metadata = { title: "Kas" };

export default async function KasPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
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

  const flows = await prisma.cashflow.findMany({
    where: branchFilter ? { branchId: branchFilter } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Saldo per kantong = Σ INCOME − Σ EXPENSE
  const saldo = { KAS: 0, BANK: 0 };
  for (const f of flows) {
    saldo[f.account] += f.type === "INCOME" ? f.amount : -f.amount;
  }

  // Total seluruh riwayat (bukan cuma 100 terakhir) untuk akurasi saldo
  const agg = await prisma.cashflow.groupBy({
    by: ["account", "type"],
    where: branchFilter ? { branchId: branchFilter } : {},
    _sum: { amount: true },
  });
  const totalKas = agg
    .filter((a) => a.account === "KAS")
    .reduce((s, a) => s + (a.type === "INCOME" ? a._sum.amount ?? 0 : -(a._sum.amount ?? 0)), 0);
  const totalBank = agg
    .filter((a) => a.account === "BANK")
    .reduce((s, a) => s + (a.type === "INCOME" ? a._sum.amount ?? 0 : -(a._sum.amount ?? 0)), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Kas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Arus kas bengkel</p>
        </div>
        {!branchIdStaff && branches.length > 1 && (
          <BranchPicker
            branches={branches}
            current={activeBranchId}
            basePath="/dashboard/kas"
          />
        )}
      </div>

      {/* Ringkasan kantong */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm text-muted-foreground">Kantong Kas</p>
          <p className="mt-1 text-xl font-bold text-foreground">{formatRupiah(totalKas)}</p>
        </div>
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm text-muted-foreground">Kantong Bank</p>
          <p className="mt-1 text-xl font-bold text-foreground">{formatRupiah(totalBank)}</p>
        </div>
      </div>

      <ManualCashflowForm
        branches={branches}
        activeBranchId={activeBranchId}
        isLocked={!!branchIdStaff}
      />

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">
          Riwayat (100 terakhir)
        </p>
        <RiwayatList items={flows} />
      </div>
    </div>
  );
}
