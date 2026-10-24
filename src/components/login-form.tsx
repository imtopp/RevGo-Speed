"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "@/app/login/actions";

function LoginFormInner() {
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    {},
  );
  // ?error= dari redirect NextAuth (mis. sesi kedaluwarsa) — pesan generik.
  const redirectedWithError = searchParams.get("error");
  const registered = searchParams.get("registered");
  const error =
    state.error ??
    (redirectedWithError ? "Email atau password salah." : null);

  return (
    <form action={action} className="mt-6 space-y-4">
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
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary py-2.5 font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        {pending ? "Masuk..." : "Masuk"}
      </button>
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
