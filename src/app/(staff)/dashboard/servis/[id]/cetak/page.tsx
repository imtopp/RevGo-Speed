import { prisma } from "@/lib/prisma";
import { requireStaffRole } from "@/lib/guard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatRupiah, formatTanggal } from "@/lib/service-status";
import { PrintButton } from "./print-button";

export const metadata = { title: "Cetak Nota" };

export default async function CetakNotaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const { id } = await params;

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      branch: true,
      customer: { select: { name: true, phone: true } },
      vehicle: { select: { plateNumber: true, brand: true, model: true } },
      parts: { include: { part: { select: { name: true, unit: true } } } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!service) notFound();

  const totalPart = service.parts.reduce((s, p) => s + p.price * p.quantity, 0);
  const totalTagihan = totalPart + service.laborCost;
  const totalPaid = service.payments.reduce((s, p) => s + p.amount, 0);
  const sisa = totalTagihan - totalPaid;

  return (
    <div className="print-area mx-auto max-w-sm">
      {/* Tombol aksi (hilang saat cetak) */}
      <div className="no-print mb-4 flex gap-2">
        <PrintButton />
        <Link
          href={`/dashboard/servis/${service.id}`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700"
        >
          Kembali
        </Link>
      </div>

      {/* Nota */}
      <div className="rounded-lg bg-white p-5 text-sm text-black ring-1 ring-slate-200 print:ring-0">
        <div className="text-center">
          <p className="text-lg font-bold">{service.branch.name}</p>
          <p className="text-xs text-slate-600">RevGo · Bengkel</p>
        </div>

        <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
          <p className="font-mono text-xs">{service.code}</p>
          <p className="text-xs text-slate-600">{formatTanggal(service.finishedAt ?? service.createdAt)}</p>
        </div>

        <div className="mt-3 space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-600">Customer</span>
            <span>{service.customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Kendaraan</span>
            <span>{service.vehicle.plateNumber} ({service.vehicle.brand} {service.vehicle.model})</span>
          </div>
          {service.customer.phone && (
            <div className="flex justify-between">
              <span className="text-slate-600">HP</span>
              <span>{service.customer.phone}</span>
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-600">
                <th className="pb-1">Item</th>
                <th className="pb-1 text-right">Qty</th>
                <th className="pb-1 text-right">Harga</th>
                <th className="pb-1 text-right">Jml</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-0.5">Jasa servis</td>
                <td className="py-0.5 text-right">1</td>
                <td className="py-0.5 text-right">{formatRupiah(service.laborCost)}</td>
                <td className="py-0.5 text-right">{formatRupiah(service.laborCost)}</td>
              </tr>
              {service.parts.map((p) => (
                <tr key={p.id}>
                  <td className="py-0.5">{p.part.name}</td>
                  <td className="py-0.5 text-right">{p.quantity}</td>
                  <td className="py-0.5 text-right">{formatRupiah(p.price)}</td>
                  <td className="py-0.5 text-right">{formatRupiah(p.price * p.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 border-t border-dashed border-slate-300 pt-3 text-xs">
          <div className="flex justify-between font-semibold">
            <span>TOTAL</span>
            <span>{formatRupiah(totalTagihan)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-600">Dibayar</span>
            <span>{formatRupiah(totalPaid)}</span>
          </div>
          {sisa > 0 ? (
            <div className="mt-0.5 flex justify-between font-semibold text-red-600">
              <span>Sisa</span>
              <span>{formatRupiah(sisa)}</span>
            </div>
          ) : (
            <div className="mt-0.5 flex justify-between font-semibold text-emerald-600">
              <span>Status</span>
              <span>LUNAS</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-slate-500">
          Terima kasih atas kunjungan Anda 🙏
        </p>
      </div>
    </div>
  );
}
