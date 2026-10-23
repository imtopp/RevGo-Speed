"use client";

import { useRouter } from "next/navigation";

type Branch = { id: string; name: string };

export function BranchPicker({
  branches,
  current,
  tab,
}: {
  branches: Branch[];
  current: string | null;
  tab: string;
}) {
  const router = useRouter();
  return (
    <select
      value={current ?? ""}
      onChange={(e) =>
        router.push(`/dashboard/stok?tab=${tab}&branch=${e.target.value}`)
      }
      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
