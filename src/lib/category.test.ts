import { describe, expect, it } from "vitest";
import { bersihkanKategori, samakanKategori } from "./category";

describe("bersihkanKategori", () => {
  it("spasi ganda jadi satu & buang spasi ujung", () => {
    expect(bersihkanKategori("  Oli   Mesin ")).toBe("Oli Mesin");
    expect(bersihkanKategori("\t oli\t")).toBe("oli");
    expect(bersihkanKategori("   ")).toBe("");
  });
});

describe("samakanKategori", () => {
  const existing = ["Oli", "Aki", "Ban Motor"];

  it("cocok case-insensitive → pakai bentuk yang sudah ada", () => {
    expect(samakanKategori("oli", existing)).toBe("Oli");
    expect(samakanKategori("  BAN MOTOR ", existing)).toBe("Ban Motor");
    expect(samakanKategori("Aki", existing)).toBe("Aki");
  });

  it("tidak ada yang cocok → pakai input yang sudah dirapikan", () => {
    expect(samakanKategori("  Kampas  Rem ", existing)).toBe("Kampas Rem");
  });

  it("kosong / whitespace → string kosong", () => {
    expect(samakanKategori("   ", existing)).toBe("");
    expect(samakanKategori("", [])).toBe("");
  });

  it("daftar existing kosong → tetap dirapikan", () => {
    expect(samakanKategori("  Oli  ", [])).toBe("Oli");
  });
});
