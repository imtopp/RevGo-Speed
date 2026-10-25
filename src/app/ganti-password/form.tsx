"use client";

import { useActionState } from "react";
import { gantiPassword, type GantiPasswordState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900";

export function GantiPasswordForm({ wajib }: { wajib: boolean }) {
  const [state, action] = useActionState<GantiPasswordState, FormData>(
    gantiPassword,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {wajib && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Kamu wajib mengganti password sebelum melanjutkan.
        </p>
      )}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="lama" className="block text-sm font-medium text-foreground">
          Password Lama
        </label>
        <input
          id="lama"
          name="lama"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="baru" className="block text-sm font-medium text-foreground">
          Password Baru
        </label>
        <input
          id="baru"
          name="baru"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputCls}
        />
      </div>
      <div>
        <label
          htmlFor="konfirmasi"
          className="block text-sm font-medium text-foreground"
        >
          Ulangi Password Baru
        </label>
        <input
          id="konfirmasi"
          name="konfirmasi"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputCls}
        />
      </div>
      <SubmitButton
        pendingText="Menyimpan..."
        className="w-full rounded-lg bg-primary py-2.5 font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        Simpan Password Baru
      </SubmitButton>
    </form>
  );
}
