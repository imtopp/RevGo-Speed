"use client";

import { useActionState } from "react";
import {
  submitEstimate,
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
import type { ServiceStatus } from "@db/prisma/client";

type ServiceInfo = {
  id: string;
  status: ServiceStatus;
  estimate: number;
  laborCost: number;
  mechanicId: string | null;
  scheduledAt: Date | null;
  complaint: string | null;
};

type Mechanic = { id: string; name: string };
type Part = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  sellPrice: number;
};

function useForm(action: (prev: ServisState, fd: FormData) => Promise<ServisState>) {
  const [state, formAction, pending] = useActionState<ServisState, FormData>(
    action,
    {},
  );
  return { state, formAction, pending };
}

function Msg({ state }: { state: ServisState }) {
  if (state.error)
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
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
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";
const btnPrimary =
  "w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60";
const btnSecondary =
  "w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 active:opacity-90 disabled:opacity-60";
const btnDanger =
  "w-full rounded-lg bg-red-50 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-200 active:opacity-90 disabled:opacity-60";

// ── Form-form aksi ────────────────────────────────────────────────────

function EstimateForm({
  service,
  mechanics,
}: {
  service: ServiceInfo;
  mechanics: Mechanic[];
}) {
  const { state, formAction, pending } = useForm(submitEstimate);
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-slate-700">Isi Estimasi</p>
      <Msg state={state} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Estimasi Biaya (Rp)">
          <input name="estimate" type="number" min={0} defaultValue={service.estimate} className={inputCls} />
        </Field>
        <Field label="Biaya Jasa (Rp)">
          <input name="laborCost" type="number" min={0} defaultValue={service.laborCost} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mekanik">
          <select name="mechanicId" defaultValue={service.mechanicId ?? ""} className={inputCls}>
            <option value="">— Pilih —</option>
            {mechanics.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Jadwal">
          <input name="scheduledAt" type="datetime-local" defaultValue="" className={inputCls} />
        </Field>
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Mengirim..." : "Kirim Estimasi"}
      </button>
    </form>
  );
}

function ApproveForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(approveInPerson);
  return (
    <form action={formAction} className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "..." : "Setujui di Tempat → Dikonfirmasi"}
      </button>
    </form>
  );
}

function CheckInForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(checkInUnit);
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-slate-700">
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
        <input name="existingCondition" placeholder="Baret bemper depan kiri" className={inputCls} />
      </Field>
      <Field label="Keluhan disepakati">
        <input name="agreedComplaint" defaultValue={service.complaint ?? ""} className={inputCls} />
      </Field>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Menyimpan..." : "Terima Unit → CHECKED_IN"}
      </button>
    </form>
  );
}

function StartWorkForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(startWork);
  return (
    <form action={formAction} className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "..." : "Mulai Kerja"}
      </button>
    </form>
  );
}

function DiagnosisForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(saveDiagnosis);
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-slate-700">Diagnosis</p>
      <Msg state={state} />
      <textarea name="diagnosis" rows={3} defaultValue={service.complaint ?? ""} className={inputCls} />
      <button type="submit" disabled={pending} className={btnSecondary}>
        {pending ? "..." : "Simpan Diagnosis"}
      </button>
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
  const { state, formAction, pending } = useForm(addServicePart);
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <input type="hidden" name="serviceId" value={serviceId} />
      <p className="text-sm font-semibold text-slate-700">Catat Part Terpakai</p>
      <Msg state={state} />
      <Field label="Part (stok cabang)">
        <select name="partId" required className={inputCls}>
          <option value="">— Pilih —</option>
          {parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (stok: {p.quantity})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Jumlah">
        <input name="quantity" type="number" min={1} defaultValue={1} className={inputCls} />
      </Field>
      <button type="submit" disabled={pending} className={btnSecondary}>
        {pending ? "..." : "Tambah Part"}
      </button>
    </form>
  );
}

function WaitingPartsForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(markWaitingParts);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <button type="submit" disabled={pending} className={btnSecondary}>
        {pending ? "..." : "Tandai Menunggu Part"}
      </button>
    </form>
  );
}

function ResumeForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(resumeWork);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "..." : "Stok Ready → Lanjut Kerja"}
      </button>
    </form>
  );
}

function FinishForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(mechanicFinish);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={service.id} />
      <Msg state={state} />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "..." : "Tandai Selesai Dikerjakan"}
      </button>
      <p className="text-xs text-slate-400">
        Menunggu verifikasi (QC) admin sebelum SELESAI.
      </p>
    </form>
  );
}

function QcForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(qcDone);
  return (
    <form action={formAction} className="space-y-2 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-emerald-800">
        Quality Control — verifikasi sebelum serah terima
      </p>
      <Msg state={state} />
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "..." : "QC Lolos → SELESAI"}
      </button>
    </form>
  );
}

function CancelForm({ service }: { service: ServiceInfo }) {
  const { state, formAction, pending } = useForm(cancelService);
  return (
    <form action={formAction} className="space-y-2 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <input type="hidden" name="id" value={service.id} />
      <p className="text-sm font-semibold text-red-600">Batalkan Servis</p>
      <Msg state={state} />
      <Field label="Alasan *">
        <input name="reason" required placeholder="Customer batal, dll" className={inputCls} />
      </Field>
      <button type="submit" disabled={pending} className={btnDanger}>
        {pending ? "..." : "Batalkan Servis"}
      </button>
    </form>
  );
}

// ── Panel utama ───────────────────────────────────────────────────────

export function ActionForms({
  service,
  mechanics,
  parts,
  isMechanic,
  isAssignedMechanic,
}: {
  service: ServiceInfo;
  mechanics: Mechanic[];
  parts: Part[];
  isMechanic: boolean;
  isAssignedMechanic: boolean;
}) {
  const canAdmin = !isMechanic;

  return (
    <div className="space-y-3">
      {service.status === "PENDING" && (
        <>
          {canAdmin && <EstimateForm service={service} mechanics={mechanics} />}
          {canAdmin && <ApproveForm service={service} />}
        </>
      )}

      {service.status === "WAITING_APPROVAL" && canAdmin && (
        <ApproveForm service={service} />
      )}

      {service.status === "CONFIRMED" && <CheckInForm service={service} />}

      {service.status === "CHECKED_IN" && (
        <>
          <StartWorkForm service={service} />
          {canAdmin && <CancelForm service={service} />}
        </>
      )}

      {(service.status === "IN_PROGRESS" ||
        service.status === "WAITING_PARTS") && (
        <>
          <DiagnosisForm service={service} />
          <AddPartForm serviceId={service.id} parts={parts} />
          {service.status === "IN_PROGRESS" && (
            <>
              {isAssignedMechanic || canAdmin ? (
                <FinishForm service={service} />
              ) : null}
              {canAdmin && <WaitingPartsForm service={service} />}
              {canAdmin && <QcForm service={service} />}
            </>
          )}
          {service.status === "WAITING_PARTS" && (
            <>
              <ResumeForm service={service} />
              {canAdmin && <QcForm service={service} />}
            </>
          )}
        </>
      )}

      {(service.status === "PENDING" ||
        service.status === "WAITING_APPROVAL" ||
        service.status === "CONFIRMED") &&
        canAdmin && <CancelForm service={service} />}
    </div>
  );
}
