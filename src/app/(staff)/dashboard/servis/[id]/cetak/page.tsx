import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { getAppName } from "@/lib/branding";
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
  await requireStaffRole(["OWNER", "ADMIN"]);
  const { id } = await params;
  const appName = await getAppName();

  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      branch: true,
      customer: { select: { name: true, phone: true } },
      vehicle: { select: { plateNumber: true, brand: true, model: true } },
      parts: { include: { part: { select: { name: true, unit: true } } } },
      payments: { where: { voidedAt: null }, orderBy: { paidAt: "asc" } },
    },
  });
  if (!service) notFound();
  // Scoping cabang: ADMIN tidak boleh mencetak nota servis cabang lain.
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && service.branchId !== branchIdStaff) notFound();

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
          className="rounded-lg border border-slate-300 bg-surface px-4 py-2.5 text-sm font-medium text-foreground"
        >
          Kembali
        </Link>
      </div>

      {/* Nota */}
      <div className="rounded-lg bg-surface p-5 text-sm text-black ring-1 ring-slate-200 shadow-card print:ring-0">
        <div className="text-center">
          <p className="text-lg font-bold">{service.branch.name}</p>
          <p className="text-xs text-muted-foreground">{appName} · Bengkel</p>
        </div>

        <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
          <p className="font-mono text-xs">{service.code}</p>
          <p className="text-xs text-muted-foreground">{formatTanggal(service.finishedAt ?? service.createdAt)}</p>
        </div>

        <div className="mt-3 space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer</span>
            <span>{service.customer.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kendaraan</span>
            <span>{service.vehicle.plateNumber} ({service.vehicle.brand} {service.vehicle.model})</span>
          </div>
          {service.customer.phone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">HP</span>
              <span>{service.customer.phone}</span>
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
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
            <span className="text-muted-foreground">Dibayar</span>
            <span>{formatRupiah(totalPaid)}</span>
          </div>
          {sisa > 0 ? (
            <div className="mt-0.5 flex justify-between font-semibold text-danger">
              <span>Sisa</span>
              <span>{formatRupiah(sisa)}</span>
            </div>
          ) : (
            <div className="mt-0.5 flex justify-between font-semibold text-success">
              <span>Status</span>
              <span>LUNAS</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          Terima kasih atas kunjungan Anda 🙏
        </p>
      </div>
    </div>
  );
}
