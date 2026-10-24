import { describe, expect, it } from "vitest";
import { isOpnameNote, opnameDeltaValue } from "./opname";

describe("isOpnameNote", () => {
  it("mengenali note penyesuaian", () => {
    expect(isOpnameNote("Penyesuaian: Opname fisik, hilang 2")).toBe(true);
    expect(isOpnameNote("  Penyesuaian: rusak")).toBe(true);
  });

  it("menolak note lain dan null", () => {
    expect(isOpnameNote("Stok masuk dari Supplier X")).toBe(false);
    expect(isOpnameNote("Pemakaian servis SV-1")).toBe(false);
    expect(isOpnameNote(null)).toBe(false);
    expect(isOpnameNote("")).toBe(false);
  });
});

describe("opnameDeltaValue", () => {
  it("IN (stok lebih) bernilai positif", () => {
    expect(
      opnameDeltaValue([{ type: "IN", quantity: 2, unitCost: 10_000 }]),
    ).toBe(20_000);
  });

  it("OUT (stok kurang) bernilai negatif", () => {
    expect(
      opnameDeltaValue([{ type: "OUT", quantity: 3, unitCost: 15_000 }]),
    ).toBe(-45_000);
  });

  it("campuran dijumlahkan signed", () => {
    expect(
      opnameDeltaValue([
        { type: "OUT", quantity: 5, unitCost: 10_000 },
        { type: "IN", quantity: 1, unitCost: 25_000 },
      ]),
    ).toBe(-25_000);
  });

  it("daftar kosong = 0", () => {
    expect(opnameDeltaValue([])).toBe(0);
  });

  it("unitCost 0 tidak mengubah total", () => {
    expect(
      opnameDeltaValue([{ type: "OUT", quantity: 4, unitCost: 0 }]),
    ).toBe(0);
  });
});
