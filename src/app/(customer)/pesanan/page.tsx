import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatRupiah,
  formatTanggalPendek,
} from "@/lib/service-status";
import { BookingSection, RespondForm } from "./booking-section";
import { buildModelPerMerek } from "@/lib/vehicle";
import type { ServiceStatus } from "@db/prisma/client";

export const metadata = { title: "Pesanan Saya" };

const NEXT_STEP: Record<ServiceStatus, string> = {
  PENDING: "Menunggu bengkel memberi estimasi.",
  WAITING_APPROVAL: "Estimasi sudah dikirim — tinjau di bawah, lalu setujui.",
  CONFIRMED: "Booking dikonfirmasi — antar unit sesuai jadwal.",
  CHECKED_IN: "Unit sudah diterima — menunggu pemeriksaan & pengerjaan.",
  IN_PROGRESS: "Servis sedang dikerjakan oleh mekanik.",
  WAITING_PARTS: "Menunggu part — bengkel akan melanjutkan.",
  DONE: "Servis selesai.",
  CANCELLED: "Servis dibatalkan.",
};

export default async function PesananPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER") redirect("/login");

  const [services, vehicles, branches, catalog, modelRows] = await Promise.all([
    prisma.service.findMany({
      where: { customerId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: true,
        branch: { select: { name: true } },
        payments: true,
      },
    }),
    prisma.vehicle.findMany({
      where: { ownerId: session.user.id },
      orderBy: { plateNumber: "asc" },
    }),
    prisma.branch.findMany({ where: { aktif: true }, orderBy: { name: "asc" } }),
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

  const active = services.find(
    (s) => s.status !== "DONE" && s.status !== "CANCELLED",
  );
  const riwayat = active
    ? services.filter((s) => s.id !== active.id)
    : services;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Pesanan Saya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Booking, status, &amp; riwayat servis kamu
        </p>
      </div>

      {active && (
        <div className="rounded-xl bg-surface p-4 ring-2 ring-primary/30 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                Sedang berjalan
              </p>
              <p className="font-mono text-xs text-slate-400">{active.code}</p>
              <p className="font-medium">
                {active.vehicle.plateNumber} · {active.vehicle.brand}{" "}
                {active.vehicle.model}
              </p>
              <p className="text-sm text-muted-foreground">
                {active.branch.name} · {formatTanggalPendek(active.createdAt)}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[active.status]}`}
            >
              {STATUS_LABEL[active.status]}
            </span>
          </div>

          <p className="mt-2 text-sm font-medium">{NEXT_STEP[active.status]}</p>

          {active.complaint && (
            <p className="mt-1 text-sm text-muted-foreground">
              {active.complaint}
            </p>
          )}

          {active.estimate > 0 && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Estimasi: </span>
              <span className="font-medium">
                {formatRupiah(active.estimate)}
              </span>
            </p>
          )}

          {active.status === "WAITING_APPROVAL" && (
            <div className="mt-3">
              <RespondForm id={active.id} />
            </div>
          )}
        </div>
      )}

      <BookingSection
        vehicles={vehicles}
        branches={branches}
        catalog={catalog}
        modelPerMerek={buildModelPerMerek(modelRows)}
      />

      {services.length === 0 && (
        <div className="rounded-xl bg-surface p-6 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
        </div>
      )}

      {riwayat.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Riwayat</h2>
          {riwayat.map((s) => {
          const totalDibayar = s.payments
            .filter((p) => !p.voidedAt)
            .reduce((sum, p) => sum + p.amount, 0);
          return (
            <div
              key={s.id}
              className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-400">{s.code}</p>
                  <p className="font-medium">
                    {s.vehicle.plateNumber} · {s.vehicle.brand}{" "}
                    {s.vehicle.model}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.branch.name} · {formatTanggalPendek(s.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[s.status]}`}
                >
                  {STATUS_LABEL[s.status]}
                </span>
              </div>

              {s.complaint && (
                <p className="mt-2 text-sm text-muted-foreground">{s.complaint}</p>
              )}

              {s.estimate > 0 && (
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Estimasi: </span>
                  <span className="font-medium">
                    {formatRupiah(s.estimate)}
                  </span>
                </p>
              )}

              {s.status === "WAITING_APPROVAL" && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-amber-700">
                    Estimasi menunggu persetujuanmu:
                  </p>
                  <RespondForm id={s.id} />
                </div>
              )}

              {s.status === "DONE" && totalDibayar > 0 && (
                <p className="mt-2 text-sm text-success">
                  Terbayar {formatRupiah(totalDibayar)}
                </p>
              )}

              {s.cancelReason && (
                <p className="mt-2 text-sm text-red-500">
                  {s.cancelReason}
                </p>
              )}
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}
