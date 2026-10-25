import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import Link from "next/link";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatRupiah,
  formatTanggalPendek,
} from "@/lib/service-status";
import type { ServiceStatus } from "@db/prisma/client";

export const metadata = { title: "Tugas Saya" };

const ACTIVE_MECHANIC_STATUSES: ServiceStatus[] = [
  "CHECKED_IN",
  "IN_PROGRESS",
  "WAITING_PARTS",
];

export default async function TugasPage() {
  const session = await requireStaffRole(["MECHANIC", "OWNER", "ADMIN"]);
  const isMechanic = session.user.role === "MECHANIC";
  const branchIdStaff = await getStaffBranchId();

  const where = isMechanic
    ? {
        mechanicId: session.user.id,
        status: { in: ACTIVE_MECHANIC_STATUSES },
      }
    : {
        status: { in: ACTIVE_MECHANIC_STATUSES },
        mechanicId: { not: null },
        ...(branchIdStaff ? { branchId: branchIdStaff } : {}),
      };

  const services = await prisma.service.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      vehicle: true,
      customer: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Tugas Saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {services.length} tugas aktif
        </p>
      </div>

      <div className="space-y-2">
        {services.length === 0 && (
          <div className="rounded-xl bg-surface p-6 ring-1 ring-slate-200 shadow-card">
            <p className="text-sm text-muted-foreground">
              Tidak ada tugas aktif saat ini.
            </p>
          </div>
        )}
        {services.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/servis/${s.id}`}
            className="block rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card active:opacity-90"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-400">{s.code}</p>
                <p className="font-medium">
                  {s.vehicle.plateNumber} · {s.vehicle.brand} {s.vehicle.model}
                </p>
                <p className="text-sm text-muted-foreground">
                  {s.customerName ?? s.customer?.name ?? "—"}
                </p>
                {s.complaint && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {s.complaint}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status]}`}
              >
                {STATUS_LABEL[s.status]}
              </span>
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{formatTanggalPendek(s.createdAt)}</span>
              {s.estimate > 0 && (
                <span>Est. {formatRupiah(s.estimate)}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
