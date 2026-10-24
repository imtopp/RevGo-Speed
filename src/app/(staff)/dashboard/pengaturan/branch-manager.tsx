"use client";

import { useActionState, useState } from "react";
import { createBranch, updateBranch, type BranchState } from "./actions";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  jamBuka: string;
  jamTutup: string;
  hariAktif: string;
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
          <label className="block text-sm font-medium text-slate-700">Nama</label>
          <input
            name="name"
            required
            defaultValue={branch?.name ?? ""}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
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
        <label className="block text-sm font-medium text-slate-700">
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
          <label className="block text-sm font-medium text-slate-700">
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
          <label className="block text-sm font-medium text-slate-700">
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
        <span className="block text-sm font-medium text-slate-700">
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
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
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

  const [createState, createAction, createPending] = useActionState<
    BranchState,
    FormData
  >(createBranch, {});
  const [editState, editAction, editPending] = useActionState<
    BranchState,
    FormData
  >(updateBranch, {});

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowCreate((v) => !v)}
        className="rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm font-medium text-slate-700 active:opacity-90"
      >
        {showCreate ? "Tutup" : "+ Tambah Cabang"}
      </button>

      {showCreate && (
        <form
          action={createAction}
          className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
        >
          <BranchFields />
          {createState.error && (
            <p className="text-sm text-red-600">{createState.error}</p>
          )}
          {createState.success && (
            <p className="text-sm text-green-600">{createState.success}</p>
          )}
          <button
            type="submit"
            disabled={createPending}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
          >
            {createPending ? "Menyimpan..." : "Buat Cabang"}
          </button>
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
                  {branch.jamBuka}–{branch.jamTutup} ·{" "}
                  {branch.aktif ? "Aktif" : "Nonaktif"}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditingId(editingId === branch.id ? null : branch.id)
                }
                className="text-sm font-medium text-slate-700 underline underline-offset-2"
              >
                {editingId === branch.id ? "Tutup" : "Ubah"}
              </button>
            </div>

            {editingId === branch.id && (
              <form
                action={editAction}
                className="mt-3 space-y-3 border-t border-slate-200 pt-3"
              >
                <input type="hidden" name="id" value={branch.id} />
                <BranchFields branch={branch} />
                {editState.error && (
                  <p className="text-sm text-red-600">{editState.error}</p>
                )}
                {editState.success && (
                  <p className="text-sm text-green-600">{editState.success}</p>
                )}
                <button
                  type="submit"
                  disabled={editPending}
                  className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
                >
                  {editPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
