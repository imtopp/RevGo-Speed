"use client";

import { useActionState, useState } from "react";
import {
  submitEstimate,
  changeSchedule,
  reassignMechanic,
  approveInPerson,
  checkInUnit,
  startWork,
  markWaitingParts,
  resumeWork,
  saveDiagnosis,
  mechanicFinish,
  qcDone,
  qcReject,
  cancelService,
  addServicePart,
  confirmDp,
  type ServisState,
} from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { SlotPicker } from "@/components/slot-picker";
import { PartPicker } from "@/components/part-picker";
import { NumberInput } from "@/components/number-input";
import { formatRupiah, formatTanggalWIB } from "@/lib/service-status";
import { waLink, pesanJadwalBaru } from "@/lib/wa";
import type { ServiceStatus } from "@db/prisma/client";

type ServiceInfo = {
  id: string;
  code: string;
  branchId: string;
  status: ServiceStatus;
  catalogId: string | null;
  estimate: number;
  laborCost: number;
  laborName: string | null;
  mechanicId: string | null;
  mechanicName: string | null;
  scheduledAt: Date | null;
  complaint: string | null;
  diagnosis: string | null;
  finishedAt: Date | null;
  customerWa: string | null;
  /** Jumlah DP aktif yang boleh hangus saat cancel (policy TANPA_REFUND). */
  dpHangusAmount: number | null;
};

type Mechanic = { id: string; name: string };
type Catalog = {
  id: string;
  nama: string;
  hargaDasar: number;
  estimasiMenit: number;
};
type Part = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string;
  quantity: number;
  sellPrice: number;
};

function useForm(action: (prev: ServisState, fd: FormData) => Promise<ServisState>) {
  const [state, formAction] = useActionState<ServisState, FormData>(
    action,
    {},
  );
  return { state, formAction };
}

function Msg({ state }: { state: ServisState }) {
  if (state.error)
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        {state.success}
      </p>
    );
  return null;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

function MekanikHint({ busy }: { busy: Mechanic[] }) {
  if (busy.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-warning">
      Sedang terjadwal di jam ini, tidak dipilih: {busy.map((m) => m.name).join(", ")}
    </p>
  );
}
const btnPrimary =
  "w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60";
const btnSecondary =
  "w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-foreground active:opacity-90 disabled:opacity-60";
const btnDanger =
  "w-full rounded-lg bg-red-50 py-2.5 text-sm font-medium text-danger ring-1 ring-red-200 active:opacity-90 disabled:opacity-60";

// ── Form-form aksi ────────────────────────────────────────────────────

function EstimateForm({
  service,
  mechanics,
  busyMechanics,
  catalog,
}: {
  service: ServiceInfo;
  mechanics: Mechanic[];
  busyMechanics: Mechanic[];
  catalog: Catalog[];
}) {
  const { state, formAction } = useForm(submitEstimate);
  const [catalogId, setCatalogId] = useState(service.catalogId ?? "");
  const pilihAwal = catalog.find((c) => c.id === (service.catalogId ?? ""));
  const [estimate, setEstimate] = useState(
    service.estimate || pilihAwal?.hargaDasar || 0,
  );
  const [laborCost, setLaborCost] = useState(
    service.laborCost || pilihAwal?.hargaDasar || 0,
  );
  const [namaJasa, setNamaJasa] = useState(
    service.laborName ?? pilihAwal?.nama ?? "",
  );
  const pilih = catalog.find((c) => c.id === catalogId);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-foreground">Isi Estimasi</p>
      <Msg state={state} />
      <Field label="Jenis Jasa">
        <select
          name="catalogId"
          value={catalogId}
          onChange={(e) => {
            setCatalogId(e.target.value);
            const c = catalog.find((x) => x.id === e.target.value);
            if (c) {
              setEstimate(c.hargaDasar);
              setLaborCost(c.hargaDasar);
              setNamaJasa(c.nama);
            }
          }}
          className={inputCls}
        >
          <option value="">— Bebas / keluhan —</option>
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>{c.nama}</option>
          ))}
        </select>
        {pilih ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Harga katalog: {formatRupiah(pilih.hargaDasar)} · ± {pilih.estimasiMenit} menit pengerjaan
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Pilih jenis jasa untuk mengisi biaya otomatis.
          </p>
        )}
      </Field>
      <Field label="Nama jasa">
        <input
          name="laborName"
          value={namaJasa}
          onChange={(e) => setNamaJasa(e.target.value)}
          maxLength={200}
          required={!catalogId && laborCost > 0}
          placeholder="mis. Perbaikan spion"
          className={inputCls}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Nama ini yang tampil di nota &amp; riwayat
          {!catalogId && " — wajib diisi saat Bebas"}.
        </p>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estimasi Biaya (Rp)">
          <NumberInput name="estimate" value={estimate} onChange={setEstimate} />
        </Field>
        <Field label="Biaya Jasa (Rp)">
          <NumberInput name="laborCost" value={laborCost} onChange={setLaborCost} />
        </Field>
      </div>
      <Field label="Mekanik">
        <select name="mechanicId" defaultValue={service.mechanicId ?? ""} className={inputCls}>
          <option value="">— Pilih —</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <MekanikHint busy={busyMechanics} />
      </Field>
      <SubmitButton pendingText="Mengirim..." className={btnPrimary}>
        Kirim Estimasi
      </SubmitButton>
    </form>
  );
}

function RescheduleForm({
  service,
  appName,
  tplWa,
}: {
  service: ServiceInfo;
  appName: string;
  tplWa?: string;
}) {
  const { state, formAction } = useForm(changeSchedule);
  const [jadwal, setJadwal] = useState("");
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-foreground">Ubah Jadwal Kedatangan</p>
      <p className="text-xs text-warning">
        Hanya ubah atas permintaan customer — setelah diubah, beri tahu customer
        tentang jadwal barunya.
      </p>
      <Msg state={state} />
      {service.scheduledAt && (
        <p className="text-xs text-muted-foreground">
          Jadwal saat ini: {formatTanggalWIB(service.scheduledAt)}
        </p>
      )}
      <SlotPicker
        branchId={service.branchId}
        value={jadwal}
        onChange={setJadwal}
        pakaiLeadTime={false}
      />
      <SubmitButton
        pendingText="Menyimpan..."
        disabled={!jadwal}
        className={btnSecondary}
      >
        Simpan Jadwal Baru
      </SubmitButton>
      {state.success && service.customerWa && jadwal && (
        <a
          href={waLink(
            service.customerWa,
            pesanJadwalBaru({
              appName,
              code: service.code,
              jadwal: formatTanggalWIB(jadwal),
              tpl: tplWa,
            }),
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full rounded-lg bg-success px-3 py-2.5 text-center text-sm font-medium text-white active:opacity-90"
        >
          Kirim jadwal baru via WhatsApp &rarr;
        </a>
      )}
    </form>
  );
}

function ReassignMechanicForm({
  service,
  mechanics,
  busyMechanics,
}: {
  service: ServiceInfo;
  mechanics: Mechanic[];
  busyMechanics: Mechanic[];
}) {
  const { state, formAction } = useForm(reassignMechanic);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-foreground">Ganti Mekanik</p>
      <p className="text-xs text-muted-foreground">
        Mekanik saat ini: {service.mechanicName ?? "Belum ditentukan"}
        {service.scheduledAt ? ` · jadwal ${formatTanggalWIB(service.scheduledAt)}` : ""}
      </p>
      <Msg state={state} />
      <Field label="Mekanik baru">
        <select name="mechanicId" defaultValue={service.mechanicId ?? ""} className={inputCls}>
          <option value="">— Belum ditentukan —</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <MekanikHint busy={busyMechanics} />
      </Field>
      <SubmitButton pendingText="Menyimpan..." className={btnSecondary}>
        Simpan Mekanik
      </SubmitButton>
    </form>
  );
}

function ApproveForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(approveInPerson);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <SubmitButton className={btnPrimary}>
        Setujui di Tempat → Dikonfirmasi
      </SubmitButton>
    </form>
  );
}

function CheckInForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(checkInUnit);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-foreground">
        Pemeriksaan Awal (Terima Unit)
      </p>
      <Msg state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Odometer (km) *">
          <input name="odometer" required placeholder="45230" className={inputCls} />
        </Field>
        <Field label="Level BBM">
          <select name="fuelLevel" defaultValue="" className={inputCls}>
            <option value="">—</option>
            <option value="1/4">1/4</option>
            <option value="1/2">1/2</option>
            <option value="3/4">3/4</option>
            <option value="Full">Full</option>
          </select>
        </Field>
      </div>
      <Field label="Kondisi yang sudah ada (goresan, penyok, dll)">
        <input name="existingCondition" placeholder="Baret spion kanan" className={inputCls} />
      </Field>
      <Field label="Keluhan disepakati">
        <input name="agreedComplaint" defaultValue={service.complaint ?? ""} className={inputCls} />
      </Field>
      <SubmitButton pendingText="Menyimpan..." className={btnPrimary}>
        Terima Unit → CHECKED_IN
      </SubmitButton>
    </form>
  );
}

function StartWorkForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(startWork);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <SubmitButton className={btnPrimary}>Mulai Kerja</SubmitButton>
    </form>
  );
}

function DiagnosisForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(saveDiagnosis);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-foreground">Diagnosis</p>
      <Msg state={state} />
      <textarea
        name="diagnosis"
        rows={3}
        // Isi dari diagnosis TERSIMPAN — kalau pakai complaint, hasil simpan
        // terlihat hilang tiap kali form dirender ulang.
        defaultValue={service.diagnosis ?? service.complaint ?? ""}
        className={inputCls}
      />
      <SubmitButton className={btnSecondary}>Simpan Diagnosis</SubmitButton>
    </form>
  );
}

/**
 * Catat part — inline di dalam kartu "Part Terpakai" (model Rincian Jasa:
 * tertutup sebagai "+ Catat Part", sukses tetap terbuka & remount agar bisa
 * mencatat beberapa part beruntun).
 */
export function AddPartForm({
  serviceId,
  parts,
}: {
  serviceId: string;
  parts: Part[];
}) {
  const { state, formAction } = useForm(addServicePart);
  // Sukses → remount form (key) supaya part & jumlah lama tidak terkirim lagi
  // saat tombol diklik kedua kali — status servis tak berubah, tap 2 sangat
  // mungkin terjadi dan sekarang harus mengisi ulang. Catatan saat render
  // (pola "adjusting state when props change").
  const [formKey, setFormKey] = useState(0);
  const [open, setOpen] = useState(false);
  const [stateSebelumnya, setStateSebelumnya] = useState(state);
  if (state !== stateSebelumnya) {
    setStateSebelumnya(state);
    if (state.success) setFormKey((k) => k + 1);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-foreground active:opacity-90"
      >
        + Catat Part
      </button>
    );
  }

  return (
    <form
      key={formKey}
      onReset={(e) => e.preventDefault()}
      action={formAction}
      className="mt-3 space-y-3 border-t border-slate-100 pt-3"
    >
      <input type="hidden" name="serviceId" value={serviceId} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          Catat Part Terpakai
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-primary underline underline-offset-2"
        >
          Tutup
        </button>
      </div>
      <Msg state={state} />
      <Field label="Part (stok cabang)">
        <PartPicker parts={parts} />
        <p className="mt-1 text-xs text-muted-foreground">
          Pilih satu dari daftar saran — bukan hanya mengetik.
        </p>
      </Field>
      <Field label="Jumlah">
        <NumberInput name="quantity" defaultValue={1} required />
      </Field>
      <SubmitButton className={btnSecondary}>Tambah Part</SubmitButton>
    </form>
  );
}

function WaitingPartsForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(markWaitingParts);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <SubmitButton className={btnSecondary}>Tandai Menunggu Part</SubmitButton>
    </form>
  );
}

function ResumeForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(resumeWork);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <SubmitButton className={btnPrimary}>Stok Ready → Lanjut Kerja</SubmitButton>
    </form>
  );
}

function FinishForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(mechanicFinish);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <SubmitButton className={btnPrimary}>
        Tandai Selesai Dikerjakan
      </SubmitButton>
      <p className="text-xs text-muted-foreground">
        Menunggu verifikasi (QC) admin sebelum SELESAI.
      </p>
    </form>
  );
}

function QcForm({ service }: { service: ServiceInfo }) {
  const lolos = useForm(qcDone);
  const tolak = useForm(qcReject);
  const [tolakOpen, setTolakOpen] = useState(false);
  return (
    <div className="space-y-3 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
      <form
        onReset={(e) => e.preventDefault()}
        action={lolos.formAction}
        className="space-y-2"
      >
        <input type="hidden" name="id" value={service.id} />
        <p className="text-sm font-semibold text-emerald-800">
          Quality Control — verifikasi sebelum serah terima
        </p>
        <Msg state={lolos.state} />
        <SubmitButton className={btnPrimary}>QC Lolos → SELESAI</SubmitButton>
      </form>
      <div className="border-t border-emerald-200 pt-3">
        {!tolakOpen ? (
          <button
            type="button"
            onClick={() => setTolakOpen(true)}
            className="w-full rounded-lg border border-emerald-300 py-2.5 text-sm font-medium text-danger active:opacity-90"
          >
            QC Tolak → ulang kerja
          </button>
        ) : (
          <form
            onReset={(e) => e.preventDefault()}
            action={tolak.formAction}
            className="space-y-2"
          >
            <input type="hidden" name="id" value={service.id} />
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-danger">QC Tolak</p>
              <button
                type="button"
                onClick={() => setTolakOpen(false)}
                className="text-xs font-medium text-danger underline underline-offset-2"
              >
                Tutup
              </button>
            </div>
            <Msg state={tolak.state} />
            <Field label="Alasan penolakan *">
              <input
                name="reason"
                required
                placeholder="Mis. rem masih bunyi, oli bocor"
                className={inputCls}
              />
            </Field>
            <SubmitButton className={btnDanger}>
              Tolak &amp; kembalikan ke mekanik
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

/** Mekanik sudah menandai selesai — tidak ada aksi lagi, tinggal tunggu QC admin. */
function TungguQc() {
  return (
    <div className="space-y-1 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <p className="text-sm font-semibold text-foreground">Menunggu QC admin</p>
      <p className="text-xs text-muted-foreground">
        Pekerjaan sudah ditandai selesai. Bila QC ditolak, alasan penolakan
        tampil di halaman ini — perbaiki lalu tandai selesai lagi.
      </p>
    </div>
  );
}

function CancelForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(cancelService);
  const dpHangus =
    service.dpHangusAmount != null && service.dpHangusAmount > 0;
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-danger">Batalkan Servis</p>
      <Msg state={state} />
      <Field label="Alasan *">
        <input name="reason" required placeholder="Customer batal, dll" className={inputCls} />
      </Field>
      {dpHangus && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            name="dpHangus"
            value="1"
            required
            className="mt-1 h-4 w-4 shrink-0"
          />
          <span>
            DP {formatRupiah(service.dpHangusAmount!)} ditahan (tidak direfund)
          </span>
        </label>
      )}
      <SubmitButton className={btnDanger}>Batalkan Servis</SubmitButton>
    </form>
  );
}

// ── Panel utama ───────────────────────────────────────────────────────

function NextStep({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
        Langkah berikutnya
      </p>
      {children}
    </div>
  );
}

function OtherActions({ children }: { children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="inline-block cursor-pointer rounded-lg border border-slate-300 bg-surface px-4 py-2 text-sm font-medium text-foreground active:opacity-90">
        Aksi lainnya ▾
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

// ── Konfirmasi DP (WAITING_DP → PENDING) ──────────────────────────────

type DpMetode = { transfer: boolean; qris: boolean; cash: boolean };

function ConfirmDpForm({
  service,
  dpNominal,
  dpMetode,
}: {
  service: ServiceInfo;
  dpNominal: number;
  dpMetode: DpMetode;
}) {
  const { state, formAction } = useForm(confirmDp);
  // Opsi dropdown = metode yang aktif di Pengaturan DP saja.
  const opsi: { value: string; label: string }[] = [
    ...(dpMetode.transfer ? [{ value: "TRANSFER", label: "Transfer" }] : []),
    ...(dpMetode.qris ? [{ value: "QRIS", label: "QRIS" }] : []),
    ...(dpMetode.cash ? [{ value: "CASH", label: "Tunai" }] : []),
  ];
  const [metode, setMetode] = useState(opsi[0]?.value ?? "");
  const adaMetode = opsi.length > 0;
  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
    >
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          Konfirmasi DP Diterima
        </h2>
        <p className="text-xs text-muted-foreground">
          {dpNominal > 0
            ? `Nominal tetap ${formatRupiah(dpNominal)} dari pengaturan DP. Catat uang yang benar-benar diterima, lalu booking lanjut ke estimasi.`
            : "DP tidak aktif (nominal 0) — matikan/konfigurasi ulang di Pengaturan."}
        </p>
      </div>
      <input type="hidden" name="id" value={service.id} />
      {adaMetode ? (
        <Field label="Metode">
          <select
            name="method"
            value={metode}
            onChange={(e) => setMetode(e.target.value)}
            className={inputCls}
          >
            {opsi.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="rounded-lg bg-background p-3 text-xs text-muted-foreground ring-1 ring-slate-200">
          Belum ada metode bayar aktif — aktifkan minimal satu (Tunai /
          Transfer / QRIS) di Pengaturan → DP Booking.
        </p>
      )}
      <Field label="Catatan (opsional)">
        <input
          name="note"
          className={inputCls}
          placeholder="mis. mutasi BCA sudah masuk"
        />
      </Field>
      <Msg state={state} />
      <SubmitButton
        className={btnPrimary}
        disabled={dpNominal <= 0 || !adaMetode}
      >
        Terima DP &amp; konfirmasi booking
      </SubmitButton>
    </form>
  );
}

export function ActionForms({
  service,
  mechanics,
  busyMechanics,
  catalog,
  isMechanic,
  isAssignedMechanic,
  appName,
  tplWaJadwal,
  dpNominal,
  dpMetode,
}: {
  service: ServiceInfo;
  mechanics: Mechanic[];
  busyMechanics: Mechanic[];
  catalog: Catalog[];
  isMechanic: boolean;
  isAssignedMechanic: boolean;
  appName: string;
  tplWaJadwal?: string;
  dpNominal?: number;
  /** Sakelar metode DP di Pengaturan — menyaring dropdown Konfirmasi DP. */
  dpMetode?: DpMetode;
}) {
  const canAdmin = !isMechanic;

  let primary: React.ReactNode = null;
  let others: React.ReactNode[] = [];

  switch (service.status) {
    case "WAITING_DP":
      if (canAdmin) {
        primary = (
          <ConfirmDpForm
            service={service}
            dpNominal={dpNominal ?? 0}
            dpMetode={dpMetode ?? { transfer: true, qris: true, cash: true }}
          />
        );
        others = [
          <RescheduleForm
            key="jadwal"
            service={service}
            appName={appName}
            tplWa={tplWaJadwal}
          />,
          <CancelForm key="cancel" service={service} />,
        ];
      }
      break;
    case "PENDING":
      if (canAdmin) {
        primary = (
          <EstimateForm
            service={service}
            mechanics={mechanics}
            busyMechanics={busyMechanics}
            catalog={catalog}
          />
        );
        others = [
          <ApproveForm key="approve" service={service} />,
          <RescheduleForm
            key="jadwal"
            service={service}
            appName={appName}
            tplWa={tplWaJadwal}
          />,
          <CancelForm key="cancel" service={service} />,
        ];
      }
      break;
    case "WAITING_APPROVAL":
      if (canAdmin) {
        primary = <ApproveForm service={service} />;
        others = [
          <ReassignMechanicForm
            key="mekanik"
            service={service}
            mechanics={mechanics}
            busyMechanics={busyMechanics}
          />,
          <CancelForm key="cancel" service={service} />,
        ];
      }
      break;
    case "CONFIRMED":
      primary = <CheckInForm service={service} />;
      others = canAdmin
        ? [
            <ReassignMechanicForm
              key="mekanik"
              service={service}
              mechanics={mechanics}
              busyMechanics={busyMechanics}
            />,
            <CancelForm key="cancel" service={service} />,
          ]
        : [];
      break;
    case "CHECKED_IN":
      primary = <StartWorkForm service={service} />;
      others = canAdmin
        ? [
            <ReassignMechanicForm
              key="mekanik"
              service={service}
              mechanics={mechanics}
              busyMechanics={busyMechanics}
            />,
            <CancelForm key="cancel" service={service} />,
          ]
        : [];
      break;
    case "IN_PROGRESS": {
      // Urutan wajib: mekanik tandai selesai dulu (finishedAt terisi),
      // baru tombol QC admin muncul sebagai langkah berikutnya.
      const selesaiDikerjakan = service.finishedAt != null;
      if (selesaiDikerjakan) {
        primary = canAdmin ? <QcForm service={service} /> : <TungguQc />;
        others = [
          <DiagnosisForm key="dx" service={service} />,
          // §B: tambah part = OWNER/ADMIN saja — form kini menempel di kartu
          // "Part Terpakai" (page.tsx), bukan lagi di sini.
          canAdmin && (
            <ReassignMechanicForm
              key="mekanik"
              service={service}
              mechanics={mechanics}
              busyMechanics={busyMechanics}
            />
          ),
        ].filter(Boolean);
      } else {
        primary =
          isAssignedMechanic || canAdmin ? (
            <FinishForm service={service} />
          ) : null;
        others = [
          <DiagnosisForm key="dx" service={service} />,
          canAdmin && (
            <ReassignMechanicForm
              key="mekanik"
              service={service}
              mechanics={mechanics}
              busyMechanics={busyMechanics}
            />
          ),
          canAdmin && <WaitingPartsForm key="wp" service={service} />,
        ].filter(Boolean);
      }
      break;
    }
    case "WAITING_PARTS":
      primary = canAdmin ? (
        <ResumeForm service={service} />
      ) : (
        // §B: mekanik tidak menambah part — hanya diberi tahu siapa yang mencatat.
        <div className="space-y-1 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
          <p className="text-sm font-semibold text-foreground">
            Menunggu Admin menambah part
          </p>
          <p className="text-xs text-muted-foreground">
            Part dicatat oleh Owner/Admin — kabari admin bila part sudah siap
            atau perlu diganti.
          </p>
        </div>
      );
      others = [
        <DiagnosisForm key="dx" service={service} />,
        canAdmin && (
          <ReassignMechanicForm
            key="mekanik"
            service={service}
            mechanics={mechanics}
            busyMechanics={busyMechanics}
          />
        ),
        // QC hanya setelah pekerjaan ditandai selesai — urutan tetap.
        canAdmin &&
          service.finishedAt != null && <QcForm key="qc" service={service} />,
      ].filter(Boolean);
      break;
    default:
      break;
  }

  if (!primary && others.length === 0) return null;

  return (
    <div id="aksi" className="scroll-mt-20 space-y-3">
      {primary && <NextStep>{primary}</NextStep>}
      {others.length > 0 && <OtherActions>{others}</OtherActions>}
    </div>
  );
}
