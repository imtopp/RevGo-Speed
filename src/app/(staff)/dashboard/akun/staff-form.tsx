"use client";

import { useActionState } from "react";
import { createStaff, type StaffState } from "./actions";

type Branch = { id: string; name: string };

export function StaffForm({ branches }: { branches: Branch[] }) {
  const [state, action, pending] = useActionState<StaffState, FormData>(
    createStaff,
    {},
  );

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
    >
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
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
          <label className="block text-sm font-medium text-slate-700">
            Nama
          </label>
          <input
            name="name"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
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
          <label className="block text-sm font-medium text-slate-700">
            No. HP (opsional)
          </label>
          <input
            name="phone"
            type="tel"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">
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
          <label className="block text-sm font-medium text-slate-700">
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
          <label className="block text-sm font-medium text-slate-700">
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

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-white active:opacity-90 disabled:opacity-60"
      >
        {pending ? "Membuat..." : "Buat Akun"}
      </button>
    </form>
  );
}
