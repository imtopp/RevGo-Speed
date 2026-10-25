"use client";

import { useActionState, useState } from "react";
import { updateCatalog, type KatalogState } from "./actions";
import { formatRupiah } from "@/lib/service-status";
import { SubmitButton } from "@/components/submit-button";

type Item = {
  id: string;
  nama: string;
  deskripsi: string | null;
  hargaDasar: number;
  allowDp: boolean;
  estimasiMenit: number;
  aktif: boolean;
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

export function CatalogList({ items }: { items: Item[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [state, action] = useActionState<KatalogState, FormData>(
    updateCatalog,
    {},
  );

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const editing = editingId === item.id;
        return (
          <div
            key={item.id}
            className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{item.nama}</p>
                <p className="text-sm text-muted-foreground">
                  {formatRupiah(item.hargaDasar)} · ± {item.estimasiMenit} menit
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.allowDp ? "Boleh DP" : "Lunas penuh"} ·{" "}
                  {item.aktif ? "Aktif" : "Nonaktif"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(editing ? null : item.id)}
                className="shrink-0 text-sm font-medium text-foreground underline underline-offset-2"
              >
                {editing ? "Tutup" : "Ubah"}
              </button>
            </div>

            {editing && (
              <form
                action={action}
                className="mt-3 space-y-3 border-t border-slate-200 pt-3"
              >
                <input type="hidden" name="id" value={item.id} />
                {state.error && (
                  <p className="text-sm text-danger">{state.error}</p>
                )}
                {state.success && (
                  <p className="text-sm text-green-600">{state.success}</p>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Nama Jasa
                  </label>
                  <input name="nama" required defaultValue={item.nama} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground">
                    Deskripsi (opsional)
                  </label>
                  <input
                    name="deskripsi"
                    defaultValue={item.deskripsi ?? ""}
                    className={inputCls}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Harga Dasar (Rp)
                    </label>
                    <input
                      name="hargaDasar"
                      type="number"
                      min={0}
                      defaultValue={item.hargaDasar}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground">
                      Estimasi Durasi (menit)
                    </label>
                    <input
                      name="estimasiMenit"
                      type="number"
                      min={5}
                      max={1440}
                      defaultValue={item.estimasiMenit}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col justify-end gap-1 pb-1 text-sm font-medium text-foreground">
                    <label className="flex items-center gap-2">
                      <input
                        name="allowDp"
                        type="checkbox"
                        defaultChecked={item.allowDp}
                      />
                      Boleh DP
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        name="aktif"
                        type="checkbox"
                        defaultChecked={item.aktif}
                      />
                      Aktif
                    </label>
                  </div>
                </div>
                <SubmitButton
                  pendingText="Menyimpan..."
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
                >
                  Simpan Perubahan
                </SubmitButton>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
