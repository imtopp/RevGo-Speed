// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { BackLink } from "./back-link";
import {
  disposeTabHistory,
  initTabHistory,
  notePathname,
} from "@/lib/tab-history";

const nav = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: nav.back, push: nav.push }),
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

describe("BackLink", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    nav.back.mockClear();
    nav.push.mockClear();
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
    disposeTabHistory();
  });

  async function render(href: string) {
    await act(() => {
      initTabHistory();
      root.render(
        <BackLink href={href} className="back">
          Kembali
        </BackLink>,
      );
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

  it("riwayat sebelumnya = target → mundur via history.back()", async () => {
    await render("/dashboard/servis");
    await act(async () => {
      notePathname("/dashboard");
      notePathname("/dashboard/servis");
      notePathname("/dashboard/servis/1");
    });
    await click(host.querySelector("a")!);
    expect(nav.back).toHaveBeenCalledTimes(1);
  });

  it("deep-link (sebelumnya bukan target) → tetap Link biasa, tidak back", async () => {
    await render("/dashboard/servis");
    await act(async () => {
      notePathname("/dashboard/servis/1");
    });
    await click(host.querySelector("a")!);
    expect(nav.back).not.toHaveBeenCalled();
  });

  it("tidak ada riwayat sesi → tidak back", async () => {
    await render("/dashboard/servis");
    await click(host.querySelector("a")!);
    expect(nav.back).not.toHaveBeenCalled();
  });
});
