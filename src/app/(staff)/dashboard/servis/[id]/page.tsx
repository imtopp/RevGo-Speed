import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  formatRupiah,
  formatTanggal,
} from "@/lib/service-status";
import { ActionForms } from "./action-forms";
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
    "SYS_ADMIN",
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

  const isMechanic = session.user.role === "MECHANIC";
  const isAssignedMechanic =
    isMechanic && service.mechanicId === session.user.id;
  const canAct = !isMechanic || isAssignedMechanic;

  const mechanics = await prisma.user.findMany({
    where: { role: "MECHANIC", isActive: true },
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
  const totalPaid = service.payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalTagihan - totalPaid;

  const timeline = [
    service.createdAt && { label: "Booking dibuat", at: service.createdAt },
    service.scheduledAt && { label: "Jadwal", at: service.scheduledAt },
    service.checkedInAt && { label: "Unit diterima", at: service.checkedInAt },
    service.startedAt && { label: "Mulai kerja", at: service.startedAt },
    service.finishedAt && { label: "Selesai dikerjakan", at: service.finishedAt },
  ].filter(Boolean) as { label: string; at: Date }[];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard/servis"
          className="text-sm text-slate-500 underline underline-offset-2"
        >
          ← Kembali ke daftar
        </Link>
        {!isMechanic && (
          <Link
            href={`/dashboard/servis/${service.id}/cetak`}
            className="ml-3 text-sm font-medium text-slate-700 underline underline-offset-2"
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
            <p className="text-sm text-slate-500">
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
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Cabang</dt>
            <dd className="font-medium">{service.branch.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Sumber</dt>
            <dd className="font-medium">
              {service.source === "APP" ? "Booking App" : "Input Admin"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Mekanik</dt>
            <dd className="font-medium">{service.mechanic?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Jenis Jasa</dt>
            <dd className="font-medium">{service.catalog?.nama ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-500">Keluhan</dt>
            <dd>{service.complaint ?? "—"}</dd>
          </div>
          {service.diagnosis && (
            <div className="col-span-2">
              <dt className="text-slate-500">Diagnosis / Catatan</dt>
              <dd>{service.diagnosis}</dd>
            </div>
          )}
          {service.cancelReason && (
            <div className="col-span-2">
              <dt className="text-slate-500">Alasan Batal</dt>
              <dd className="text-red-600">{service.cancelReason}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Timeline */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">Riwayat</h2>
        <ul className="mt-2 space-y-1.5">
          {timeline.map((t) => (
            <li key={t.label} className="flex justify-between text-sm">
              <span className="text-slate-600">{t.label}</span>
              <span className="text-slate-400">{formatTanggal(t.at)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Part terpakai */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Part Terpakai</h2>
          <span className="text-sm text-slate-500">
            {formatRupiah(totalPartHarga)}
          </span>
        </div>
        {service.parts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum ada part.</p>
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
            <span className="text-slate-500">Biaya jasa</span>
            <span>{formatRupiah(service.laborCost)}</span>
          </div>
          <div className="mt-1 flex justify-between font-semibold">
            <span>Total tagihan</span>
            <span>{formatRupiah(totalTagihan)}</span>
          </div>
        </div>
      </div>

      {/* Pembayaran */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">Pembayaran</h2>
        {service.payments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Belum ada pembayaran.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {service.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p>
                    {p.kind === "DP" ? "DP" : "Bayar"} · {p.method}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatTanggalPendek(p.paidAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <span className="font-medium">{formatRupiah(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Sudah dibayar</span>
            <span>{formatRupiah(totalPaid)}</span>
          </div>
          <div
            className={`mt-1 flex justify-between font-semibold ${
              remaining > 0 ? "text-red-600" : "text-emerald-600"
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
        <ActionForms
          service={{
            id: service.id,
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
      )}

      {(service.status === "DONE" || service.status === "CANCELLED") && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">
            Servis sudah {STATUS_LABEL[service.status].toLowerCase()}.{" "}
            {service.status === "DONE" && "Pembayaran & pelunasan di modul Kas."}
          </p>
        </div>
      )}
    </div>
  );
}
