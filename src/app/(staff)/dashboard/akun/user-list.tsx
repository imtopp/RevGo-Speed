"use client";

import { useActionState, useState } from "react";
import {
  resetPassword,
  toggleActive,
  assignBranch,
  type StaffState,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  isActive: boolean;
  branch: { id: string; name: string } | null;
};

type Branch = { id: string; name: string };

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  SYS_ADMIN: "SysAdmin",
  ADMIN: "Admin",
  MECHANIC: "Mekanik",
  CUSTOMER: "Customer",
};

function ActionPanel({
  user,
  branches,
}: {
  user: UserRow;
  branches: Branch[];
}) {
  const [resetState, resetAction] = useActionState<StaffState, FormData>(
    resetPassword,
    {},
  );
  const [toggleState, toggleAction] = useActionState<StaffState, FormData>(
    toggleActive,
    {},
  );
  const [assignState, assignAction] = useActionState<StaffState, FormData>(
    assignBranch,
    {},
  );

  const isOwner = user.role === "OWNER";
  const isSysAdmin = user.role === "SYS_ADMIN";
  const assignable = !isOwner && !isSysAdmin;

  return (
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
      {assignable && (
        <form action={assignAction} className="flex items-end gap-2">
          <input type="hidden" name="id" value={user.id} />
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground">
              Cabang
            </label>
            <select
              name="branchId"
              defaultValue={user.branch?.id ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
            >
              <option value="">— Lintas cabang —</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton
            pendingText="..."
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-foreground active:opacity-90 disabled:opacity-60"
          >
            Assign
          </SubmitButton>
        </form>
      )}

      {!isOwner && (
        <form action={resetAction} className="flex items-end gap-2">
          <input type="hidden" name="id" value={user.id} />
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground">
              Password Baru
            </label>
            <input
              name="password"
              type="password"
              minLength={6}
              placeholder="min. 6 karakter"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
            />
          </div>
          <SubmitButton
            pendingText="..."
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-foreground active:opacity-90 disabled:opacity-60"
          >
            Reset
          </SubmitButton>
        </form>
      )}

      {!isOwner && (
        <form action={toggleAction}>
          <input type="hidden" name="id" value={user.id} />
          <SubmitButton
            pendingText="..."
            aria-label={
              user.isActive
                ? `Nonaktifkan ${user.name}`
                : `Aktifkan ${user.name}`
            }
            onClick={(e) => {
              if (
                user.isActive &&
                !confirm(`Nonaktifkan akun ${user.name}? Ia tidak bisa login.`)
              ) {
                e.preventDefault();
              }
            }}
            className={`w-full rounded-lg px-3 py-1.5 text-sm font-medium active:opacity-90 disabled:opacity-60 ${
              user.isActive
                ? "bg-red-50 text-danger ring-1 ring-red-200"
                : "bg-green-50 text-green-700 ring-1 ring-green-200"
            }`}
          >
            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
          </SubmitButton>
        </form>
      )}

      {(resetState.error || toggleState.error || assignState.error) && (
        <p className="text-sm text-danger">
          {resetState.error || toggleState.error || assignState.error}
        </p>
      )}
      {(resetState.success || toggleState.success || assignState.success) && (
        <p className="text-sm text-green-600">
          {resetState.success || toggleState.success || assignState.success}
        </p>
      )}
    </div>
  );
}

export function UserList({
  users,
  branches,
}: {
  users: UserRow[];
  branches: Branch[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="rounded-xl bg-surface p-4 ring-1 ring-slate-200 shadow-card"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium">{user.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {user.email ?? "tanpa email — tidak bisa login"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {ROLE_LABEL[user.role] ?? user.role} ·{" "}
                {user.branch?.name ?? "Lintas cabang"} ·{" "}
                {user.isActive ? "Aktif" : "Nonaktif"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenId(openId === user.id ? null : user.id)}
              className="shrink-0 text-sm font-medium text-foreground underline underline-offset-2"
            >
              {openId === user.id ? "Tutup" : "Atur"}
            </button>
          </div>

          {openId === user.id && <ActionPanel user={user} branches={branches} />}
        </div>
      ))}
    </div>
  );
}
