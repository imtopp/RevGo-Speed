"use client";

import { useActionState, useState } from "react";
import { voidPayment, type BayarState } from "../../kas/actions";

export function VoidPaymentForm({ paymentId }: { paymentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<BayarState, FormData>(
    voidPayment,
    {},
  );

  if (state.success) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-danger underline underline-offset-2"
      >
        Batalkan
      </button>
    );
  }

  return (
    <form action={action} className="mt-2 w-full space-y-2 text-left">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input
        name="reason"
        required
        minLength={4}
        autoFocus
        placeholder="Alasan pembatalan (wajib)"
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-red-500"
      />
      {state.error && (
        <p className="text-xs text-danger">{state.error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white active:opacity-90 disabled:opacity-60"
        >
          {pending ? "Membatalkan..." : "Ya, batalkan"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs text-muted-foreground"
        >
          Tutup
        </button>
      </div>
    </form>
  );
}
