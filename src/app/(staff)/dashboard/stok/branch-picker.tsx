"use client";

import { useRouter } from "next/navigation";

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
  return (
    <select
      aria-label="Pilih cabang"
      value={current ?? ""}
      onChange={(e) => {
        const q = new URLSearchParams(params);
        q.set("branch", e.target.value);
        router.push(`${basePath}?${q.toString()}`);
      }}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
