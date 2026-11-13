"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import type { Role } from "@db/prisma/client";
import {
  disposeTabHistory,
  handleTabNavigate,
  initTabHistory,
  notePathname,
} from "@/lib/tab-history";

const ADMIN_ROLES: readonly Role[] = ["OWNER", "ADMIN"];
const ALL_STAFF: readonly Role[] = ["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"];
const OWNER_SYS: readonly Role[] = ["OWNER", "SYS_ADMIN"];

const BOTTOM_ITEMS = [
  { href: "/dashboard", label: "Beranda", roles: ALL_STAFF },
  { href: "/dashboard/tugas", label: "Tugas Saya", roles: ["MECHANIC"] as readonly Role[] },
  { href: "/dashboard/servis", label: "Servis", roles: ADMIN_ROLES },
  { href: "/dashboard/stok", label: "Stok", roles: ADMIN_ROLES },
  { href: "/dashboard/kas", label: "Kas", roles: ADMIN_ROLES },
  { href: "/dashboard/piutang", label: "Piutang", roles: ADMIN_ROLES },
  { href: "/dashboard/laporan", label: "Laporan", roles: ADMIN_ROLES },
  { href: "/dashboard/audit", label: "Audit", roles: ["OWNER"] as readonly Role[] },
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
      { href: "/dashboard/katalog", label: "Katalog", roles: ["OWNER"] as readonly Role[] },
      { href: "/dashboard/pengaturan", label: "Pengaturan", roles: OWNER_SYS },
      { href: "/dashboard/akun", label: "Akun", roles: OWNER_SYS },
      { href: "/dashboard/backup", label: "Backup", roles: OWNER_SYS },
      { href: "/dashboard/update", label: "Update", roles: ["SYS_ADMIN"] as readonly Role[] },
      { href: "/dashboard/audit", label: "Audit", roles: ["OWNER"] as readonly Role[] },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

/**
 * Bottom-nav mobile: item sidebar yang TIDAK muat di bar bawah (grup Sistem:
 * Katalog, Pengaturan, Akun, Backup, Update) dibuka lewat sheet "Lainnya".
 * Diturunkan otomatis dari SIDEBAR_GROUPS − BOTTOM_ITEMS supaya mobile selalu
 * punya paritas penuh dengan sidebar desktop.
 */
function moreItemsFor(role: Role) {
  return SIDEBAR_GROUPS.flatMap((group) => group.items).filter(
    (item) =>
      item.roles.includes(role) &&
      !BOTTOM_ITEMS.some((bottom) => bottom.href === item.href),
  );
}

export function StaffNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  // Tutup sheet saat pindah halaman — adjust saat render (pola React, bukan
  // setState di dalam useEffect).
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  // Pelacak riwayat tab (lib/tab-history): aktif selama nav mobile terpasang
  // (selalu ter-mount di layout staff — hanya disembunyikan CSS di desktop).
  useEffect(() => {
    initTabHistory();
    return () => disposeTabHistory();
  }, []);
  useEffect(() => {
    notePathname(pathname);
  }, [pathname]);
  // Pindah tab = runtuhkan riwayat ke Beranda dulu, lalu buka tab baru →
  // back dari tab mana pun selalu ke Beranda (perilaku native).
  const onTab = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    handleTabNavigate(href, (h) => router.push(h));
  };
  const items = BOTTOM_ITEMS.filter((item) => item.roles.includes(role));
  const more = moreItemsFor(role);
  const showMore = more.length > 0;
  const total = items.length + (showMore ? 1 : 0);
  const moreActive = showMore && more.some((item) => isActive(pathname, item.href));

  // Esc menutup sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const tabCls = (active: boolean) =>
    `border-t-2 py-3 text-center transition-colors ${
      total > 5 ? "text-xs" : "text-sm"
    } ${
      active
        ? "border-slate-900 font-semibold text-foreground"
        : "border-transparent font-medium text-muted-foreground"
    }`;

  return (
    <>
      <nav
        className="grid border-t border-slate-200 bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={tabCls(active)}
              onClick={(e) => onTab(e, item.href)}
            >
              {item.label}
            </Link>
          );
        })}
        {showMore && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-lainnya"
            className={tabCls(moreActive)}
          >
            Lainnya
          </button>
        )}
      </nav>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      {open && (
        <div
          id="menu-lainnya"
          role="menu"
          className="absolute bottom-full left-0 right-0 z-50 border-t border-slate-200 bg-surface px-2 py-2 shadow-card"
        >
          {more.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={(e) => {
                  setOpen(false);
                  onTab(e, item.href);
                }}
                className={`block rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-primary font-semibold text-white"
                    : "font-medium text-muted-foreground hover:bg-slate-100 hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
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
                        : "font-medium text-muted-foreground hover:bg-slate-100 hover:text-foreground"
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
