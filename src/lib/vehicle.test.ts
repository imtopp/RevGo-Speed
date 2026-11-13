import { describe, it, expect, afterEach } from "vitest";
import {
  normalizePlate,
  MEREK_GROUPS,
  MEREK_LISTRIK_LABEL,
  merekGroupsTampil,
  merekListrikDilarang,
} from "./vehicle";

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

describe("merekGroupsTampil (flag HIDE_EV_MEREK)", () => {
  afterEach(() => {
    delete process.env.HIDE_EV_MEREK;
  });

  it("default: group Listrik tetap tampil", () => {
    const groups = merekGroupsTampil();
    expect(groups).toBe(MEREK_GROUPS);
    expect(groups.some((g) => g.label === MEREK_LISTRIK_LABEL)).toBe(true);
  });

  it("HIDE_EV_MEREK=true: group Listrik dibuang, group lain tetap", () => {
    process.env.HIDE_EV_MEREK = "true";
    const groups = merekGroupsTampil();
    expect(groups.some((g) => g.label === MEREK_LISTRIK_LABEL)).toBe(false);
    expect(groups.some((g) => g.label === "Jepang")).toBe(true);
    expect(groups).toHaveLength(MEREK_GROUPS.length - 1);
    expect(groups.flatMap((g) => g.items)).not.toContain("Gesits");
  });
});

describe("merekListrikDilarang (flag HIDE_EV_MEREK)", () => {
  afterEach(() => {
    delete process.env.HIDE_EV_MEREK;
  });

  it("flag tidak diset: tidak ada merek yang ditolak", () => {
    expect(merekListrikDilarang("Gesits")).toBe(false);
    expect(merekListrikDilarang("Volta")).toBe(false);
  });

  it("flag aktif: merek listrik ditolak, bensin & merek bebas lolos", () => {
    process.env.HIDE_EV_MEREK = "true";
    expect(merekListrikDilarang("Gesits")).toBe(true);
    expect(merekListrikDilarang(" gesits ")).toBe(true);
    expect(merekListrikDilarang("Volta")).toBe(true);
    expect(merekListrikDilarang("Honda")).toBe(false);
    expect(merekListrikDilarang("Yamaha")).toBe(false);
    expect(merekListrikDilarang("Pagar Maju")).toBe(false);
    expect(merekListrikDilarang("")).toBe(false);
  });
});
