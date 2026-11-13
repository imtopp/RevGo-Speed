// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BERANDA,
  disposeTabHistory,
  handleTabNavigate,
  initTabHistory,
  notePathname,
  planTabMove,
  sessionCanGoBack,
  shouldUseHistoryBack,
} from "./tab-history";

describe("planTabMove (murni)", () => {
  it("noop saat href = lokasi sekarang", () => {
    expect(planTabMove(["/dashboard"], "/dashboard", "/dashboard")).toEqual({
      kind: "noop",
    });
  });

  it("push saat stack kosong", () => {
    expect(planTabMove([], "/x", "/y")).toEqual({ kind: "push" });
  });

  it("push saat sudah di Beranda (entry terakhir)", () => {
    expect(
      planTabMove(["/dashboard"], "/dashboard", "/dashboard/servis"),
    ).toEqual({ kind: "push" });
    expect(
      planTabMove(["/login", "/dashboard"], "/dashboard", "/dashboard/kas"),
    ).toEqual({ kind: "push" });
  });

  it("collapse dari kedalaman: runtuh ke Beranda lalu buka tab", () => {
    const stack = [
      "/dashboard",
      "/dashboard/servis",
      "/dashboard/servis/abc",
      "/dashboard/servis/abc/cetak",
    ];
    expect(
      planTabMove(stack, "/dashboard/servis/abc/cetak", "/dashboard/kas"),
    ).toEqual({ kind: "collapse", steps: 3, skipPush: false });
  });

  it("collapse ke Beranda itu sendiri: skipPush (jangan push duplikat)", () => {
    const stack = ["/dashboard", "/dashboard/servis", "/dashboard/kas"];
    expect(planTabMove(stack, "/dashboard/kas", BERANDA)).toEqual({
      kind: "collapse",
      steps: 2,
      skipPush: true,
    });
  });

  it("tanpa Beranda di stack: runtuh ke entry pertama", () => {
    const stack = ["/dashboard/servis", "/dashboard/kas"];
    expect(planTabMove(stack, "/dashboard/kas", "/dashboard/piutang")).toEqual({
      kind: "collapse",
      steps: 1,
      skipPush: false,
    });
  });

  it("Beranda muncul >1 kali: pakai lastIndexOf (yang terbaru)", () => {
    const stack = [
      "/dashboard",
      "/dashboard/servis",
      "/dashboard",
      "/dashboard/kas",
    ];
    // lastIndexOf = 2, len-1 = 3 → collapse 1 langkah ke Beranda terakhir.
    expect(planTabMove(stack, "/dashboard/kas", "/dashboard/akun")).toEqual({
      kind: "collapse",
      steps: 1,
      skipPush: false,
    });
  });

  it("stack berisi satu entry (sesi baru): push, jangan collapse", () => {
    expect(
      planTabMove(["/dashboard/servis"], "/dashboard/servis", "/dashboard/kas"),
    ).toEqual({ kind: "push" });
  });
});

describe("shouldUseHistoryBack (murni)", () => {
  it("true bila entry sebelumnya persis target", () => {
    expect(
      shouldUseHistoryBack(
        ["/dashboard", "/dashboard/servis", "/dashboard/servis/1"],
        "/dashboard/servis",
      ),
    ).toBe(true);
  });

  it("false saat tanpa riwayat (deep-link langsung ke halaman)", () => {
    expect(
      shouldUseHistoryBack(["/dashboard/servis/1"], "/dashboard/servis"),
    ).toBe(false);
  });

  it("false bila halaman sebelumnya bukan target (mis. dari piutang)", () => {
    expect(
      shouldUseHistoryBack(
        ["/dashboard/piutang", "/dashboard/servis/1"],
        "/dashboard/servis",
      ),
    ).toBe(false);
  });

  it("false bila sebelumnya malah login (back tidak boleh ke login)", () => {
    expect(
      shouldUseHistoryBack(["/login", "/dashboard/servis/1"], "/dashboard/servis"),
    ).toBe(false);
  });
});

describe("state sesi + handleTabNavigate", () => {
  afterEach(() => {
    disposeTabHistory();
  });

  it("init → belum bisa back; notePathname menambah; dispose mereset", () => {
    initTabHistory(); // stack = pathname jsdom = "/"
    expect(sessionCanGoBack()).toBe(false);
    notePathname("/dashboard");
    expect(sessionCanGoBack()).toBe(true);
    disposeTabHistory();
    initTabHistory();
    expect(sessionCanGoBack()).toBe(false);
  });

  it("notePathname idempoten untuk pathname yang sama (query tidak menambah)", () => {
    initTabHistory();
    notePathname("/dashboard");
    notePathname("/dashboard");
    expect(sessionCanGoBack()).toBe(true);
    // Masih 2 entry → back tetap bisa; kalau nambah jadi 3, tes di bawah gagal.
    disposeTabHistory();
    initTabHistory();
    notePathname("/dashboard");
    // Entry = ["/", "/dashboard"]; back sekali = selesai (len-1 = 1).
    expect(sessionCanGoBack()).toBe(true);
  });

  it("handleTabNavigate: noop saat sudah di tab yang sama", () => {
    initTabHistory();
    const push = vi.fn();
    handleTabNavigate(window.location.pathname, push);
    expect(push).not.toHaveBeenCalled();
  });

  it("handleTabNavigate: dari Beranda → push tab baru", () => {
    initTabHistory();
    notePathname("/dashboard");
    const push = vi.fn();
    handleTabNavigate("/dashboard/servis", push);
    expect(push).toHaveBeenCalledWith("/dashboard/servis");
  });

  it("handleTabNavigate: diabaikan bila belum init (nav belum terpasang)", () => {
    const push = vi.fn();
    handleTabNavigate("/dashboard/servis", push);
    expect(push).not.toHaveBeenCalled();
  });
});
