"use client";

import { useActionState, useEffect, useState } from "react";
import { addManualCashflow, type BayarState } from "./actions";
import { formatRupiah, formatTanggalPendek } from "@/lib/service-status";
import { SubmitButton } from "@/components/submit-button";
import { NumberInput } from "@/components/number-input";

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
  "rounded-lg border border-slate-300 bg-surface px-3 py-2 text-sm font-medium text-foreground active:opacity-90";

export function ManualCashflowForm({
  branches,
  activeBranchId,
  isLocked,
}: {
  branches: Branch[];
  activeBranchId: string | null;
  isLocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [state, action] = useActionState<BayarState, FormData>(addManualCashflow, {});
  const [stateSebelumnya, setStateSebelumnya] = useState(state);

  // Sukses → tutup form + notif sementara; gagal → form tetap terbuka.
  if (state !== stateSebelumnya) {
    setStateSebelumnya(state);
    if (state.success) {
      setOpen(false);
      setPesan(state.success);
    }
  }

  useEffect(() => {
    if (!pesan) return;
    const t = setTimeout(() => setPesan(null), 5000);
    return () => clearTimeout(t);
  }, [pesan]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className={btnSecondary}>
        {open ? "Tutup" : "+ Entri Kas Manual"}
      </button>

      {pesan && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{pesan}</p>
      )}

      {open && (
    <form action={action} onReset={(e) => e.preventDefault()} className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <p className="text-sm font-semibold text-foreground">Entri Kas Manual</p>
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Tipe</label>
          <select name="type" defaultValue="INCOME" className={inputCls}>
            <option value="INCOME">Masuk</option>
            <option value="EXPENSE">Keluar</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Kategori</label>
          <input name="category" required placeholder="Operasional, Sewa, Lain" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-foreground">Jumlah (Rp)</label>
          <NumberInput name="amount" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">Kantong</label>
          <select name="account" defaultValue="KAS" className={inputCls}>
            <option value="KAS">Kas</option>
            <option value="BANK">Bank</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground">Keterangan</label>
        <input name="description" placeholder="opsional" className={inputCls} />
      </div>
      {!isLocked && (
        <div>
          <label className="block text-sm font-medium text-foreground">Cabang</label>
          <select name="branchId" defaultValue={activeBranchId ?? ""} className={inputCls}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
      <SubmitButton pendingText="Menyimpan..." className={btnPrimary}>
        Catat Kas
      </SubmitButton>
    </form>
      )}
    </div>
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
                <span className={c.type === "INCOME" ? "text-success" : "text-danger"}>
                  {c.type === "INCOME" ? "+" : "−"}
                  {formatRupiah(c.amount)}
                </span>{" "}
                <span className="text-muted-foreground">{c.category}</span>
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

