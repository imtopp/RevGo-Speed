// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import type { Role } from "@db/prisma/client";
import { StaffNav } from "./staff-nav";

const nav = vi.hoisted(() => ({ path: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.path,
}));

vi.mock("next/link", () => ({
  default: (props: {
    href: string;
    children?: ReactNode;
    onClick?: (e: ReactMouseEvent<HTMLAnchorElement>) => void;
  }) => {
    const { href, children, onClick } = props;
    return (
      <a
        href={href}
        onClick={(e) => {
          onClick?.(e);
          e.preventDefault();
        }}
      >
        {children}
      </a>
    );
  },
}));

describe("StaffNav mobile (bottom-nav + sheet Lainnya)", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    nav.path = "/dashboard";
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(() => {
      root.unmount();
      return Promise.resolve();
    });
    host.remove();
  });

  async function render(role: Role) {
    await act(() => {
      root.render(<StaffNav role={role} />);
      return Promise.resolve();
    });
  }

  function click(el: Element) {
    return act(async () => {
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });
  }

  it("OWNER: tombol Lainnya membuka sheet menu Sistem, tertutup saat item diklik", async () => {
    await render("OWNER");
    expect(host.textContent).toContain("Beranda");
    expect(host.textContent).toContain("Audit");

    const btn = host.querySelector<HTMLButtonElement>(
      'button[aria-controls="menu-lainnya"]',
    );
    expect(btn).not.toBeNull();
    expect(host.querySelector("#menu-lainnya")).toBeNull();

    await click(btn!);
    const sheet = host.querySelector("#menu-lainnya");
    expect(sheet).not.toBeNull();
    for (const label of ["Katalog", "Pengaturan", "Akun", "Backup"]) {
      expect(sheet!.textContent).toContain(label);
    }
    // Update khusus SysAdmin — Owner tidak melihatnya.
    expect(sheet!.querySelector('a[href="/dashboard/update"]')).toBeNull();
    // Audit sudah ada di bottom-nav → tidak diulang di sheet.
    expect(sheet!.querySelector('a[href="/dashboard/audit"]')).toBeNull();

    const katalogLink = sheet!.querySelector<HTMLAnchorElement>(
      'a[href="/dashboard/katalog"]',
    );
    expect(katalogLink).not.toBeNull();
    await click(katalogLink!);
    expect(host.querySelector("#menu-lainnya")).toBeNull();
  });

  it("ADMIN: tanpa Lainnya — semua menu admin sudah muat di bottom-nav", async () => {
    await render("ADMIN");
    expect(host.textContent).toContain("Laporan");
    expect(
      host.querySelector('button[aria-controls="menu-lainnya"]'),
    ).toBeNull();
    expect(host.querySelector("#menu-lainnya")).toBeNull();
  });

  it("MECHANIC: tanpa Lainnya, ada tab Tugas Saya", async () => {
    await render("MECHANIC");
    expect(host.textContent).toContain("Tugas Saya");
    expect(
      host.querySelector('button[aria-controls="menu-lainnya"]'),
    ).toBeNull();
  });

  it("SYS_ADMIN: sheet memuat Update tanpa Katalog (Katalog khusus Owner)", async () => {
    await render("SYS_ADMIN");
    const btn = host.querySelector<HTMLButtonElement>(
      'button[aria-controls="menu-lainnya"]',
    );
    expect(btn).not.toBeNull();
    await click(btn!);
    const sheet = host.querySelector("#menu-lainnya");
    expect(sheet!.querySelector('a[href="/dashboard/update"]')).not.toBeNull();
    expect(sheet!.querySelector('a[href="/dashboard/katalog"]')).toBeNull();
    expect(sheet!.textContent).toContain("Pengaturan");
    expect(sheet!.textContent).toContain("Backup");
  });
});
