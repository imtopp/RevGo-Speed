"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { shouldBackTo } from "@/lib/tab-history";

/**
 * Tombol "Kembali" ala native: mundur lewat riwayat bila halaman sebelumnya
 * memang targetnya (detail → daftar); kalau tidak (deep-link, sesi baru),
 * jadi Link biasa yang membuka targetnya secara normal.
 */
export function BackLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (shouldBackTo(href)) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
