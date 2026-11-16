"use client";

import { useActionState } from "react";
import { customerClaimDp, type CustomerState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

/**
 * Tombol "Sudah Bayar? Konfirmasi via WA": menandai `dpClaimedAt` lewat
 * server action + membuka WhatsApp berisi pesan konfirmasi (dibuka saat
 * klik — gerakan user, lolos popup blocker).
 *
 * Tombol selalu tampil apa adanya setelah ditekan (klaim idempoten) —
 * kalau salah pencet atau perlu kirim ulang pesan, tinggal tekan lagi.
 * Pesan hasil aksi hanya jadi caption kecil di bawahnya.
 */
export function ClaimDpButton({
  id,
  waHref,
}: {
  id: string;
  waHref: string | null;
}) {
  const [state, action] = useActionState<CustomerState, FormData>(
    customerClaimDp,
    {},
  );

  return (
    <div className="space-y-1">
      <form
        onReset={(e) => e.preventDefault()}
        action={action}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <input type="hidden" name="id" value={id} />
        <SubmitButton
          pendingText="Menandai..."
          onClick={() => {
            if (waHref) window.open(waHref, "_blank", "noopener,noreferrer");
          }}
          className="rounded-lg bg-success px-3 py-2 text-xs font-medium text-white active:opacity-90 disabled:opacity-60"
        >
          Sudah Bayar? Konfirmasi via WhatsApp &rarr;
        </SubmitButton>
        <p className="text-[11px] text-muted-foreground">
          Tandai sudah bayar &amp; kirim pesan ke bengkel.
        </p>
      </form>
      {state.error && <p className="text-[11px] text-danger">{state.error}</p>}
      {state.success && (
        <p className="text-[11px] text-success">{state.success}</p>
      )}
    </div>
  );
}
