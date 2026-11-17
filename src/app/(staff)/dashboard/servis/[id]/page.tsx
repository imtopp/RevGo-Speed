import { prisma } from "@/lib/prisma";
import { requireStaffRole, getStaffBranchId } from "@/lib/guard";
import { mekanikSibuk } from "@/lib/booking";
import { DURASI_DEFAULT_MENIT } from "@/lib/availability";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  STATUS_OVERDUE,
  NEXT_ACTION_LABEL,
  formatRupiah,
  formatTanggal,
  formatTanggalWIB,
  bolehBayar,
  PESAN_BAYAR_DITAHAN,
  totalTagihan,
  labelMetodeBayar,
  namaJasaUtama,
} from "@/lib/service-status";
import { ActionForms, AddPartForm } from "./action-forms";
import { AddLaborForm, RemoveLaborButton, EditLaborCostButton } from "./labor";
import { VoidPaymentForm } from "./void-payment";
import { RefundForm } from "./refund-form";
import { RemovePartButton } from "./remove-part-button";
import { WaEdit } from "./wa-edit";
import { PaymentForm } from "../../kas/payment-form";
import { formatTanggalPendek } from "@/lib/service-status";
import { getAppName } from "@/lib/branding";
import { waLink, pesanPembatalan } from "@/lib/wa";
import { muatTemplateNotif } from "@/lib/notif-template-db";
import { getDpConfig, dpAktif, labelTerlambat } from "@/lib/dp";

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
      labors: { orderBy: { createdAt: "asc" } },
      payments: true,
    },
  });
  if (!service) notFound();

  const appName = await getAppName();
  const tplNotif = await muatTemplateNotif();
  const dpCfg = await getDpConfig();
  const waCustomer =
    service.customer?.phone ?? service.customerPhone ?? service.vehicle.owner?.phone ?? null;

  // Scoping cabang: ADMIN/MECHANIC tidak boleh membuka servis cabang lain.
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && service.branchId !== branchIdStaff) notFound();

  const isMechanic = session.user.role === "MECHANIC";
  const isOwner = session.user.role === "OWNER";
  const isAssignedMechanic =
    isMechanic && service.mechanicId === session.user.id;
  const canAct = !isMechanic || isAssignedMechanic;
  // Hapus part = wewenang owner/admin saja (mekanik memegang part fisik —
  // tidak boleh menghapus jejaknya di sistem sendirian).
  const bolehHapusPart =
    !isMechanic &&
    service.status !== "DONE" &&
    service.status !== "CANCELLED";
  // Rincian jasa: lihat semua; tambah hanya OWNER/ADMIN & status siap dikerjakan
  // (syarat identik dengan action addServiceLabor).
  const bolehUbahJasa = bolehHapusPart;
  const bolehTambahJasa =
    bolehUbahJasa &&
    ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "WAITING_PARTS"].includes(
      service.status,
    );
  // Jasa utama (laborCost): selain PENDING — di tahap itu nilai diisi lewat
  // form Estimasi — dan selain DONE/CANCELLED (ikut bolehUbahJasa).
  const bolehUbahJasaUtama =
    bolehUbahJasa && service.status !== "PENDING";
  // Catat part = OWNER/ADMIN saat IN_PROGRESS / WAITING_PARTS (§B: mekanik
  // tidak memegang form) — formnya kini inline di kartu Part Terpakai.
  const bolehCatatPart =
    !isMechanic &&
    ["IN_PROGRESS", "WAITING_PARTS"].includes(service.status);

  const mechanics = await prisma.user.findMany({
    where: { role: "MECHANIC", isActive: true, branchId: service.branchId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Mekanik yang sudah terjadwal di servis lain pada jendela waktu servis ini
  // tidak ditawarkan sebagai pilihan (kecuali memang sudah melekat di sini).
  const sibuk = await mekanikSibuk({
    branchId: service.branchId,
    epoch: service.scheduledAt?.getTime() ?? null,
    durasiMenit: service.estimasiMenit ?? DURASI_DEFAULT_MENIT,
    excludeId: service.id,
  });
  const busyMechanics = mechanics.filter((m) => sibuk.has(m.id));
  const mekanikTersedia = mechanics.filter(
    (m) => !sibuk.has(m.id) || m.id === service.mechanicId,
  );
  const parts = await prisma.part.findMany({
    where: { branchId: service.branchId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      unit: true,
      quantity: true,
      sellPrice: true,
    },
  });
  const catalogList = await prisma.serviceCatalog.findMany({
    where: { aktif: true },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, hargaDasar: true, estimasiMenit: true },
  });

  const totalPartHarga = service.parts.reduce(
    (sum, p) => sum + p.price * p.quantity,
    0,
  );
  const totalJasaTambahan = service.labors.reduce((sum, l) => sum + l.price, 0);
  const nilaiTagihan = totalTagihan(service.laborCost, service.parts, service.labors);
  const totalPaid = service.payments
    .filter((p) => !p.voidedAt)
    .reduce((sum, p) => sum + p.amount, 0);
  const remaining = nilaiTagihan - totalPaid;

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

  // Render-time (server): label keterlambatan — dihitung sekali di badan
  // fungsi agar lolos aturan purity (bukan di JSX).
  const now = new Date();
  const terlambat =
    STATUS_OVERDUE.includes(service.status) &&
    service.scheduledAt !== null &&
    service.scheduledAt.getTime() < now.getTime();

  // DP yang boleh hangus saat cancel (hanya bila policy TANPA_REFUND) —
  // dipakai CancelForm untuk centang konfirmasi + dicek ulang di server.
  const aktifBayar = service.payments.filter((p) => !p.voidedAt);
  const dpHangusAmount =
    aktifBayar.length > 0 &&
    aktifBayar.every((p) => p.kind === "DP") &&
    dpCfg.policy !== "REFUND_PENUH"
      ? aktifBayar.reduce((s, p) => s + p.amount, 0)
      : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-3">
          <BackLink
            href="/dashboard/servis"
            className="text-sm text-muted-foreground underline underline-offset-2"
          >
            ← Kembali ke daftar
          </BackLink>
          {!isMechanic && (
            <Link
              href={`/dashboard/servis/${service.id}/cetak`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-foreground active:opacity-90"
            >
              Cetak Nota
            </Link>
          )}
        </div>
        <div className="mt-2 flex items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm text-muted-foreground">{service.code}</p>
            <h1 className="text-xl font-bold tracking-tight">
              {service.vehicle.plateNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              {service.vehicle.brand} {service.vehicle.model} ·{" "}
              {service.customerName ?? service.customer?.name ?? "—"}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[service.status]}`}
          >
            {STATUS_LABEL[service.status]}
          </span>
        </div>
        {terlambat && service.scheduledAt && (
          <p className="mt-1 text-xs font-medium text-warning">
            {labelTerlambat(service.scheduledAt, now, dpCfg)}
          </p>
        )}
        {service.status === "WAITING_DP" && service.dpClaimedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Customer sudah klaim DP{" "}
            {service.dpClaimedAt.toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
            .
          </p>
        )}
      </div>

      {/* Info dasar */}
      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {/* Keluhan & diagnosis di atas — informasi utama yang dicari
              mekanik; sisanya (data administratif) menyusul. */}
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
          <WaEdit
            serviceId={service.id}
            current={waCustomer}
            canEdit={!isMechanic}
          />
          {service.cancelReason && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Alasan Batal</dt>
              <dd className="text-danger">{service.cancelReason}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Riwayat — hanya bila ≥2 event; "Booking dibuat" saja belum memberi
          info tambahan di atas status + jadwal yang sudah tampil di header. */}
      {timeline.length >= 2 && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <h2 className="text-sm font-semibold text-foreground">Riwayat</h2>
          <ul className="mt-2 space-y-1.5">
            {timeline.map((t) => (
              <li key={t.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t.label}</span>
                <span className="text-muted-foreground">
                  {t.wib ? formatTanggalWIB(t.at) : formatTanggal(t.at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rincian jasa — jasa utama (estimasi) + item tambahan per baris */}
      {(service.laborCost > 0 ||
        service.labors.length > 0 ||
        bolehTambahJasa) && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Rincian Jasa
            </h2>
            <span className="text-sm text-muted-foreground">
              {formatRupiah(service.laborCost + totalJasaTambahan)}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-slate-100">
            {/* flex-wrap: saat form Ubah terbuka, harga disembunyikan dan
                form jadi child w-full yang turun ke baris baru — jangan
                dibungkus shrink-0 (form sempit / overflow di layar kecil). */}
            <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2 text-sm">
              <p className="min-w-0 flex-1 truncate">{namaJasaUtama(service)}</p>
              {bolehUbahJasaUtama ? (
                <EditLaborCostButton
                  serviceId={service.id}
                  value={service.laborCost}
                  namaAwal={namaJasaUtama(service)}
                />
              ) : (
                <span className="shrink-0 font-medium">
                  {formatRupiah(service.laborCost)}
                </span>
              )}
            </li>
            {service.labors.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate">{l.name}</p>
                  {l.note && (
                    <p className="text-xs text-muted-foreground">{l.note}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium">{formatRupiah(l.price)}</span>
                  {bolehUbahJasa && <RemoveLaborButton laborId={l.id} />}
                </div>
              </li>
            ))}
          </ul>
          {bolehTambahJasa && <AddLaborForm serviceId={service.id} />}
        </div>
      )}

      {/* Part terpakai + catat part inline (model Rincian Jasa) — kartu
          tampil kalau ada isinya ATAU statusnya boleh mencatat part. */}
      {(service.parts.length > 0 || bolehCatatPart) && (
        <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Part Terpakai
            </h2>
            <span className="text-sm text-muted-foreground">
              {formatRupiah(totalPartHarga)}
            </span>
          </div>
          {service.parts.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {service.parts.map((sp) => (
                <li
                  key={sp.id}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate">{sp.part.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sp.quantity} {sp.part.unit} × {formatRupiah(sp.price)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-medium">
                      {formatRupiah(sp.price * sp.quantity)}
                    </span>
                    {bolehHapusPart && <RemovePartButton servicePartId={sp.id} />}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Belum ada part terpakai.
            </p>
          )}
          {bolehCatatPart && (
            <AddPartForm serviceId={service.id} parts={parts} />
          )}
        </div>
      )}

      {/* Tagihan & pembayaran — 1 kartu: ringkasan (jasa + part = total),
          riwayat pembayaran, lalu sudah bayar & sisa. */}
      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">
          Tagihan &amp; Pembayaran
        </h2>
        {/* Blok persamaan — total & sisa berdampingan supaya rantai hitung
            terbaca utuh; riwayat pembayaran jadi detail di bawah. */}
        <div className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Biaya jasa</span>
            <span>{formatRupiah(service.laborCost + totalJasaTambahan)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Biaya part</span>
            <span>{formatRupiah(totalPartHarga)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total tagihan</span>
            <span>{formatRupiah(nilaiTagihan)}</span>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sudah dibayar</span>
            <span>{formatRupiah(totalPaid)}</span>
          </div>
          <div
            className={`flex justify-between font-semibold ${
              remaining > 0
                ? "text-danger"
                : remaining < 0
                  ? "text-warning"
                  : "text-success"
            }`}
          >
            <span>
              {remaining > 0
                ? "Sisa tagihan"
                : remaining < 0
                  ? "Kelebihan bayar"
                  : "Status"}
            </span>
            <span>
              {remaining !== 0 ? formatRupiah(Math.abs(remaining)) : "LUNAS"}
            </span>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-100 pt-3">
          {service.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada pembayaran.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {service.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm"
                >
                  <div
                    className={`flex min-w-0 flex-1 items-center justify-between gap-3 ${
                      p.voidedAt ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p>
                        {p.kind === "DP"
                          ? "DP"
                          : p.kind === "REFUND"
                            ? "Kembali"
                            : "Bayar"}{" "}
                        · {labelMetodeBayar(p.method)}
                        {p.voidedAt && (
                          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-danger">
                            DIBATALKAN
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTanggalPendek(p.paidAt)}
                        {p.note ? ` · ${p.note}` : ""}
                        {p.voidedAt ? ` · ${p.voidReason}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-medium ${
                        p.voidedAt
                          ? "text-muted-foreground line-through"
                          : p.kind === "REFUND"
                            ? "text-danger"
                            : ""
                      }`}
                    >
                      {formatRupiah(p.amount)}
                    </span>
                  </div>
                  {/* Child langsung li (bukan dibungkus shrink-0): saat form
                      terbuka, w-full = lebar baris penuh di layar kecil. */}
                  {isOwner && !p.voidedAt && p.kind !== "REFUND" && (
                    <VoidPaymentForm paymentId={p.id} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Kelebihan bayar (DP > biaya akhir) — Owner kembalikan 1 klik,
          peran lain hanya diberi tahu. */}
      {remaining < 0 && (
        isOwner ? (
          <RefundForm serviceId={service.id} kelebihan={-remaining} />
        ) : (
          <p className="rounded-xl bg-surface px-4 py-3 text-xs text-muted-foreground ring-1 ring-slate-200 shadow-card">
            Kelebihan bayar {formatRupiah(-remaining)} — menunggu Owner untuk
            pengembalian.
          </p>
        )
      )}

      {/* Form bayar — hanya saat booking/awal (DP) atau setelah SELESAI;
          unit yang sedang dikerjakan menunggu QC lolos dulu. */}
      {!isMechanic && remaining > 0 && service.status !== "CANCELLED" && (
        bolehBayar(service.status) ? (
          <PaymentForm serviceId={service.id} remaining={remaining} />
        ) : (
          <p className="rounded-xl bg-surface px-4 py-3 text-xs text-muted-foreground ring-1 ring-slate-200 shadow-card">
            {PESAN_BAYAR_DITAHAN}
          </p>
        )
      )}

      {/* Aksi contextual */}
      {canAct && service.status !== "DONE" && service.status !== "CANCELLED" && (
        <>
          <ActionForms
            service={{
              id: service.id,
              code: service.code,
              branchId: service.branchId,
              status: service.status,
              catalogId: service.catalogId,
              estimate: service.estimate,
              laborCost: service.laborCost,
              laborName: service.laborName,
              mechanicId: service.mechanicId,
              mechanicName: service.mechanic?.name ?? null,
              scheduledAt: service.scheduledAt,
              complaint: service.complaint,
              diagnosis: service.diagnosis,
              finishedAt: service.finishedAt,
              customerWa: waCustomer,
              dpHangusAmount,
            }}
            mechanics={mekanikTersedia}
            busyMechanics={busyMechanics}
            catalog={catalogList}
            isMechanic={isMechanic}
            isAssignedMechanic={isAssignedMechanic}
            appName={appName}
            tplWaJadwal={tplNotif["wa.jadwal_baru"]?.body}
            dpNominal={dpAktif(dpCfg) ? dpCfg.nominal : 0}
            dpMetode={{
              transfer: dpCfg.transferEnabled,
              qris: dpCfg.qrisEnabled,
              cash: dpCfg.cashEnabled,
            }}
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
        <div className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm text-muted-foreground">
            {service.status === "DONE"
              ? remaining > 0
                ? `Sisa tagihan ${formatRupiah(remaining)} — lunasi lewat form bayar di halaman ini atau di menu Piutang.`
                : "Servis selesai dan tagihan sudah lunas."
              : `Servis sudah ${STATUS_LABEL[service.status].toLowerCase()}.`}
          </p>
          {service.status === "CANCELLED" && !isMechanic && waCustomer && (
            <a
              href={waLink(
                waCustomer,
                pesanPembatalan({
                  appName,
                  code: service.code,
                  alasan: service.cancelReason,
                  tpl: tplNotif["wa.pembatalan"]?.body,
                }),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-success px-3 py-2.5 text-center text-sm font-medium text-white active:opacity-90"
            >
              Kirim info pembatalan via WhatsApp &rarr;
            </a>
          )}
        </div>
      )}
    </div>
  );
}
