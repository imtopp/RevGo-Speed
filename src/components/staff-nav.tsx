"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@db/prisma/client";

const ADMIN_ROLES: readonly Role[] = ["OWNER", "SYS_ADMIN", "ADMIN"];
const ALL_STAFF: readonly Role[] = ["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"];
const OWNER_SYS: readonly Role[] = ["OWNER", "SYS_ADMIN"];

const BOTTOM_ITEMS = [
  { href: "/dashboard", label: "Beranda", roles: ALL_STAFF },
  { href: "/dashboard/tugas", label: "Tugas", roles: ["MECHANIC"] as readonly Role[] },
  { href: "/dashboard/servis", label: "Servis", roles: ADMIN_ROLES },
  { href: "/dashboard/stok", label: "Stok", roles: ADMIN_ROLES },
  { href: "/dashboard/kas", label: "Kas", roles: ADMIN_ROLES },
  { href: "/dashboard/laporan", label: "Laporan", roles: ADMIN_ROLES },
] as const;

const SIDEBAR_GROUPS: {
  label: string;
  items: readonly { href: string; label: string; roles: readonly Role[] }[];
}[] = [
  {
    label: "Operasional",
    items: [
      { href: "/dashboard", label: "Beranda", roles: ALL_STAFF },
      { href: "/dashboard/tugas", label: "Tugas Saya", roles: ["MECHANIC"] as readonly Role[] },
      { href: "/dashboard/servis", label: "Servis", roles: ADMIN_ROLES },
      { href: "/dashboard/stok", label: "Stok", roles: ADMIN_ROLES },
      { href: "/dashboard/kas", label: "Kas", roles: ADMIN_ROLES },
      { href: "/dashboard/piutang", label: "Piutang", roles: ADMIN_ROLES },
      { href: "/dashboard/laporan", label: "Laporan", roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Sistem",
    items: [
      { href: "/dashboard/katalog", label: "Katalog", roles: OWNER_SYS },
      { href: "/dashboard/pengaturan", label: "Pengaturan", roles: OWNER_SYS },
      { href: "/dashboard/akun", label: "Akun", roles: OWNER_SYS },
      { href: "/dashboard/backup", label: "Backup", roles: OWNER_SYS },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function StaffNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = BOTTOM_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav
      className="grid border-t border-slate-200 bg-surface pb-[env(safe-area-inset-bottom)]"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`border-t-2 py-3 text-center text-sm transition-colors ${
              active
                ? "border-slate-900 font-semibold text-foreground"
                : "border-transparent font-medium text-muted-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 overflow-y-auto p-3">
      {SIDEBAR_GROUPS.map((group) => {
        const items = group.items.filter((item) => item.roles.includes(role));
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="mb-5">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-primary font-semibold text-white"
                        : "font-medium text-slate-600 hover:bg-slate-100 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
