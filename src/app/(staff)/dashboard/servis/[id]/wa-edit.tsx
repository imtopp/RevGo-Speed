"use client";

import { useActionState, useState } from "react";
import { updateServiceWa, type ServisState } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { formatWaLocal } from "@/lib/wa";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900";

export function WaEdit({
  serviceId,
  current,
  canEdit,
}: {
  serviceId: string;
  current: string | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<ServisState, FormData>(
    updateServiceWa,
    {},
  );

  // Pola render-adjustment (sama dgn staff-nav): setelah sukses, tutup
  // form saat render — tanpa useEffect, tanpa loop.
  if (state.success && editing) setEditing(false);

  return (
    <div className="col-span-2">
      <dt className="text-muted-foreground">No. WhatsApp</dt>
      <dd className="font-medium">
        <span className="flex flex-wrap items-center gap-2">
          <span>{current ? formatWaLocal(current) : "—"}</span>
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-primary underline underline-offset-2"
            >
              Ubah
            </button>
          )}
        </span>
        {canEdit && editing && (
          <form action={action} className="mt-2 space-y-2">
            <input type="hidden" name="id" value={serviceId} />
            {state.error && (
              <p className="rounded-lg bg-red-50 px-2 py-1 text-xs text-danger">
                {state.error}
              </p>
            )}
            <input
              name="phone"
              type="tel"
              required
              defaultValue={current ?? ""}
              placeholder="0812xxxxxxxx — aktif WhatsApp"
              className={inputCls}
            />
            <div className="flex gap-2">
              <SubmitButton
                pendingText="Menyimpan..."
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
              >
                Simpan
              </SubmitButton>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-slate-300 bg-surface px-3 py-1.5 text-sm font-medium text-foreground active:opacity-90"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </dd>
    </div>
  );
}
