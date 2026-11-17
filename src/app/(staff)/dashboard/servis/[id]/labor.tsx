"use client";

import { useActionState, useState } from "react";
import {
  addServiceLabor,
  removeServiceLabor,
  updateServiceLaborCost,
  type ServisState,
} from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { NumberInput } from "@/components/number-input";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";
const btnSecondary =
  "w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-foreground active:opacity-90 disabled:opacity-60";

/**
 * Form tambah 1 baris rincian jasa (nama + harga) — OWNER/ADMIN, status
 * CONFIRMED..WAITING_PARTS (dicek di action). Mulai tertutup ("+ Tambah
 * Jasa") supaya kartu tidak selalu panjang; sukses → remount form (isian
 * bersih) tapi tetap terbuka agar bisa tambah beberapa baris beruntun.
 */
export function AddLaborForm({ serviceId }: { serviceId: string }) {
  const [state, formAction] = useActionState<ServisState, FormData>(
    addServiceLabor,
    {},
  );
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
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
        + Tambah Jasa
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
        <p className="text-sm font-semibold text-foreground">Tambah Jasa</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-medium text-primary underline underline-offset-2"
        >
          Tutup
        </button>
      </div>
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      )}
      <div>
        <label className="block text-sm font-medium text-foreground">
          Nama jasa *
        </label>
        <input
          name="name"
          required
          maxLength={200}
          placeholder="Ganti kampas rem depan"
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Harga (Rp)
          </label>
          <NumberInput name="price" defaultValue={0} />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Catatan
          </label>
          <input
            name="note"
            maxLength={500}
            placeholder="Opsional"
            className={inputCls}
          />
        </div>
      </div>
      <SubmitButton className={btnSecondary}>Tambah Jasa</SubmitButton>
    </form>
  );
}

/** Tombol hapus 1 baris rincian jasa — dengan konfirmasi. */
export function RemoveLaborButton({ laborId }: { laborId: string }) {
  const [state, formAction] = useActionState<ServisState, FormData>(
    removeServiceLabor,
    {},
  );
  return (
    <form
      onReset={(e) => e.preventDefault()}
      action={formAction}
      className="flex flex-col items-end gap-1"
    >
      <input type="hidden" name="id" value={laborId} />
      <button
        type="submit"
        onClick={(e) => {
          if (
            !confirm("Hapus baris jasa ini dari tagihan servis?")
          )
            e.preventDefault();
        }}
        className="text-xs font-medium text-danger underline underline-offset-2"
      >
        Hapus
      </button>
      {state.error && (
        <p className="max-w-[16rem] text-right text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * Ubah jasa utama (`laborCost` + `laborName`) inline — OWNER/ADMIN, selain
 * PENDING (form Estimasi) / DONE / CANCELLED (dicek di action). Pola render-
 * adjustment sama dengan WaEdit: sukses → form tertutup saat render.
 * Error tetap tampil selama form terbuka.
 */
export function EditLaborCostButton({
  serviceId,
  value,
  namaAwal,
}: {
  serviceId: string;
  value: number;
  namaAwal: string;
}) {
  const [state, formAction] = useActionState<ServisState, FormData>(
    updateServiceLaborCost,
    {},
  );
  const [open, setOpen] = useState(false);
  const [nama, setNama] = useState(namaAwal);
  const [stateSebelumnya, setStateSebelumnya] = useState(state);
  if (state !== stateSebelumnya) {
    setStateSebelumnya(state);
    if (state.success) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setNama(namaAwal);
          setOpen(true);
        }}
        className="text-xs font-medium text-primary underline underline-offset-2"
      >
        Ubah
      </button>
    );
  }

  return (
    <form
      onReset={(e) => e.preventDefault()}
      action={formAction}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <input type="hidden" name="id" value={serviceId} />
      <input
        name="laborName"
        value={nama}
        onChange={(e) => setNama(e.target.value)}
        maxLength={200}
        placeholder="Nama jasa"
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
      />
      <NumberInput
        name="laborCost"
        defaultValue={value}
        required
        className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
      />
      <SubmitButton
        pendingText="Menyimpan..."
        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        Simpan
      </SubmitButton>
      <button
        type="button"
        onClick={() => {
          setNama(namaAwal);
          setOpen(false);
        }}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-foreground active:opacity-90"
      >
        Batal
      </button>
      {state.error && (
        <p className="w-full text-right text-xs text-danger">{state.error}</p>
      )}
    </form>
  );
}
