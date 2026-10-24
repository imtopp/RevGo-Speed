import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { formatRupiah } from "@/lib/service-status";
import { StokPanels } from "./stok-panels";
import { BranchPicker } from "./branch-picker";
import Link from "next/link";

export const metadata = { title: "Stok" };

export default async function StokPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; branch?: string }>;
}) {
  await requireStaffRole(["OWNER", "ADMIN"]);
  const params = await searchParams;
  const tab = params.tab ?? "part";
  const branchIdStaff = await getStaffBranchId();

  const branches = await prisma.branch.findMany({
    where: { aktif: true },
    orderBy: { name: "asc" },
  });
  const activeBranchId = branchIdStaff ?? params.branch ?? branches[0]?.id ?? null;
  const branchFilter = branchIdStaff ? branchIdStaff : activeBranchId;

  const partWhere = branchFilter ? { branchId: branchFilter } : {};

  const [parts, suppliers, movements] = await Promise.all([
    prisma.part.findMany({
      where: partWhere,
      orderBy: { name: "asc" },
      include: { supplier: { select: { nama: true } } },
    }),
    prisma.supplier.findMany({ orderBy: { nama: "asc" } }),
    prisma.stockMovement.findMany({
      where: branchFilter ? { part: { branchId: branchFilter } } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        part: { select: { name: true, unit: true } },
        user: { select: { name: true } },
        supplier: { select: { nama: true } },
      },
    }),
  ]);

  const totalNilai = parts.reduce((s, p) => s + p.quantity * p.buyPrice, 0);
  const lowParts = parts.filter((p) => p.quantity <= p.minStock);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Stok Part</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {parts.length} item · nilai {formatRupiah(totalNilai)}
          </p>
        </div>
        {!branchIdStaff && branches.length > 1 && (
          <BranchPicker branches={branches} current={activeBranchId} tab={tab} />
        )}
      </div>

      {lowParts.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="text-sm font-semibold text-amber-800">
            ⚠ Stok menipis ({lowParts.length})
          </p>
          <ul className="mt-1 space-y-0.5">
            {lowParts.slice(0, 5).map((p) => (
              <li key={p.id} className="text-sm text-amber-700">
                {p.name} — sisa {p.quantity} {p.unit} (min {p.minStock})
              </li>
            ))}
            {lowParts.length > 5 && (
              <li className="text-xs text-amber-600">
                +{lowParts.length - 5} lainnya
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex gap-1">
        {[
          { key: "part", label: "Part" },
          { key: "riwayat", label: "Riwayat" },
          { key: "supplier", label: "Supplier" },
        ].map((t) => (
          <Link
            key={t.key}
            href={`/dashboard/stok?tab=${t.key}${branchFilter ? `&branch=${branchFilter}` : ""}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              tab === t.key
                ? "bg-primary text-white"
                : "bg-surface text-muted-foreground ring-1 ring-slate-200 shadow-card"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <StokPanels
        tab={tab}
        parts={parts}
        suppliers={suppliers}
        movements={movements}
        branches={branches}
        activeBranchId={branchFilter}
        isLockedBranch={!!branchIdStaff}
      />
    </div>
  );
}
