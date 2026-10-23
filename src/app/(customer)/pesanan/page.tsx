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

export const metadata = { title: "Pesanan Saya" };

export default async function PesananPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER") redirect("/login");

  const [services, vehicles, branches, catalog] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Pesanan Saya</h1>
        <p className="mt-1 text-sm text-slate-500">
          Booking, status, &amp; riwayat servis kamu
        </p>
      </div>

      <BookingSection
        vehicles={vehicles}
        branches={branches}
        catalog={catalog}
      />

      <div className="space-y-2">
        {services.length === 0 && (
          <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">Belum ada pesanan.</p>
          </div>
        )}
        {services.map((s) => {
          const totalDibayar = s.payments.reduce((sum, p) => sum + p.amount, 0);
          return (
            <div
              key={s.id}
              className="rounded-xl bg-white p-4 ring-1 ring-slate-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-400">{s.code}</p>
                  <p className="font-medium">
                    {s.vehicle.plateNumber} · {s.vehicle.brand}{" "}
                    {s.vehicle.model}
                  </p>
                  <p className="text-sm text-slate-500">
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
                <p className="mt-2 text-sm text-slate-600">{s.complaint}</p>
              )}

              {s.estimate > 0 && (
                <p className="mt-2 text-sm">
                  <span className="text-slate-500">Estimasi: </span>
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
                <p className="mt-2 text-sm text-emerald-600">
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
    </div>
  );
}
