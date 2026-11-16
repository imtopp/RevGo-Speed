import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatRupiah,
  formatTanggalPendek,
  formatTanggalWIB,
  totalTagihan,
} from "@/lib/service-status";
import { BookingSection } from "./booking-section";
import { DpInfoCard } from "./dp-card";
import { buildModelPerMerek, merekGroupsTampil } from "@/lib/vehicle";
import { getBranding } from "@/lib/branding";
import { getDpConfig, dpAktif } from "@/lib/dp";
import { pushEnabled } from "@/lib/push";
import { PushOptInCard } from "@/components/push-opt-in-card";
import { waLink, pesanKonfirmasiBooking } from "@/lib/wa";
import { muatTemplateNotif } from "@/lib/notif-template-db";
import type { ServiceStatus } from "@db/prisma/client";

export const metadata = { title: "Pesanan Saya" };

const NEXT_STEP: Record<ServiceStatus, string> = {
  WAITING_DP: "Booking diterima — bayar DP dulu agar jadwal dikunci.",
  PENDING: "Menunggu bengkel memberi estimasi.",
  WAITING_APPROVAL: "Estimasi sudah dikirim — menunggu konfirmasi bengkel.",
  CONFIRMED: "Booking dikonfirmasi — antar unit sesuai jadwal.",
  CHECKED_IN: "Unit sudah diterima — menunggu pemeriksaan & pengerjaan.",
  IN_PROGRESS: "Servis sedang dikerjakan oleh mekanik.",
  WAITING_PARTS: "Menunggu part — bengkel akan melanjutkan.",
  DONE: "Servis selesai.",
  CANCELLED: "Servis dibatalkan.",
};

type PartRincian = {
  price: number;
  quantity: number;
  part?: { name: string } | null;
};
type JasaRincian = { name: string; price: number };

/** Blok rincian biaya customer: jasa utama + jasa tambahan + part + total. */
function RincianBiaya({
  laborCost,
  parts,
  labors,
}: {
  laborCost: number;
  parts: PartRincian[];
  labors: JasaRincian[];
}) {
  const total = totalTagihan(laborCost, parts, labors);
  if (total <= 0) return null;
  return (
    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
      <p className="font-medium text-foreground">Rincian biaya</p>
      <div className="mt-1 space-y-0.5">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Jasa servis</span>
          <span className="shrink-0">{formatRupiah(laborCost)}</span>
        </div>
        {labors.map((l) => (
          <div key={l.name + l.price} className="flex justify-between gap-2">
            <span className="min-w-0 truncate text-muted-foreground">
              {l.name}
            </span>
            <span className="shrink-0">{formatRupiah(l.price)}</span>
          </div>
        ))}
        {parts.map((p) => (
          <div
            key={(p.part?.name ?? "part") + p.price + p.quantity}
            className="flex justify-between gap-2"
          >
            <span className="min-w-0 truncate text-muted-foreground">
              Part{p.part?.name ? ` · ${p.part.name}` : ""} × {p.quantity}
            </span>
            <span className="shrink-0">
              {formatRupiah(p.price * p.quantity)}
            </span>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-2 border-t border-slate-200 pt-1 font-semibold">
          <span>Total</span>
          <span className="shrink-0">{formatRupiah(total)}</span>
        </div>
      </div>
    </div>
  );
}

export default async function PesananPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER") redirect("/login");

  const { appName, waNumber } = await getBranding();
  const dpCfg = await getDpConfig();

  const [services, vehicles, branches, catalog, modelRows, tplNotif] =
    await Promise.all([
    prisma.service.findMany({
      // Syarat ganda: milik akun ini, ATAU booking walk-in pada kendaraan
      // yang sudah diadopsi (customerId null tapi vehicle.ownerId = saya).
      where: {
        OR: [
          { customerId: session.user.id },
          { vehicle: { ownerId: session.user.id } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        vehicle: true,
        branch: { select: { name: true } },
        payments: true,
        parts: {
          select: {
            price: true,
            quantity: true,
            part: { select: { name: true } },
          },
        },
        labors: { select: { name: true, price: true } },
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
      orderBy: { brand: "asc" },
    }),
    muatTemplateNotif(),
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
              {active.scheduledAt && (
                <p className="text-sm font-medium text-foreground">
                  Kedatangan: {formatTanggalWIB(active.scheduledAt)}
                </p>
              )}
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

          <RincianBiaya
            laborCost={active.laborCost}
            parts={active.parts}
            labors={active.labors}
          />

          {active.status === "WAITING_DP" && dpAktif(dpCfg) && (
            <DpInfoCard
              id={active.id}
              dp={dpCfg}
              appName={appName}
              waNumber={waNumber}
              code={active.code}
              customerName={session.user.name ?? ""}
              tplWaDp={tplNotif["wa.konfirmasi_dp"]?.body}
            />
          )}

          {waNumber && (
            <a
              href={waLink(
                waNumber,
              pesanKonfirmasiBooking({
                appName,
                code: active.code,
                kendaraan: `${active.vehicle.plateNumber} · ${active.vehicle.brand} ${active.vehicle.model}`,
                layanan: active.complaint,
                jadwal: active.scheduledAt
                  ? formatTanggalWIB(active.scheduledAt)
                  : null,
                tpl: tplNotif["wa.konfirmasi_booking"]?.body,
              }),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center rounded-lg bg-success px-3 py-2 text-sm font-medium text-white active:opacity-90"
            >
              Konfirmasi via WhatsApp &rarr;
            </a>
          )}
        </div>
      )}

      <BookingSection
        vehicles={vehicles}
        branches={branches}
        catalog={catalog}
        modelPerMerek={buildModelPerMerek(modelRows)}
        merekGroups={merekGroupsTampil()}
        appName={appName}
        waNumber={waNumber}
        tplWaKonfirmasi={tplNotif["wa.konfirmasi_booking"]?.body}
        customerName={session.user.name ?? ""}
        tplWaDp={tplNotif["wa.konfirmasi_dp"]?.body}
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
          const total = totalTagihan(s.laborCost, s.parts, s.labors);
          const sisa = total - totalDibayar;
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
                  {s.scheduledAt && (
                    <p className="text-sm text-foreground">
                      Kedatangan: {formatTanggalWIB(s.scheduledAt)}
                    </p>
                  )}
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

              <RincianBiaya
                laborCost={s.laborCost}
                parts={s.parts}
                labors={s.labors}
              />

              {s.status === "DONE" && (sisa > 0 || totalDibayar > 0) && (
                <p className="mt-2 text-sm">
                  {sisa > 0 ? (
                    <>
                      <span className="font-semibold text-danger">
                        Sisa tagihan {formatRupiah(sisa)}
                      </span>
                      {totalDibayar > 0 && (
                        <span className="text-muted-foreground">
                          {" "}
                          · terbayar {formatRupiah(totalDibayar)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-success">
                      Lunas · terbayar {formatRupiah(totalDibayar)}
                    </span>
                  )}
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

      <PushOptInCard enabled={pushEnabled()} konteks="customer" />
    </div>
  );
}
