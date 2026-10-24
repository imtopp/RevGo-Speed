"use client";

import { useActionState, useState } from "react";
import { createStaff, type StaffState } from "./actions";
import { SubmitButton } from "@/components/submit-button";

type Branch = { id: string; name: string };

export function StaffForm({ branches }: { branches: Branch[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<StaffState, FormData>(
    createStaff,
    {},
  );

  return (
    <div className="max-w-lg space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white active:opacity-90"
      >
        {open ? "Tutup Form Akun" : "+ Buat Akun Staff"}
      </button>

      {open && (
        <form
          action={action}
          className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
        >
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Nama
          </label>
          <input
            name="name"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">
            No. HP (opsional)
          </label>
          <input
            name="phone"
            type="tel"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-foreground">
            Role
          </label>
          <select
            name="role"
            defaultValue="ADMIN"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          >
            <option value="SYS_ADMIN">System Administrator</option>
            <option value="ADMIN">Admin</option>
            <option value="MECHANIC">Mekanik</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">
            Cabang (Admin/Mekanik)
          </label>
          <select
            name="branchId"
            defaultValue=""
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          >
            <option value="">— Lintas cabang (SysAdmin) —</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SubmitButton
        pendingText="Membuat..."
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        Buat Akun
      </SubmitButton>
        </form>
      )}
    </div>
  );
}
