"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Branch = { id: string; name: string };

export function BranchPicker({
  branches,
  current,
  basePath,
  params,
}: {
  branches: Branch[];
  current: string | null;
  basePath: string;
  params?: Record<string, string>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <select
      aria-label="Pilih cabang"
      aria-busy={isPending}
      value={current ?? ""}
      disabled={isPending}
      onChange={(e) => {
        const value = e.target.value;
        startTransition(() => {
          const q = new URLSearchParams(params);
          q.set("branch", value);
          router.push(`${basePath}?${q.toString()}`);
        });
      }}
      className={`rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60 ${
        isPending ? "animate-pulse" : ""
      }`}
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
