import { describe, it, expect } from "vitest";
import {
  ICON_SIZES,
  parseIconRequest,
  resolveIconSource,
  fallbackIconFor,
} from "./app-icon";

const DATA_URL = "data:image/webp;base64,AAAA";
const PNG_URL = "data:image/png;base64,AAAA";

describe("parseIconRequest", () => {
  it("menerima seluruh ukuran resmi", () => {
    for (const size of ICON_SIZES) {
      const r = parseIconRequest(new URLSearchParams({ size: String(size) }));
      expect(r).toEqual({ size, maskable: false });
    }
  });

  it("maskable aktif hanya bila param = 1", () => {
    expect(parseIconRequest(new URLSearchParams("size=512&maskable=1"))).toEqual(
      { size: 512, maskable: true },
    );
    expect(
      parseIconRequest(new URLSearchParams("size=512&maskable=0")),
    ).toEqual({ size: 512, maskable: false });
    expect(parseIconRequest(new URLSearchParams("size=512"))).toEqual({
      size: 512,
      maskable: false,
    });
  });

  it("menolak size hilang, bukan bilangan, atau di luar daftar", () => {
    expect(parseIconRequest(new URLSearchParams())).toBeNull();
    expect(parseIconRequest(new URLSearchParams("size=64"))).toBeNull();
    expect(parseIconRequest(new URLSearchParams("size=180.5"))).toBeNull();
    expect(parseIconRequest(new URLSearchParams("size=abc"))).toBeNull();
    expect(parseIconRequest(new URLSearchParams("size="))).toBeNull();
  });
});

describe("resolveIconSource", () => {
  it("logo kosong → none (fallback statis)", () => {
    expect(resolveIconSource(null)).toEqual({ kind: "none" });
    expect(resolveIconSource("")).toEqual({ kind: "none" });
  });

  it("data URL image → process", () => {
    expect(resolveIconSource(DATA_URL)).toEqual({
      kind: "process",
      dataUrl: DATA_URL,
    });
    expect(resolveIconSource(PNG_URL).kind).toBe("process");
  });

  it("https dan path relatif → redirect", () => {
    expect(resolveIconSource("https://cdn.bengkel.id/logo.png")).toEqual({
      kind: "redirect",
      url: "https://cdn.bengkel.id/logo.png",
    });
    expect(resolveIconSource("/brand/logo-title.png")).toEqual({
      kind: "redirect",
      url: "/brand/logo-title.png",
    });
  });
});

describe("fallbackIconFor", () => {
  it("maskable selalu icon-maskable-512", () => {
    expect(fallbackIconFor({ size: 512, maskable: true })).toBe(
      "/icons/icon-maskable-512.png",
    );
    expect(fallbackIconFor({ size: 192, maskable: true })).toBe(
      "/icons/icon-maskable-512.png",
    );
  });

  it("memetakan ukuran ke file bawaan", () => {
    expect(fallbackIconFor({ size: 512, maskable: false })).toBe(
      "/icons/icon-512.png",
    );
    expect(fallbackIconFor({ size: 192, maskable: false })).toBe(
      "/icons/icon-192.png",
    );
    expect(fallbackIconFor({ size: 180, maskable: false })).toBe(
      "/icons/apple-touch-icon.png",
    );
    expect(fallbackIconFor({ size: 48, maskable: false })).toBe(
      "/icons/favicon.png",
    );
    expect(fallbackIconFor({ size: 32, maskable: false })).toBe(
      "/icons/favicon.png",
    );
  });
});
