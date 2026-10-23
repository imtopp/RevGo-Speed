import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { formatRupiah, STATUS_LABEL } from "@/lib/service-status";
import { PaymentForm } from "../kas/payment-form";
import Link from "next/link";

export const metadata = { title: "Piutang" };

export default async function PiutangPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const params = await searchParams;
  const branchIdStaff = await getStaffBranchId();

  const branches = await prisma.branch.findMany({
    where: { aktif: true },
    orderBy: { name: "asc" },
  });
  const activeBranchId = branchIdStaff ?? params.branch ?? branches[0]?.id ?? null;
  const branchFilter = branchIdStaff ? branchIdStaff : activeBranchId;

  const services = await prisma.service.findMany({
    where: branchFilter
      ? { branchId: branchFilter, status: { not: "CANCELLED" } }
      : { status: { not: "CANCELLED" } },
    include: {
      parts: { select: { price: true, quantity: true } },
      payments: { select: { amount: true } },
      customer: { select: { name: true } },
      vehicle: { select: { plateNumber: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Filter sisa tagihan > 0
  const outstanding = services
    .map((s) => {
      const total =
        s.laborCost + s.parts.reduce((sum, p) => sum + p.price * p.quantity, 0);
      const paid = s.payments.reduce((sum, p) => sum + p.amount, 0);
      return { ...s, total, paid, remaining: total - paid };
    })
    .filter((s) => s.remaining > 0);

  const totalPiutang = outstanding.reduce((sum, s) => sum + s.remaining, 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Piutang</h1>
        <p className="mt-1 text-sm text-slate-500">
          {outstanding.length} servis belum lunas · total{" "}
          {formatRupiah(totalPiutang)}
        </p>
      </div>

      {outstanding.length === 0 && (
        <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Tidak ada piutang. Semua lunas 🎉</p>
        </div>
      )}

      <div className="space-y-3">
        {outstanding.map((s) => (
          <div key={s.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/dashboard/servis/${s.id}`}
                  className="font-medium text-slate-900 underline underline-offset-2"
                >
                  {s.code}
                </Link>
                <p className="text-sm text-slate-500">
                  {s.customer.name} · {s.vehicle.plateNumber}
                </p>
                <p className="text-xs text-slate-400">
                  {STATUS_LABEL[s.status]} · {s.branch.name}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-red-600">
                  {formatRupiah(s.remaining)}
                </p>
                <p className="text-xs text-slate-400">
                  dari {formatRupiah(s.total)} · lunas {formatRupiah(s.paid)}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <PaymentForm serviceId={s.id} remaining={s.remaining} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
