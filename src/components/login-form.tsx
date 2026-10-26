"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "@/app/login/actions";
import { SubmitButton } from "@/components/submit-button";

function LoginFormInner() {
  const searchParams = useSearchParams();
  const [state, action] = useActionState<LoginState, FormData>(login, {});
  // ?error= dari redirect NextAuth (mis. sesi kedaluwarsa) — pesan generik.
  const redirectedWithError = searchParams.get("error");
  const registered = searchParams.get("registered");
  const gantiBerhasil = searchParams.get("ganti-password");
  const error =
    state.error ??
    (redirectedWithError ? "Email atau password salah." : null);

  return (
    <form onReset={(e) => e.preventDefault()} action={action} className="mt-6 space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {registered && !error && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Pendaftaran berhasil, silakan masuk.
        </p>
      )}
      {gantiBerhasil === "berhasil" && !error && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Password berhasil diganti. Silakan masuk dengan password baru.
        </p>
      )}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
        />
      </div>
      <SubmitButton
        pendingText="Masuk..."
        className="w-full rounded-lg bg-primary py-2.5 font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        Masuk
      </SubmitButton>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  );
}
