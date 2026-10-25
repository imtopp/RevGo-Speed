"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

function Isi({
  children,
  pendingLabel,
}: {
  children: ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return <>{children}</>;
  return (
    <span aria-live="polite" className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden
      />
      {pendingLabel}
    </span>
  );
}

/**
 * Link biasa dengan indikator "Memuat…" selama halaman dimuat ulang.
 * Dipakai untuk aksi ganti query dalam halaman yang sama (tab/filter/toggle) —
 * navigasi searchParams tidak memicu loading.tsx, jadi tanpa indikator ini
 * terlihat tidak ada respon.
 */
export function PendingLink({
  href,
  children,
  className,
  pendingLabel = "Memuat…",
}: {
  href: string;
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  return (
    <Link href={href} className={className}>
      <Isi pendingLabel={pendingLabel}>{children}</Isi>
    </Link>
  );
}
