"use client";

import { useActionState } from "react";
import { addPayment, type BayarState } from "./actions";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";
const btnPrimary =
  "w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60";

function Msg({ state }: { state: BayarState }) {
  if (state.error)
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>;
  if (state.success)
    return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>;
  return null;
}

export function PaymentForm({
  serviceId,
  remaining,
  compact,
}: {
  serviceId: string;
  remaining: number;
  compact?: boolean;
}) {
  const [state, action, pending] = useActionState<BayarState, FormData>(addPayment, {});
  if (remaining <= 0) return null;

  return (
    <form
      action={action}
      className={
        compact
          ? "space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200"
          : "space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200"
      }
    >
      <input type="hidden" name="serviceId" value={serviceId} />
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Terima Bayar</p>
        <p className="text-xs text-slate-500">
          Sisa {remaining.toLocaleString("id-ID")}
        </p>
      </div>
      <Msg state={state} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Jumlah (Rp)</label>
          <input name="amount" type="number" min={1} max={remaining} required className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Jenis</label>
          <select name="kind" defaultValue={remaining > 0 ? "PELUNASAN" : "DP"} className={inputCls}>
            <option value="DP">DP</option>
            <option value="PELUNASAN">Bayar</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-slate-700">Metode</label>
          <select name="method" defaultValue="CASH" className={inputCls}>
            <option value="CASH">Tunai (Kas)</option>
            <option value="QRIS">QRIS (Bank)</option>
            <option value="TRANSFER">Transfer (Bank)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Catatan</label>
          <input name="note" placeholder="opsional" className={inputCls} />
        </div>
      </div>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Menyimpan..." : "Catat Pembayaran"}
      </button>
    </form>
  );
}
