"use client";

import { useActionState, useState } from "react";
import { MEREK_GROUPS, MEREK_LAINNYA, flattenModel } from "@/lib/vehicle";
import { createBooking, type ServisState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type Branch = { id: string; name: string };
type Catalog = { id: string; nama: string; hargaDasar: number; allowDp: boolean };

export function BookingForm({
  branches,
  catalog,
  modelPerMerek,
}: {
  branches: Branch[];
  catalog: Catalog[];
  modelPerMerek: Record<string, string[]>;
}) {
  const [state, action] = useActionState<ServisState, FormData>(
    createBooking,
    {},
  );
  const [plate, setPlate] = useState("");
  const [merekPilih, setMerekPilih] = useState("");
  const tipeOptions =
    merekPilih && merekPilih !== MEREK_LAINNYA
      ? (modelPerMerek[merekPilih] ?? [])
      : flattenModel(modelPerMerek);

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
    >
      <p className="text-sm font-semibold text-foreground">Booking Baru</p>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">
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
          <label className="block text-sm font-medium text-foreground">
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
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          Kendaraan belum terdaftar? Isi data di sini
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground">
                Merek
              </label>
              <select
                name="brand"
                value={merekPilih}
                onChange={(e) => setMerekPilih(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              >
                <option value="">— Pilih merek —</option>
                {MEREK_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={MEREK_LAINNYA}>{MEREK_LAINNYA}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                Tipe
              </label>
              <input
                name="model"
                placeholder="Vario"
                list="tipe-kendaraan-staff"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
              <datalist id="tipe-kendaraan-staff">
                {tipeOptions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
          </div>
          {merekPilih === MEREK_LAINNYA && (
            <div>
              <label className="block text-sm font-medium text-foreground">
                Merek lainnya
              </label>
              <input
                name="brandLain"
                placeholder="Tulis merek"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-foreground">
                Nama Customer
              </label>
              <input
                name="customerName"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                Email Customer
              </label>
              <input
                name="customerEmail"
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
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
          <label className="block text-sm font-medium text-foreground">
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
          <label className="block text-sm font-medium text-foreground">
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
        <label className="block text-sm font-medium text-foreground">
          Keluhan / Catatan
        </label>
        <textarea
          name="complaint"
          rows={2}
          placeholder="Rem blong, bunyi kretek-kretek"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
      </div>

      <SubmitButton
        pendingText="Membuat..."
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        Buat Booking
      </SubmitButton>
    </form>
  );
}
