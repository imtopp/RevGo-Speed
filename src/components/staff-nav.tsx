"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Beranda" },
  { href: "/dashboard/servis", label: "Servis" },
  { href: "/dashboard/stok", label: "Stok" },
  { href: "/dashboard/kas", label: "Kas" },
];

export function StaffNav() {
  const pathname = usePathname();

  return (
    <nav className="grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`border-t-2 py-3 text-center text-sm transition-colors ${
              active
                ? "border-slate-900 font-semibold text-slate-900"
                : "border-transparent font-medium text-slate-500"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
