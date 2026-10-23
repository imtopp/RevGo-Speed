"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@db/prisma/client";

const ALL_ITEMS = [
  { href: "/dashboard", label: "Beranda", roles: ["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"] },
  { href: "/dashboard/servis", label: "Servis", roles: ["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"] },
  { href: "/dashboard/stok", label: "Stok", roles: ["OWNER", "SYS_ADMIN", "ADMIN"] },
  { href: "/dashboard/kas", label: "Kas", roles: ["OWNER", "SYS_ADMIN", "ADMIN"] },
] as const;

export function StaffNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = ALL_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(role),
  );

  return (
    <nav
      className="grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
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
