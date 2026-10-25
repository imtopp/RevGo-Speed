import { describe, expect, it } from "vitest";

// Logic murni NumberInput (diekspor utk bisa dites tanpa render DOM).
import { bersihkan, formatRibuan } from "./number-input";

describe("bersihkan", () => {
  it("membuang semua non-digit", () => {
    expect(bersihkan("1.500.000", false)).toBe("1500000");
    expect(bersihkan("Rp 99", false)).toBe("99");
    expect(bersihkan("abc", false)).toBe("");
  });

  it("mengabaikan minus bila tidak diizinkan", () => {
    expect(bersihkan("-5", false)).toBe("5");
  });

  it("mengizinkan minus utk field selisih", () => {
    expect(bersihkan("-2", true)).toBe("-2");
    expect(bersihkan("-1.000", true)).toBe("-1000");
    expect(bersihkan("-", true)).toBe("-");
  });
});

describe("formatRibuan", () => {
  it("memformat titik ribuan id-ID", () => {
    expect(formatRibuan("150000")).toBe("150.000");
    expect(formatRibuan("5")).toBe("5");
    expect(formatRibuan("")).toBe("");
  });

  it("minus saat diketik belum berupa angka", () => {
    expect(formatRibuan("-")).toBe("-");
    expect(formatRibuan("-2")).toBe("-2");
    expect(formatRibuan("-1000")).toBe("-1.000");
  });
});
