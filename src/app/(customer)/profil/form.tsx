"use client";

import { useActionState } from "react";
import { updateProfilWa, type ProfilState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { formatWaLocal } from "@/lib/wa";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

export function ProfilForm({
  name,
  email,
  phone,
}: {
  name: string;
  email: string;
  phone: string | null;
}) {
  const [state, action] = useActionState<ProfilState, FormData>(
    updateProfilWa,
    {},
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Nama
          </p>
          <p className="mt-0.5 font-medium">{name}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Email
          </p>
          <p className="mt-0.5 break-all font-medium">{email}</p>
        </div>
      </div>

      <form
        onReset={(e) => e.preventDefault()}
        action={action}
        className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">
            No. WhatsApp
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dipakai bengkel untuk konfirmasi booking — pastikan nomor aktif
            di WhatsApp.
          </p>
        </div>
        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        {state.success && (
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {state.success}
          </p>
        )}
        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-foreground"
          >
            Nomor WhatsApp
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            defaultValue={phone ? formatWaLocal(phone) : ""}
            placeholder="0812xxxxxxxx — aktif WhatsApp"
            className={inputCls}
          />
        </div>
        <SubmitButton
          pendingText="Menyimpan..."
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
        >
          Simpan No. WhatsApp
        </SubmitButton>
      </form>
    </div>
  );
}
