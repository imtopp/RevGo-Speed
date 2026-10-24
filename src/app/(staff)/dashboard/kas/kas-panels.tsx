"use client";

import { useActionState, useState } from "react";
import { addManualCashflow, type BayarState } from "./actions";
import { formatRupiah, formatTanggalPendek } from "@/lib/service-status";

type Branch = { id: string; name: string };
type Cashflow = {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  amount: number;
  account: "KAS" | "BANK";
  description: string | null;
  createdAt: Date;
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";
const btnPrimary =
  "w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm font-medium text-slate-700 active:opacity-90";

function Msg({ state }: { state: BayarState }) {
  if (state.error)
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>;
  if (state.success)
    return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>;
  return null;
}

export function ManualCashflowForm({
  branches,
  activeBranchId,
  isLocked,
}: {
  branches: Branch[];
  activeBranchId: string | null;
  isLocked: boolean;
}) {
  const [state, action, pending] = useActionState<BayarState, FormData>(addManualCashflow, {});
  return (
    <form action={action} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <p className="text-sm font-semibold text-slate-700">Entri Kas Manual</p>
      <Msg state={state} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Tipe</label>
          <select name="type" defaultValue="INCOME" className={inputCls}>
            <option value="INCOME">Masuk</option>
            <option value="EXPENSE">Keluar</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Kategori</label>
          <input name="category" required placeholder="Operasional, Sewa, Lain" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700">Jumlah (Rp)</label>
          <input name="amount" type="number" min={1} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Kantong</label>
          <select name="account" defaultValue="KAS" className={inputCls}>
            <option value="KAS">Kas</option>
            <option value="BANK">Bank</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Keterangan</label>
        <input name="description" placeholder="opsional" className={inputCls} />
      </div>
      {!isLocked && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Cabang</label>
          <select name="branchId" defaultValue={activeBranchId ?? ""} className={inputCls}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Menyimpan..." : "Catat Kas"}
      </button>
    </form>
  );
}

export function RiwayatList({ items }: { items: Cashflow[] }) {
  if (items.length === 0)
    return (
      <div className="rounded-xl bg-surface p-6 ring-1 ring-slate-200 shadow-card">
        <p className="text-sm text-muted-foreground">Belum ada arus kas.</p>
      </div>
    );
  return (
    <div className="space-y-2">
      {items.map((c) => (
        <div key={c.id} className="rounded-xl bg-surface p-3 ring-1 ring-slate-200 shadow-card">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className={c.type === "INCOME" ? "text-success" : "text-red-600"}>
                  {c.type === "INCOME" ? "+" : "−"}
                  {formatRupiah(c.amount)}
                </span>{" "}
                <span className="text-slate-600">{c.category}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {c.description ?? "—"} · {c.account}
              </p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">
              {formatTanggalPendek(c.createdAt)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToggleManualForm({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className={btnSecondary}>
        {open ? "Tutup" : "+ Entri Kas Manual"}
      </button>
      {open && children}
    </div>
  );
}
