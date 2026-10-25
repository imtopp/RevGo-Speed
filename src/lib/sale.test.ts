import { describe, it, expect } from "vitest";
import {
  validasiItemJual,
  totalPenjualan,
  labaPenjualan,
  kodePenjualanPart,
  MAX_RUPIAH,
} from "./sale";

describe("validasiItemJual", () => {
  it("menerima qty positif & harga 0 (jual gratis)", () => {
    expect(validasiItemJual(1, 0)).toBeNull();
    expect(validasiItemJual(3, 150_000)).toBeNull();
  });

  it("menolak qty 0, negatif, pecahan, atau > 1.000.000", () => {
    expect(validasiItemJual(0, 1000)).toMatch(/Jumlah/);
    expect(validasiItemJual(-2, 1000)).toMatch(/Jumlah/);
    expect(validasiItemJual(1.5, 1000)).toMatch(/Jumlah/);
    expect(validasiItemJual(1_000_001, 1000)).toMatch(/Jumlah/);
  });

  it("menolak harga negatif, pecahan, atau > MAX_RUPIAH", () => {
    expect(validasiItemJual(1, -1)).toMatch(/Harga/);
    expect(validasiItemJual(1, 999.9)).toMatch(/Harga/);
    expect(validasiItemJual(1, MAX_RUPIAH + 1)).toMatch(/Harga/);
  });
});

describe("totalPenjualan", () => {
  it("menjumlahkan qty × price", () => {
    expect(
      totalPenjualan([
        { quantity: 2, price: 50_000 },
        { quantity: 1, price: 120_000 },
      ]),
    ).toBe(220_000);
  });

  it("0 bila tidak ada item", () => {
    expect(totalPenjualan([])).toBe(0);
  });
});

describe("labaPenjualan", () => {
  it("price − cost per unit, kali qty", () => {
    expect(
      labaPenjualan([
        { quantity: 3, price: 50_000, cost: 35_000 },
        { quantity: 1, price: 10_000, cost: 40_000 },
      ]),
    ).toBe(15_000);
  });

  it("cost hilang dianggap 0 (jual untung penuh)", () => {
    expect(labaPenjualan([{ quantity: 2, price: 100 }])).toBe(200);
  });

  it("negatif saat jual di bawah HPP", () => {
    expect(labaPenjualan([{ quantity: 1, price: 5_000, cost: 8_000 }])).toBe(-3_000);
  });
});

describe("kodePenjualanPart", () => {
  it("format SL-BBYY-NNNN, huruf besar, pad 4", () => {
    expect(kodePenjualanPart("pu", 2026, 7)).toBe("SL-PU26-0007");
  });

  it("cabang kosong → fallback X", () => {
    expect(kodePenjualanPart("", 2026, 1)).toBe("SL-X26-0001");
  });

  it("cabang > 2 huruf dipotong 2", () => {
    expect(kodePenjualanPart("bandung", 2025, 123)).toBe("SL-BA25-0123");
  });
});
