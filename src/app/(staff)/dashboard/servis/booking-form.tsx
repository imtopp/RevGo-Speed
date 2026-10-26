"use client";

import { useActionState, useState } from "react";
import {
  MEREK_GROUPS,
  MEREK_LAINNYA,
  flattenModel,
  normalizePlate,
} from "@/lib/vehicle";
import { createBooking, type ServisState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { SlotPicker } from "@/components/slot-picker";
import { NumberInput } from "@/components/number-input";

type Branch = { id: string; name: string };
type Catalog = { id: string; nama: string; hargaDasar: number; allowDp: boolean; estimasiMenit: number };

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
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [tipeKedatangan, setTipeKedatangan] = useState<"walkin" | "reservasi">("walkin");
  const [jadwal, setJadwal] = useState("");
  const [durasi, setDurasi] = useState(0);
  const [catalogId, setCatalogId] = useState("");
  // null = belum diisi (biarkan `required` yang menahan), false = format salah.
  const plateDiisi = plate.trim() !== "";
  const plateValid = !plateDiisi || !!normalizePlate(plate);
  const tipeOptions =
    merekPilih && merekPilih !== MEREK_LAINNYA
      ? (modelPerMerek[merekPilih] ?? [])
      : flattenModel(modelPerMerek);

  return (
    <form
      onReset={(e) => e.preventDefault()}
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
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
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
            pattern="[A-Za-z]{1,4}\s?\d{1,4}(\s?[A-Za-z]{1,3})?"
            title="Format plat nomor: B 1234 XY"
            aria-invalid={plateDiisi && !plateValid}
            className={`mt-1 w-full rounded-lg border px-3 py-2 text-base uppercase outline-none ${
              plateDiisi && !plateValid
                ? "border-danger focus:border-danger"
                : "border-slate-300 focus:border-slate-900"
            }`}
          />
          {plateDiisi && !plateValid && (
            <p className="mt-1 text-xs text-danger">
              Format plat nomor tidak valid. Contoh: B 1234 XY.
            </p>
          )}
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
                Email Customer{" "}
                <span className="font-normal text-muted-foreground">
                  (opsional)
                </span>
              </label>
              <input
                name="customerEmail"
                type="email"
                placeholder="Biarkan kosong jika tidak mau akun"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tanpa email, customer tetap tercatat tapi tidak bisa login
                online. Dengan email, akun dibuat + password sementara
                ditampilkan setelah booking jadi.
              </p>
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
            value={catalogId}
            onChange={(e) => {
              setCatalogId(e.target.value);
              const c = catalog.find((x) => x.id === e.target.value);
              if (c) setDurasi(c.estimasiMenit);
            }}
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
            Estimasi Durasi (menit)
          </label>
          <NumberInput
            name="durasiMenit"
            value={durasi}
            onChange={setDurasi}
            placeholder={
              catalogId
                ? `otomatis (${catalog.find((c) => c.id === catalogId)?.estimasiMenit ?? 60} menit)`
                : "otomatis (60 menit)"
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">Kedatangan</label>
        <select
          name="kedatangan"
          value={tipeKedatangan}
          onChange={(e) => setTipeKedatangan(e.target.value as "walkin" | "reservasi")}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        >
          <option value="walkin">Datang langsung (walk-in) — tanpa jadwal</option>
          <option value="reservasi">Reservasi — pilih jadwal kedatangan</option>
        </select>
        {tipeKedatangan === "reservasi" ? (
          <SlotPicker
            key={state.success ?? "picker"}
            branchId={branchId}
            value={jadwal}
            onChange={setJadwal}
            pakaiLeadTime={false}
          />
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
            Kedatangan dicatat = sekarang, lalu slot berikutnya otomatis diblokir sesuai
            estimasi durasi (walk-in tidak pernah ditolak).
          </p>
        )}
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
        disabled={!plateValid || (tipeKedatangan === "reservasi" && !jadwal)}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        Buat Booking
      </SubmitButton>
    </form>
  );
}
