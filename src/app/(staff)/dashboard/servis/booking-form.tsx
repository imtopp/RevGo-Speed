"use client";

import { useActionState, useState } from "react";
import { createBooking, type ServisState } from "./actions";

type Branch = { id: string; name: string };
type Catalog = { id: string; nama: string; hargaDasar: number; allowDp: boolean };

export function BookingForm({
  branches,
  catalog,
}: {
  branches: Branch[];
  catalog: Catalog[];
}) {
  const [state, action, pending] = useActionState<ServisState, FormData>(
    createBooking,
    {},
  );
  const [plate, setPlate] = useState("");

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200"
    >
      <p className="text-sm font-semibold text-slate-700">Booking Baru</p>
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Cabang
          </label>
          <select
            name="branchId"
            required
            defaultValue={branches[0]?.id ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
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
            Plat Nomor
          </label>
          <input
            name="plateNumber"
            required
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="B 1234 XYZ"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base uppercase outline-none focus:border-slate-900"
          />
        </div>
      </div>

      {/* Opsi kendaraan baru — tampil jika user mau; server toleran (find-or-create) */}
      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-600">
          Kendaraan belum terdaftar? Isi data di sini
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Merek
              </label>
              <input
                name="brand"
                placeholder="Honda"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Tipe
              </label>
              <input
                name="model"
                placeholder="Brio"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Nama Customer
              </label>
              <input
                name="customerName"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Email Customer
              </label>
              <input
                name="customerEmail"
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                HP (opsional)
              </label>
              <input
                name="customerPhone"
                type="tel"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
            </div>
          </div>
        </div>
      </details>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Jenis Jasa (opsional)
          </label>
          <select
            name="catalogId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          >
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
          <input
            name="scheduledAt"
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">
          Keluhan / Catatan
        </label>
        <textarea
          name="complaint"
          rows={2}
          placeholder="Rem blong, bunyi kretek-kretek"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        {pending ? "Membuat..." : "Buat Booking"}
      </button>
    </form>
  );
}
