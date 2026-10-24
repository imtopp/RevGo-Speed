"use client";

import { useActionState } from "react";
import { createCatalog, type KatalogState } from "./actions";

export function CatalogManager() {
  const [state, action, pending] = useActionState<KatalogState, FormData>(
    createCatalog,
    {},
  );

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
    >
      <p className="text-sm font-semibold text-slate-700">Tambah Jasa Baru</p>
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
      <div>
        <label className="block text-sm font-medium text-slate-700">Nama Jasa</label>
        <input
          name="nama"
          required
          placeholder="Servis Rutin 5.000 km"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">
          Deskripsi (opsional)
        </label>
        <input
          name="deskripsi"
          placeholder="Ganti oli + filter, cek rem"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Harga Dasar (Rp)
          </label>
          <input
            name="hargaDasar"
            type="number"
            min={0}
            defaultValue={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input name="allowDp" type="checkbox" />
            Boleh DP
          </label>
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        {pending ? "Menyimpan..." : "Tambah Jasa"}
      </button>
    </form>
  );
}
