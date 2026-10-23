import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/guard";
import Link from "next/link";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatRupiah,
  formatTanggalPendek,
  ACTIVE_STATUSES,
} from "@/lib/service-status";
import { BookingForm } from "./booking-form";
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
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const params = await searchParams;
  const filter = params.status ?? "aktif";
  const showBooking = params.booking === "1";

  const where =
    filter === "semua"
      ? {}
      : filter === "aktif"
        ? { status: { in: ACTIVE_STATUSES } }
        : { status: filter as ServiceStatus };

  const [services, branches, catalog] = await Promise.all([
    prisma.service.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: true,
        customer: { select: { name: true, phone: true } },
        mechanic: { select: { name: true } },
      },
    }),
    prisma.branch.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
    prisma.serviceCatalog.findMany({
      where: { aktif: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Servis</h1>
          <p className="mt-1 text-sm text-slate-500">
            {services.length} servis · papan kerja
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/katalog"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:opacity-90"
          >
            Katalog
          </Link>
          <Link
            href={showBooking ? "/dashboard/servis" : "/dashboard/servis?booking=1"}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:opacity-90"
          >
            {showBooking ? "Tutup" : "+ Booking"}
          </Link>
        </div>
      </div>

      {showBooking && <BookingForm branches={branches} catalog={catalog} />}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Link
              key={f.key}
              href={`/dashboard/servis?status=${f.key}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Papan kerja: list servis */}
      <div className="space-y-2">
        {services.length === 0 && (
          <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">
              Tidak ada servis pada filter ini.
            </p>
          </div>
        )}
        {services.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/servis/${s.id}`}
            className="block rounded-xl bg-white p-4 ring-1 ring-slate-200 active:opacity-90"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-slate-400">{s.code}</p>
                <p className="font-medium">
                  {s.vehicle.plateNumber} · {s.vehicle.brand} {s.vehicle.model}
                </p>
                <p className="text-sm text-slate-500">
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
              <p className="mt-2 text-sm font-medium text-slate-700">
                Est. {formatRupiah(s.estimate)}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
