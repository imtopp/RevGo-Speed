"use client";

import { useActionState, useState } from "react";
import { refundKelebihan, type BayarState } from "../../kas/actions";
import { SubmitButton } from "@/components/submit-button";
import { formatRupiah } from "@/lib/service-status";

/**
 * Pengembalian kelebihan bayar — hanya Owner (uang keluar tanpa imbalan aset).
 * Angka kelebihan dihitung ulang di server; form hanya memilih metode + alasan.
 */
export function RefundForm({
  serviceId,
  kelebihan,
}: {
  serviceId: string;
  kelebihan: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<BayarState, FormData>(
    refundKelebihan,
    {},
  );

  if (state.success) {
    return (
      <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
        {state.success}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-slate-300 bg-surface px-4 py-2.5 text-sm font-medium text-foreground active:opacity-90"
      >
        Kembalikan kelebihan {formatRupiah(kelebihan)}…
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
      <input type="hidden" name="serviceId" value={serviceId} />
      <p className="text-sm font-semibold text-foreground">
        Kembalikan kelebihan {formatRupiah(kelebihan)}
      </p>
      <p className="text-xs text-muted-foreground">
        Kas keluar otomatis dicatat — servis langsung lunas.
      </p>
      <label className="block text-sm font-medium text-foreground">
        Metode pengembalian
        <select
          name="method"
          defaultValue="CASH"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        >
          <option value="CASH">Tunai (KAS)</option>
          <option value="QRIS">QRIS (BANK)</option>
          <option value="TRANSFER">Transfer (BANK)</option>
        </select>
      </label>
      <input
        name="reason"
        required
        minLength={4}
        autoFocus
        placeholder="Alasan pengembalian (wajib)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
      />
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <SubmitButton
          pendingText="Mengembalikan…"
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
        >
          Ya, kembalikan
        </SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-200 bg-surface px-4 py-2.5 text-sm text-muted-foreground"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
