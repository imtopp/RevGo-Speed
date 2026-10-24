import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import Link from "next/link";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatRupiah,
  formatTanggalPendek,
  ACTIVE_STATUSES,
} from "@/lib/service-status";
import { BookingForm } from "./booking-form";
import { buildModelPerMerek } from "@/lib/vehicle";
import type { ServiceStatus } from "@db/prisma/client";

export const metadata = { title: "Servis" };

const FILTERS: { key: string; label: string }[] = [
  { key: "aktif", label: "Aktif" },
  { key: "PENDING", label: "Booking" },
  { key: "WAITING_APPROVAL", label: "Menunggu Setuju" },
  { key: "CONFIRMED", label: "Dikonfirmasi" },
  { key: "CHECKED_IN", label: "Di Tempat" },
  { key: "IN_PROGRESS", label: "Dikerjakan" },
  { key: "WAITING_PARTS", label: "Menunggu Part" },
  { key: "DONE", label: "Selesai" },
  { key: "semua", label: "Semua" },
];

export default async function ServisPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; booking?: string }>;
}) {
  await requireStaffRole(["OWNER", "ADMIN"]);
  const branchIdStaff = await getStaffBranchId();
  const params = await searchParams;
  // Validasi enum status dari URL — nilai asing jangan pernah masuk query Prisma.
  const rawFilter = params.status ?? "aktif";
  const filter = FILTERS.some((f) => f.key === rawFilter) ? rawFilter : "aktif";
  const showBooking = params.booking === "1";

  const where = {
    ...(branchIdStaff ? { branchId: branchIdStaff } : {}),
    ...(filter === "semua"
      ? {}
      : filter === "aktif"
        ? { status: { in: ACTIVE_STATUSES } }
        : { status: filter as ServiceStatus }),
  };

  const [services, branches, catalog, modelRows] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: true,
        customer: { select: { name: true, phone: true } },
        mechanic: { select: { name: true } },
      },
    }),
    prisma.branch.findMany({
      where: { aktif: true, ...(branchIdStaff ? { id: branchIdStaff } : {}) },
      orderBy: { name: "asc" },
    }),
    prisma.serviceCatalog.findMany({
      where: { aktif: true },
      orderBy: { nama: "asc" },
    }),
    prisma.vehicle.findMany({
      distinct: ["brand", "model"],
      select: { brand: true, model: true },
      orderBy: { model: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Servis</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {services.length} servis · papan kerja
          </p>
          <Link
            href="/dashboard/katalog"
            className="mt-1 inline-block text-sm font-medium text-muted-foreground underline underline-offset-2"
          >
            Kelola katalog →
          </Link>
        </div>
        <Link
          href={showBooking ? "/dashboard/servis" : "/dashboard/servis?booking=1"}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white active:opacity-90"
        >
          {showBooking ? "Tutup Booking Servis" : "+ Booking Servis"}
        </Link>
      </div>

      {showBooking && (
        <BookingForm
          branches={branches}
          catalog={catalog}
          modelPerMerek={buildModelPerMerek(modelRows)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={`/dashboard/servis?status=${f.key}${showBooking ? "&booking=1" : ""}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-primary text-white"
                  : "bg-surface text-muted-foreground ring-1 ring-slate-200 shadow-card"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Papan kerja: list servis */}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {services.length === 0 && (
          <div className="col-span-full rounded-xl bg-surface p-6 ring-1 ring-slate-200 shadow-card">
            <p className="text-sm text-muted-foreground">
              Tidak ada servis pada filter ini.
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
                  {s.customer.name}
                  {s.mechanic ? ` · ${s.mechanic.name}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status]}`}
                >
                  {STATUS_LABEL[s.status]}
                </span>
                <p className="mt-1 text-xs text-slate-400">
                  {formatTanggalPendek(s.createdAt)}
                </p>
              </div>
            </div>
            {s.estimate > 0 && (
              <p className="mt-2 text-sm font-medium text-foreground">
                Est. {formatRupiah(s.estimate)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
