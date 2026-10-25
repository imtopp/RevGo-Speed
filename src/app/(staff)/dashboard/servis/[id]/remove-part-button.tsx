"use client";

import { useActionState } from "react";
import { removeServicePart, type ServisState } from "../actions";

/**
 * Tombol hapus satu baris part terpakai — dengan konfirmasi.
 * Part dikembalikan ke stok oleh action-nya (lihat removeServicePart).
 */
export function RemovePartButton({ servicePartId }: { servicePartId: string }) {
  const [state, formAction] = useActionState<ServisState, FormData>(
    removeServicePart,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={servicePartId} />
      <button
        type="submit"
        onClick={(e) => {
          if (
            !confirm(
              "Kembalikan part ini ke stok dan hapus dari tagihan servis?",
            )
          )
            e.preventDefault();
        }}
        className="text-xs font-medium text-danger underline underline-offset-2"
      >
        Hapus
      </button>
      {state.error && (
        <p className="max-w-[14rem] text-right text-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
