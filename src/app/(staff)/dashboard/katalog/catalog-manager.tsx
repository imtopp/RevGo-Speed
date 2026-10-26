"use client";

import { useActionState, useEffect, useState } from "react";
import { createCatalog, type KatalogState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { NumberInput } from "@/components/number-input";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

export function CatalogManager() {
  const [open, setOpen] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [state, action] = useActionState<KatalogState, FormData>(
    createCatalog,
    {},
  );
  const [stateSebelumnya, setStateSebelumnya] = useState(state);

  // Sukses → tutup form + notif sementara di luar form (disesuaikan saat
  // state action berubah — pola React "adjusting state when props change").
  // Gagal → form tetap terbuka, error tampil di dalam form.
  if (state !== stateSebelumnya) {
    setStateSebelumnya(state);
    if (state.success) {
      setOpen(false);
      setPesan(state.success);
    }
  }

  // Auto-hilangkan notif sukses.
  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 5000);
    return () => clearTimeout(t);
  }, [pesan]);

  return (
    <div className="max-w-lg space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:opacity-90"
      >
        {open ? "Tutup Tambah Jasa" : "+ Tambah Jasa"}
      </button>

      {pesan && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {pesan}
        </p>
      )}

      {open && (
        <form
          action={action}
          className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
        >
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {state.error}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground">Nama Jasa</label>
            <input
              name="nama"
              required
              placeholder="Servis Rutin 3.000 km"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">
              Deskripsi (opsional)
            </label>
            <input
              name="deskripsi"
              placeholder="Ganti oli + filter, cek rem"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-foreground">
                Harga Dasar (Rp)
              </label>
              <NumberInput name="hargaDasar" defaultValue={0} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground">
                Estimasi Durasi (menit)
              </label>
              <NumberInput name="estimasiMenit" defaultValue={60} required />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input name="allowDp" type="checkbox" />
                Boleh DP
              </label>
            </div>
          </div>
          <SubmitButton
            pendingText="Menyimpan..."
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            Tambah Jasa
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
