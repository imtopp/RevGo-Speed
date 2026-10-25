import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  NEXT_ACTION_LABEL,
  formatRupiah,
  formatTanggal,
  formatTanggalWIB,
} from "@/lib/service-status";
import { ActionForms } from "./action-forms";
import { VoidPaymentForm } from "./void-payment";
import { PaymentForm } from "../../kas/payment-form";
import { formatTanggalPendek } from "@/lib/service-status";

export const metadata = { title: "Detail Servis" };

export default async function ServisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffRole([
    "OWNER",
    "ADMIN",
    "MECHANIC",
  ]);
  const { id } = await params;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      vehicle: { include: { owner: true } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
      mechanic: { select: { id: true, name: true } },
      branch: true,
      catalog: true,
      parts: { include: { part: true } },
      payments: true,
    },
  });
  if (!service) notFound();

  // Scoping cabang: ADMIN/MECHANIC tidak boleh membuka servis cabang lain.
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && service.branchId !== branchIdStaff) notFound();

  const isMechanic = session.user.role === "MECHANIC";
  const isOwner = session.user.role === "OWNER";
  const isAssignedMechanic =
    isMechanic && service.mechanicId === session.user.id;
  const canAct = !isMechanic || isAssignedMechanic;

  const mechanics = await prisma.user.findMany({
    where: { role: "MECHANIC", isActive: true, branchId: service.branchId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const parts = await prisma.part.findMany({
    where: { branchId: service.branchId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, unit: true, quantity: true, sellPrice: true },
  });

  const totalPartHarga = service.parts.reduce(
    (sum, p) => sum + p.price * p.quantity,
    0,
  );
  const totalTagihan = totalPartHarga + service.laborCost;
  const totalPaid = service.payments
    .filter((p) => !p.voidedAt)
    .reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalTagihan - totalPaid;

  const timeline = [
    service.createdAt && { label: "Booking dibuat", at: service.createdAt },
    service.scheduledAt && {
      label: "Kedatangan / Jadwal",
      at: service.scheduledAt,
      wib: true,
    },
    service.checkedInAt && { label: "Unit diterima", at: service.checkedInAt },
    service.startedAt && { label: "Mulai kerja", at: service.startedAt },
    service.finishedAt && { label: "Selesai dikerjakan", at: service.finishedAt },
  ].filter(Boolean) as { label: string; at: Date; wib?: boolean }[];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard/servis"
          className="text-sm text-muted-foreground underline underline-offset-2"
        >
          ← Kembali ke daftar
        </Link>
        {!isMechanic && (
          <Link
            href={`/dashboard/servis/${service.id}/cetak`}
            className="ml-3 text-sm font-medium text-foreground underline underline-offset-2"
          >
            🖨 Cetak Nota
          </Link>
        )}
        <div className="mt-2 flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm text-slate-400">{service.code}</p>
            <h1 className="text-xl font-bold tracking-tight">
              {service.vehicle.plateNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              {service.vehicle.brand} {service.vehicle.model} ·{" "}
              {service.customer.name}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[service.status]}`}
          >
            {STATUS_LABEL[service.status]}
          </span>
        </div>
      </div>

      {/* Info dasar */}
      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Cabang</dt>
            <dd className="font-medium">{service.branch.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sumber</dt>
            <dd className="font-medium">
              {service.source === "APP" ? "Booking App" : "Input Admin"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Mekanik</dt>
            <dd className="font-medium">{service.mechanic?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Jenis Jasa</dt>
            <dd className="font-medium">{service.catalog?.nama ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Keluhan</dt>
            <dd>{service.complaint ?? "—"}</dd>
          </div>
          {service.diagnosis && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Diagnosis / Catatan</dt>
              <dd>{service.diagnosis}</dd>
            </div>
          )}
          {service.cancelReason && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Alasan Batal</dt>
              <dd className="text-danger">{service.cancelReason}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Timeline */}
      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Riwayat</h2>
        <ul className="mt-2 space-y-1.5">
          {timeline.map((t) => (
            <li key={t.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t.label}</span>
              <span className="text-slate-400">
                {t.wib ? formatTanggalWIB(t.at) : formatTanggal(t.at)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Part terpakai */}
      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Part Terpakai</h2>
          <span className="text-sm text-muted-foreground">
            {formatRupiah(totalPartHarga)}
          </span>
        </div>
        {service.parts.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada part.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {service.parts.map((sp) => (
              <li
                key={sp.id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <div>
                  <p>{sp.part.name}</p>
                  <p className="text-xs text-slate-400">
                    {sp.quantity} {sp.part.unit} × {formatRupiah(sp.price)}
                  </p>
                </div>
                <span className="font-medium">
                  {formatRupiah(sp.price * sp.quantity)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Biaya jasa</span>
            <span>{formatRupiah(service.laborCost)}</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span>Total tagihan</span>
            <span>{formatRupiah(totalTagihan)}</span>
          </div>
        </div>
      </div>

      {/* Pembayaran */}
      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Pembayaran</h2>
        {service.payments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Belum ada pembayaran.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {service.payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className={p.voidedAt ? "opacity-60" : ""}>
                  <p>
                    {p.kind === "DP" ? "DP" : "Bayar"} · {p.method}
                    {p.voidedAt && (
                      <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-danger">
                        DIBATALKAN
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatTanggalPendek(p.paidAt)}
                    {p.note ? ` · ${p.note}` : ""}
                    {p.voidedAt ? ` · ${p.voidReason}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`font-medium ${
                      p.voidedAt ? "text-slate-400 line-through" : ""
                    }`}
                  >
                    {formatRupiah(p.amount)}
                  </span>
                  {isOwner && !p.voidedAt && (
                    <VoidPaymentForm paymentId={p.id} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sudah dibayar</span>
            <span>{formatRupiah(totalPaid)}</span>
          </div>
          <div
            className={`mt-1 flex justify-between font-semibold ${
              remaining > 0 ? "text-danger" : "text-success"
            }`}
          >
            <span>{remaining > 0 ? "Sisa tagihan" : "Status"}</span>
            <span>
              {remaining > 0 ? formatRupiah(remaining) : "LUNAS"}
            </span>
          </div>
        </div>
      </div>

      {/* Form bayar (admin/owner, sisa > 0, servis belum batal) */}
      {!isMechanic && service.status !== "CANCELLED" && remaining > 0 && (
        <PaymentForm serviceId={service.id} remaining={remaining} />
      )}

      {/* Aksi contextual */}
      {canAct && service.status !== "DONE" && service.status !== "CANCELLED" && (
        <>
          <ActionForms
            service={{
              id: service.id,
              branchId: service.branchId,
              status: service.status,
              estimate: service.estimate,
              laborCost: service.laborCost,
              mechanicId: service.mechanicId,
              scheduledAt: service.scheduledAt,
              complaint: service.complaint,
            }}
            mechanics={mechanics}
            parts={parts}
            isMechanic={isMechanic}
            isAssignedMechanic={isAssignedMechanic}
          />
          {/* Sticky action bar — mobile, zona jempol */}
          <div className="sticky bottom-[45px] z-30 md:hidden">
            <a
              href="#aksi"
              className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-4 py-3 shadow-card"
            >
              <span className="min-w-0 truncate text-sm font-medium text-white">
                {NEXT_ACTION_LABEL[service.status]}
              </span>
              <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">
                Buka Aksi Servis
              </span>
            </a>
          </div>
        </>
      )}

      {(service.status === "DONE" || service.status === "CANCELLED") && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm text-muted-foreground">
            {service.status === "DONE"
              ? remaining > 0
                ? `Sisa tagihan ${formatRupiah(remaining)} — lunasi lewat form bayar di halaman ini atau di modul Kas.`
                : "Servis selesai dan tagihan sudah lunas."
              : `Servis sudah ${STATUS_LABEL[service.status].toLowerCase()}.`}
          </p>
        </div>
      )}
    </div>
  );
}
