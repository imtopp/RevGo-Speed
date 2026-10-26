"use client";

import { useActionState, useEffect, useState } from "react";
import {
  MEREK_GROUPS,
  MEREK_LAINNYA,
  flattenModel,
  merekDikenal,
  normalizeMerek,
} from "@/lib/vehicle";
import {
  customerBooking,
  customerAddVehicle,
  customerUpdateVehicle,
  customerDeleteVehicle,
  customerRespondEstimate,
  type CustomerState,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { SlotPicker } from "@/components/slot-picker";

type Vehicle = { id: string; plateNumber: string; brand: string; model: string };
type Branch = { id: string; name: string };
type Catalog = { id: string; nama: string };

function Msg({ state }: { state: CustomerState }) {
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

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

function MerekSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      name="brand"
      required
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputCls}
    >
      <option value="" disabled>
        Pilih merek
      </option>
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
  );
}

export function RespondForm({ id }: { id: string }) {
  const [state, action] = useActionState<CustomerState, FormData>(
    customerRespondEstimate,
    {},
  );
  return (
    <div className="mt-2 space-y-2">
      <Msg state={state} />
      <div className="flex gap-2">
        <form onReset={(e) => e.preventDefault()} action={action} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="approve" />
          <SubmitButton className="w-full rounded-lg bg-success py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60">
            Setujui
          </SubmitButton>
        </form>
        <form onReset={(e) => e.preventDefault()} action={action} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="reject" />
          <SubmitButton className="w-full rounded-lg bg-surface py-2 text-sm font-medium text-danger ring-1 ring-red-200 active:opacity-90 disabled:opacity-60">
            Tolak
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function VehicleRow({
  vehicle,
  modelPerMerek,
  onFlash,
}: {
  vehicle: Vehicle;
  modelPerMerek: Record<string, string[]>;
  onFlash: (msg: string) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [merekPilih, setMerekPilih] = useState(
    merekDikenal(vehicle.brand) ? normalizeMerek(vehicle.brand) : MEREK_LAINNYA,
  );

  const runUpdate = async (prev: CustomerState, fd: FormData) => {
    const r = await customerUpdateVehicle(prev, fd);
    if (r.success) {
      setEdit(false);
      onFlash(r.success);
    }
    return r;
  };
  const runDelete = async (prev: CustomerState, fd: FormData) => {
    const r = await customerDeleteVehicle(prev, fd);
    if (r.success) onFlash(r.success);
    return r;
  };
  const [uState, uAction] = useActionState(runUpdate, {});
  const [dState, dAction] = useActionState(runDelete, {});

  const tipeOptions =
    merekPilih && merekPilih !== MEREK_LAINNYA
      ? (modelPerMerek[merekPilih] ?? [])
      : flattenModel(modelPerMerek);
  const datalistId = `tipe-${vehicle.id}`;

  if (edit) {
    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <form onReset={(e) => e.preventDefault()} action={uAction} className="space-y-2">
          <input type="hidden" name="id" value={vehicle.id} />
          {!uState.success && <Msg state={uState} />}
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              Plat
            </label>
            <input
              name="plateNumber"
              required
              defaultValue={vehicle.plateNumber}
              pattern="[A-Za-z]{1,4}\s?\d{1,4}(\s?[A-Za-z]{1,3})?"
              title="Format plat nomor: B 1234 XY"
              className={`${inputCls} uppercase`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              Merek
            </label>
            <MerekSelect value={merekPilih} onChange={setMerekPilih} />
          </div>
          {merekPilih === MEREK_LAINNYA && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Merek lainnya
              </label>
              <input
                name="brandLain"
                required
                defaultValue={merekDikenal(vehicle.brand) ? "" : vehicle.brand}
                placeholder="Tulis merek"
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              Tipe
            </label>
            <input
              name="model"
              required
              defaultValue={vehicle.model}
              list={datalistId}
              className={inputCls}
            />
            <datalist id={datalistId}>
              {tipeOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div className="flex gap-2">
            <SubmitButton
              pendingText="Menyimpan..."
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
            >
              Simpan
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEdit(false)}
              className="rounded-lg border border-slate-300 bg-surface px-4 py-2 text-sm font-medium text-foreground active:opacity-90"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{vehicle.plateNumber}</p>
          <p className="truncate text-sm text-muted-foreground">
            {vehicle.brand} {vehicle.model}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setEdit(true)}
            className="rounded-lg border border-slate-300 bg-surface px-3 py-1.5 text-sm font-medium text-foreground active:opacity-90"
          >
            Ubah
          </button>
          <form
            onReset={(e) => e.preventDefault()}
            action={dAction}
            onSubmit={(e) => {
              if (!confirm("Hapus kendaraan ini dari daftarmu?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={vehicle.id} />
            <SubmitButton
              pendingText="Menghapus..."
              className="rounded-lg border border-red-200 bg-surface px-3 py-1.5 text-sm font-medium text-danger active:opacity-90 disabled:opacity-60"
            >
              Hapus
            </SubmitButton>
          </form>
        </div>
      </div>
      <Msg state={dState} />
    </div>
  );
}

export function BookingSection({
  vehicles,
  branches,
  catalog,
  modelPerMerek,
}: {
  vehicles: Vehicle[];
  branches: Branch[];
  catalog: Catalog[];
  modelPerMerek: Record<string, string[]>;
}) {
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [jadwal, setJadwal] = useState("");

  const runBooking = async (prev: CustomerState, fd: FormData) => {
    const r = await customerBooking(prev, fd);
    if (r.success) {
      setFlash(r.success);
      setShowBooking(false);
      setJadwal("");
    }
    return r;
  };
  const runAddVehicle = async (prev: CustomerState, fd: FormData) => {
    const r = await customerAddVehicle(prev, fd);
    if (r.success) {
      setFlash(r.success);
      setShowAddVehicle(false);
    }
    return r;
  };
  const [bookingState, bookingAction] = useActionState(runBooking, {});
  const [vehicleState, vehicleAction] = useActionState(runAddVehicle, {});

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);
  const [merekPilih, setMerekPilih] = useState("");
  const tipeOptions =
    merekPilih && merekPilih !== MEREK_LAINNYA
      ? (modelPerMerek[merekPilih] ?? [])
      : flattenModel(modelPerMerek);

  return (
    <div className="space-y-3">
      {flash && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {flash}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setFlash(null);
          setShowBooking((v) => !v);
        }}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:opacity-90"
      >
        {showBooking ? "Tutup Booking Servis" : "+ Booking Servis Baru"}
      </button>

      {showBooking && (
        <form
          onReset={(e) => e.preventDefault()}
          action={bookingAction}
          className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
        >
          <p className="text-sm font-semibold text-foreground">
            Booking Servis Baru
          </p>
          {!bookingState.success && <Msg state={bookingState} />}
          {vehicles.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Belum ada kendaraan — tambah dulu lewat kartu Kendaraan Saya di
              bawah.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground">
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
            <label className="block text-sm font-medium text-foreground">
              Cabang
            </label>
            <select
              name="branchId"
              required
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setJadwal("");
              }}
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
            <label className="block text-sm font-medium text-foreground">
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
            <label className="block text-sm font-medium text-foreground">
              Jadwal Kedatangan (wajib)
            </label>
            <SlotPicker
              branchId={branchId}
              value={jadwal}
              onChange={setJadwal}
              pakaiLeadTime
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Keluhan
            </label>
            <textarea
              name="complaint"
              rows={2}
              placeholder="Rem blong, bunyi aneh"
              className={inputCls}
            />
          </div>
          <SubmitButton
            pendingText="Mengirim..."
            disabled={!jadwal}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            Kirim Booking
          </SubmitButton>
          {!jadwal && (
            <p className="text-center text-xs text-muted-foreground">
              Pilih jam kedatangan dulu — tombol kirim aktif setelah slot dipilih.
            </p>
          )}
        </form>
      )}

      <div className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">
            Kendaraan Saya
          </p>
          <button
            type="button"
            onClick={() => {
              setFlash(null);
              setShowAddVehicle((v) => !v);
            }}
            className="rounded-lg border border-slate-300 bg-surface px-3 py-1.5 text-sm font-medium text-foreground active:opacity-90"
          >
            {showAddVehicle ? "Tutup" : "+ Tambah"}
          </button>
        </div>
        {showAddVehicle && (
          <form onReset={(e) => e.preventDefault()} action={vehicleAction} className="space-y-3">
            <p className="text-sm font-semibold text-foreground">
              Tambah Kendaraan
            </p>
            {!vehicleState.success && <Msg state={vehicleState} />}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Plat
                </label>
                <input
                  name="plateNumber"
                  required
                  placeholder="B 1234 XY"
                  pattern="[A-Za-z]{1,4}\s?\d{1,4}(\s?[A-Za-z]{1,3})?"
                  title="Format plat nomor: B 1234 XY"
                  className={`${inputCls} uppercase`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Merek
                </label>
                <MerekSelect value={merekPilih} onChange={setMerekPilih} />
              </div>
              {merekPilih === MEREK_LAINNYA && (
                <div className="col-span-3">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Merek lainnya
                  </label>
                  <input
                    name="brandLain"
                    required
                    placeholder="Tulis merek"
                    className={inputCls}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  Tipe
                </label>
                <input
                  name="model"
                  required
                  placeholder="Vario"
                  list="tipe-kendaraan"
                  className={inputCls}
                />
                <datalist id="tipe-kendaraan">
                  {tipeOptions.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>
            <SubmitButton
              pendingText="Menyimpan..."
              className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
            >
              Simpan Kendaraan
            </SubmitButton>
          </form>
        )}
        {vehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada kendaraan — ketuk + Tambah di atas.
          </p>
        ) : (
          <div className="space-y-2">
            {vehicles.map((v) => (
              <VehicleRow
                key={v.id}
                vehicle={v}
                modelPerMerek={modelPerMerek}
                onFlash={setFlash}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
