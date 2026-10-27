"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { voidPayment, type BayarState } from "../../kas/actions";
import { SubmitButton } from "@/components/submit-button";

export function VoidPaymentForm({
  paymentId,
  onSuccess,
}: {
  paymentId: string;
  onSuccess?: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<BayarState, FormData>(
    voidPayment,
    {},
  );
  // Sukses → kabari pemanggil dari efek (setState komponen lain saat render
  // anak dilarang React); ref menjamin sekali per state baru.
  const sudahDilapor = useRef(state);
  useEffect(() => {
    if (sudahDilapor.current === state) return;
    sudahDilapor.current = state;
    if (state.success) onSuccess?.(state.success);
  }, [state, onSuccess]);

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
    <form onReset={(e) => e.preventDefault()} action={action} className="mt-2 w-full space-y-2 text-left">
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
        <SubmitButton
          pendingText="Membatalkan..."
          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white active:opacity-90 disabled:opacity-60"
        >
          Ya, batalkan
        </SubmitButton>
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
