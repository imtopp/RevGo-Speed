import { describe, it, expect } from "vitest";
import { normalizePlate } from "./vehicle";

describe("normalizePlate", () => {
  it("menerima plat normal dan mempertahankannya", () => {
    expect(normalizePlate("B 1234 XY")).toBe("B 1234 XY");
    expect(normalizePlate("D 9876")).toBe("D 9876");
    expect(normalizePlate("BK 1234 A")).toBe("BK 1234 A");
    expect(normalizePlate("B 1234 XYZ")).toBe("B 1234 XYZ");
  });

  it("merapikan huruf kecil, spasi berlebih, dan tanpa spasi", () => {
    expect(normalizePlate("b 1234 xy")).toBe("B 1234 XY");
    expect(normalizePlate("  AB   1234  ")).toBe("AB 1234");
    expect(normalizePlate("B1234XY")).toBe("B 1234 XY");
    expect(normalizePlate("ab1234")).toBe("AB 1234");
  });

  it("menolak teks yang bukan plat nomor", () => {
    expect(normalizePlate("KACANG IJO")).toBeNull();
    expect(normalizePlate("KACANG")).toBeNull();
    expect(normalizePlate("KUE LEGIT")).toBeNull();
    expect(normalizePlate("")).toBeNull();
    expect(normalizePlate("   ")).toBeNull();
  });

  it("menolak format plat yang kepanjangan", () => {
    expect(normalizePlate("ABCDE 1234")).toBeNull();
    expect(normalizePlate("B 12345")).toBeNull();
    expect(normalizePlate("B 1234 WXYZ")).toBeNull();
    expect(normalizePlate("B 1234 XY Z")).toBeNull();
  });
});
