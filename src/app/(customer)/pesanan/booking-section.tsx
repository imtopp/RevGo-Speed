"use client";

import { useActionState, useState } from "react";
import {
  customerBooking,
  customerAddVehicle,
  customerRespondEstimate,
  type CustomerState,
} from "./actions";

type Vehicle = { id: string; plateNumber: string; brand: string; model: string };
type Branch = { id: string; name: string };
type Catalog = { id: string; nama: string };

function Msg({ state }: { state: CustomerState }) {
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

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

export function RespondForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState<CustomerState, FormData>(
    customerRespondEstimate,
    {},
  );
  return (
    <div className="mt-2 space-y-2">
      <Msg state={state} />
      <div className="flex gap-2">
        <form action={action} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="approve" />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            {pending ? "..." : "Setujui"}
          </button>
        </form>
        <form action={action} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-white py-2 text-sm font-medium text-red-600 ring-1 ring-red-200 active:opacity-90 disabled:opacity-60"
          >
            {pending ? "..." : "Tolak"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function BookingSection({
  vehicles,
  branches,
  catalog,
}: {
  vehicles: Vehicle[];
  branches: Branch[];
  catalog: Catalog[];
}) {
  const [bookingState, bookingAction, bookingPending] = useActionState<
    CustomerState,
    FormData
  >(customerBooking, {});
  const [vehicleState, vehicleAction, vehiclePending] = useActionState<
    CustomerState,
    FormData
  >(customerAddVehicle, {});
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showBooking, setShowBooking] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowBooking((v) => !v)}
          className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white active:opacity-90"
        >
          {showBooking ? "Tutup Booking" : "+ Booking Servis"}
        </button>
        <button
          type="button"
          onClick={() => setShowAddVehicle((v) => !v)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 active:opacity-90"
        >
          {showAddVehicle ? "Tutup" : "+ Kendaraan"}
        </button>
      </div>

      {showAddVehicle && (
        <form
          action={vehicleAction}
          className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200"
        >
          <p className="text-sm font-semibold text-slate-700">
            Tambah Kendaraan
          </p>
          <Msg state={vehicleState} />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500">
                Plat
              </label>
              <input
                name="plateNumber"
                required
                placeholder="B 1234"
                className={`${inputCls} uppercase`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">
                Merek
              </label>
              <input name="brand" required placeholder="Honda" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500">
                Tipe
              </label>
              <input name="model" required placeholder="Brio" className={inputCls} />
            </div>
          </div>
          <button
            type="submit"
            disabled={vehiclePending}
            className="w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            {vehiclePending ? "Menyimpan..." : "Simpan Kendaraan"}
          </button>
        </form>
      )}

      {showBooking && (
        <form
          action={bookingAction}
          className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200"
        >
          <p className="text-sm font-semibold text-slate-700">
            Booking Servis Baru
          </p>
          <Msg state={bookingState} />
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Kendaraan
            </label>
            <select name="vehicleId" required className={inputCls}>
              <option value="">— Pilih kendaraan —</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plateNumber} · {v.brand} {v.model}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Cabang
            </label>
            <select
              name="branchId"
              required
              defaultValue={branches[0]?.id ?? ""}
              className={inputCls}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Jenis Jasa (opsional)
            </label>
            <select name="catalogId" defaultValue="" className={inputCls}>
              <option value="">— Bebas / keluhan —</option>
              {catalog.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Jadwal (opsional)
            </label>
            <input name="scheduledAt" type="datetime-local" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Keluhan
            </label>
            <textarea
              name="complaint"
              rows={2}
              placeholder="Rem blong, bunyi aneh"
              className={inputCls}
            />
          </div>
          <button
            type="submit"
            disabled={bookingPending}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            {bookingPending ? "Mengirim..." : "Kirim Booking"}
          </button>
        </form>
      )}
    </div>
  );
}
