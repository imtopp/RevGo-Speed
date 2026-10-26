import { describe, expect, it } from "vitest";
import {
  LOGO_MAX_DATA_URL_CHARS,
  isSafeLogoValue,
  summarizeLogoValue,
  validateLogoFileMeta,
} from "./logo";

describe("validateLogoFileMeta", () => {
  it("menerima PNG/JPEG/WebP/SVG dalam batas ukuran", () => {
    expect(validateLogoFileMeta({ type: "image/png", size: 1024 })).toBeNull();
    expect(validateLogoFileMeta({ type: "image/jpeg", size: 1 })).toBeNull();
    expect(validateLogoFileMeta({ type: "image/webp", size: 50_000 })).toBeNull();
    expect(
      validateLogoFileMeta({ type: "image/svg+xml", size: 2_000 }),
    ).toBeNull();
  });

  it("menolak tipe selain gambar yang didukung", () => {
    expect(
      validateLogoFileMeta({ type: "application/pdf", size: 100 }),
    ).toBe("Format logo harus PNG, JPEG, WebP, atau SVG.");
    expect(
      validateLogoFileMeta({ type: "image/gif", size: 100 }),
    ).toBe("Format logo harus PNG, JPEG, WebP, atau SVG.");
    expect(
      validateLogoFileMeta({ type: "text/html", size: 100 }),
    ).toBe("Format logo harus PNG, JPEG, WebP, atau SVG.");
  });

  it("menolak file kosong", () => {
    expect(validateLogoFileMeta({ type: "image/png", size: 0 })).toBe(
      "File logo kosong.",
    );
  });

  it("menolak file di atas 5 MB", () => {
    expect(
      validateLogoFileMeta({ type: "image/png", size: 5 * 1024 * 1024 + 1 }),
    ).toBe("Ukuran file logo maksimal 5 MB.");
    expect(
      validateLogoFileMeta({ type: "image/png", size: 5 * 1024 * 1024 }),
    ).toBeNull();
  });
});

describe("isSafeLogoValue", () => {
  it("menerima https://, path relatif, dan data URL image hasil proses", () => {
    expect(isSafeLogoValue("https://cdn.bengkel.id/logo.png")).toBe(true);
    expect(isSafeLogoValue("/logo.png")).toBe(true);
    expect(isSafeLogoValue("data:image/webp;base64,d09GMg==")).toBe(true);
    expect(isSafeLogoValue("data:image/png;base64,d09GMg==")).toBe(true);
    expect(isSafeLogoValue("data:image/jpeg;base64,d09GMg==")).toBe(true);
  });

  it("memblokir skema berbahaya & http:", () => {
    expect(isSafeLogoValue("javascript:alert(1)")).toBe(false);
    expect(isSafeLogoValue("http://cdn.bengkel.id/logo.png")).toBe(false);
    expect(isSafeLogoValue("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeLogoValue("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isSafeLogoValue("")).toBe(false);
  });

  it("memblokir data URL image yang kelewat panjang", () => {
    const panjang = `data:image/webp;base64,${"A".repeat(LOGO_MAX_DATA_URL_CHARS)}`;
    expect(isSafeLogoValue(panjang)).toBe(false);
    const pas = `data:image/webp;base64,${"A".repeat(LOGO_MAX_DATA_URL_CHARS - 40)}`;
    expect(isSafeLogoValue(pas)).toBe(true);
  });
});

describe("summarizeLogoValue", () => {
  it("meringkas data URL tanpa menampilkan base64 penuh", () => {
    const dataUrl = `data:image/webp;base64,${"A".repeat(2048)}`;
    expect(summarizeLogoValue(dataUrl)).toBe("data:image/webp (base64, 2 KB)");
  });

  it("meneruskan nilai URL biasa apa adanya", () => {
    expect(summarizeLogoValue("https://cdn.x/logo.png")).toBe(
      "https://cdn.x/logo.png",
    );
  });
});
