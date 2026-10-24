"use client";

import { useState, type MouseEvent, type ReactNode } from "react";

type Props = {
  href: string;
  filename?: string;
  className?: string;
  children: ReactNode;
};

export function DownloadLink({
  href,
  filename = "download",
  className = "",
  children,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(href);
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || contentType.includes("text/html")) throw new Error("bad response");
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
      const name = match ? decodeURIComponent(match[1]) : filename;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-busy={busy}
      aria-disabled={busy}
      className={`${className}${busy ? " pointer-events-none opacity-60" : ""}`}
    >
      {busy ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          Menyiapkan...
        </span>
      ) : error ? (
        "Gagal mengunduh — coba lagi"
      ) : (
        children
      )}
    </a>
  );
}
