"use client";

import { useActionState, useEffect, useState } from "react";
import { createBranch, updateBranch, type BranchState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { NumberInput } from "@/components/number-input";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  jamBuka: string;
  jamTutup: string;
  hariAktif: string;
  kuotaParalel: number;
  aktif: boolean;
};

const HARI = [
  { v: "0", l: "Min" },
  { v: "1", l: "Sen" },
  { v: "2", l: "Sel" },
  { v: "3", l: "Rab" },
  { v: "4", l: "Kam" },
  { v: "5", l: "Jum" },
  { v: "6", l: "Sab" },
];

function BranchFields({ branch }: { branch?: Branch }) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">Nama</label>
          <input
            name="name"
            required
            defaultValue={branch?.name ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            No. HP
          </label>
          <input
            name="phone"
            defaultValue={branch?.phone ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">
          Alamat
        </label>
        <input
          name="address"
          defaultValue={branch?.address ?? ""}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Jam Buka
          </label>
          <input
            name="jamBuka"
            type="time"
            defaultValue={branch?.jamBuka ?? "08:00"}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Jam Tutup
          </label>
          <input
            name="jamTutup"
            type="time"
            defaultValue={branch?.jamTutup ?? "17:00"}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">
          Kuota Pit Paralel (per jam)
        </label>
        <NumberInput name="kuotaParalel" defaultValue={branch?.kuotaParalel ?? 2} required />
        <p className="mt-1 text-xs text-muted-foreground">
          Jumlah motor yang boleh dikerjakan bersamaan — dasar slot booking.
        </p>
      </div>
      <div>
        <span className="block text-sm font-medium text-foreground">
          Hari Aktif
        </span>
        <div className="mt-1 flex flex-wrap gap-2">
          {HARI.map((h) => {
            const checked = (branch?.hariAktif ?? "1,2,3,4,5,6")
              .split(",")
              .includes(h.v);
            return (
              <label
                key={h.v}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-sm"
              >
                <input
                  type="checkbox"
                  name="hari"
                  value={h.v}
                  defaultChecked={checked}
                />
                {h.l}
              </label>
            );
          })}
        </div>
      </div>
      {branch && (
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            name="aktif"
            defaultChecked={branch.aktif}
          />
          Cabang aktif
        </label>
      )}
    </>
  );
}

export function BranchManager({ branches }: { branches: Branch[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [createState, createAction] = useActionState<
    BranchState,
    FormData
  >(createBranch, {});
  const [editState, editAction] = useActionState<
    BranchState,
    FormData
  >(updateBranch, {});
  const [pesanCreate, setPesanCreate] = useState<string | null>(null);
  const [stateSebelumnya, setStateSebelumnya] = useState(createState);

  // Sukses → tutup form tambah + notif sementara; gagal → form tetap terbuka.
  if (createState !== stateSebelumnya) {
    setStateSebelumnya(createState);
    if (createState.success) {
      setShowCreate(false);
      setPesanCreate(createState.success);
    }
  }

  useEffect(() => {
    if (!pesanCreate) return;
    const t = setTimeout(() => setPesanCreate(null), 5000);
    return () => clearTimeout(t);
  }, [pesanCreate]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowCreate((v) => !v)}
        className="rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm font-medium text-foreground active:opacity-90"
      >
        {showCreate ? "Tutup" : "+ Tambah Cabang"}
      </button>

      {pesanCreate && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {pesanCreate}
        </p>
      )}

      {showCreate && (
        <form
          action={createAction}
          onReset={(e) => e.preventDefault()}
          className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
        >
          <BranchFields />
          {createState.error && (
            <p className="text-sm text-danger">{createState.error}</p>
          )}
          <SubmitButton
            pendingText="Menyimpan..."
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            Buat Cabang
          </SubmitButton>
        </form>
      )}

      <div className="space-y-2">
        {branches.map((branch) => (
          <div
            key={branch.id}
            className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{branch.name}</p>
                <p className="text-sm text-muted-foreground">
                  {branch.jamBuka}–{branch.jamTutup} · {branch.kuotaParalel} pit ·{" "}
                  {branch.aktif ? "Aktif" : "Nonaktif"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingId(editingId === branch.id ? null : branch.id)
                }
                className="text-sm font-medium text-foreground underline underline-offset-2"
              >
                {editingId === branch.id ? "Tutup" : "Ubah"}
              </button>
            </div>

            {editingId === branch.id && (
              <form
                action={editAction}
                onReset={(e) => e.preventDefault()}
                className="mt-3 space-y-3 border-t border-slate-200 pt-3"
              >
                <input type="hidden" name="id" value={branch.id} />
                <BranchFields branch={branch} />
                {editState.error && (
                  <p className="text-sm text-danger">{editState.error}</p>
                )}
                {editState.success && (
                  <p className="text-sm text-green-600">{editState.success}</p>
                )}
                <SubmitButton
                  pendingText="Menyimpan..."
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
                >
                  Simpan Perubahan
                </SubmitButton>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
