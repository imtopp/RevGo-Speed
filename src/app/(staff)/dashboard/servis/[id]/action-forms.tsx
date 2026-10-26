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
  cancelService,
  addServicePart,
  type ServisState,
} from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { SlotPicker } from "@/components/slot-picker";
import { PartPicker } from "@/components/part-picker";
import { NumberInput } from "@/components/number-input";
import { formatRupiah, formatTanggalWIB } from "@/lib/service-status";
import type { ServiceStatus } from "@db/prisma/client";

type ServiceInfo = {
  id: string;
  branchId: string;
  status: ServiceStatus;
  catalogId: string | null;
  estimate: number;
  laborCost: number;
  mechanicId: string | null;
  mechanicName: string | null;
  scheduledAt: Date | null;
  complaint: string | null;
  finishedAt: Date | null;
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
          <p className="mt-1 text-xs text-slate-400">
            Harga katalog: {formatRupiah(pilih.hargaDasar)} · ± {pilih.estimasiMenit} menit pengerjaan
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Pilih jenis jasa untuk mengisi biaya otomatis.
          </p>
        )}
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

function RescheduleForm({ service }: { service: ServiceInfo }) {
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
        <p className="text-xs text-slate-400">
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
      <p className="text-xs text-slate-400">
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
      <textarea name="diagnosis" rows={3} defaultValue={service.complaint ?? ""} className={inputCls} />
      <SubmitButton className={btnSecondary}>Simpan Diagnosis</SubmitButton>
    </form>
  );
}

function AddPartForm({
  serviceId,
  parts,
}: {
  serviceId: string;
  parts: Part[];
}) {
  const { state, formAction } = useForm(addServicePart);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="serviceId" value={serviceId} />
      <p className="text-sm font-semibold text-foreground">Catat Part Terpakai</p>
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
      <p className="text-xs text-slate-400">
        Menunggu verifikasi (QC) admin sebelum SELESAI.
      </p>
    </form>
  );
}

function QcForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(qcDone);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-2 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-emerald-800">
        Quality Control — verifikasi sebelum serah terima
      </p>
      <Msg state={state} />
      <SubmitButton className={btnPrimary}>QC Lolos → SELESAI</SubmitButton>
    </form>
  );
}

/** Mekanik sudah menandai selesai — tidak ada aksi lagi, tinggal tunggu QC admin. */
function TungguQc() {
  return (
    <div className="space-y-1 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <p className="text-sm font-semibold text-foreground">Menunggu QC admin</p>
      <p className="text-xs text-muted-foreground">
        Pekerjaan sudah ditandai selesai. Admin akan memeriksa hasilnya sebelum
        servis dinyatakan SELESAI.
      </p>
    </div>
  );
}

function CancelForm({ service }: { service: ServiceInfo }) {
  const { state, formAction } = useForm(cancelService);
  return (
    <form onReset={(e) => e.preventDefault()} action={formAction} className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-danger">Batalkan Servis</p>
      <Msg state={state} />
      <Field label="Alasan *">
        <input name="reason" required placeholder="Customer batal, dll" className={inputCls} />
      </Field>
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

export function ActionForms({
  service,
  mechanics,
  busyMechanics,
  catalog,
  parts,
  isMechanic,
  isAssignedMechanic,
}: {
  service: ServiceInfo;
  mechanics: Mechanic[];
  busyMechanics: Mechanic[];
  catalog: Catalog[];
  parts: Part[];
  isMechanic: boolean;
  isAssignedMechanic: boolean;
}) {
  const canAdmin = !isMechanic;

  let primary: React.ReactNode = null;
  let others: React.ReactNode[] = [];

  switch (service.status) {
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
          <RescheduleForm key="jadwal" service={service} />,
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
          <AddPartForm key="part" serviceId={service.id} parts={parts} />,
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
          <AddPartForm key="part" serviceId={service.id} parts={parts} />,
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
        <AddPartForm serviceId={service.id} parts={parts} />
      );
      others = [
        <DiagnosisForm key="dx" service={service} />,
        canAdmin && <AddPartForm key="part" serviceId={service.id} parts={parts} />,
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
