import { describe, expect, it } from "vitest";
import {
  allocateFifo,
  correctedServiceCost,
  estimateAvgAfterCostCorrection,
  movingAverageBuyPrice,
  type OpenBatch,
} from "./inventory";

describe("movingAverageBuyPrice", () => {
  it("stok habis → harga batch baru murni", () => {
    expect(movingAverageBuyPrice(0, 10_000, 5, 12_000)).toBe(12_000);
  });

  it("gabung batch lama dan baru dengan benar", () => {
    expect(movingAverageBuyPrice(10, 10_000, 10, 20_000)).toBe(15_000);
  });

  it("pembulatan ke integer rupiah", () => {
    expect(movingAverageBuyPrice(3, 10_000, 1, 11_000)).toBe(10_250);
  });

  it("qtyLama 0 + avg lama diabaikan", () => {
    expect(movingAverageBuyPrice(0, 99_999, 2, 5_000)).toBe(5_000);
  });
});

describe("estimateAvgAfterCostCorrection", () => {
  it("batch masih ada penuh → dampak penuh", () => {
    expect(
      estimateAvgAfterCostCorrection(10, 0, 15_000, 10_000, 15_000, 10),
    ).toBe(10_000);
  });

  it("batch terpakai sebagian → dampak hanya sisa batch", () => {
    // batch 10, terpakai 5 → porsi masih ada 5; koreksi −5000/unit; stok 5
    expect(
      estimateAvgAfterCostCorrection(10, 5, 15_000, 10_000, 15_000, 5),
    ).toBe(10_000);
  });

  it("batch HABIS terpakai → rata-rata tidak ditarik (stok dari batch lain)", () => {
    // batch 10 sudah 100% terpakai; stok 5 unit milik batch lain @20.000
    expect(
      estimateAvgAfterCostCorrection(10, 10, 15_000, 1_000, 20_000, 5),
    ).toBe(20_000);
  });

  it("sisa batch lebih kecil dari total stok → dampak proporsional sisa", () => {
    // sisa batch 3 dari stok 50 → 20.000 + 3×(−5.000)/50
    expect(
      estimateAvgAfterCostCorrection(10, 7, 15_000, 10_000, 20_000, 50),
    ).toBe(19_700);
  });

  it("stok 0 → rata-rata tidak berubah", () => {
    expect(
      estimateAvgAfterCostCorrection(10, 0, 15_000, 10_000, 15_000, 0),
    ).toBe(15_000);
  });

  it("harga naik → rata-rata naik", () => {
    expect(
      estimateAvgAfterCostCorrection(4, 0, 10_000, 15_000, 10_000, 8),
    ).toBe(12_500);
  });

  it("tidak pernah negatif", () => {
    expect(
      estimateAvgAfterCostCorrection(10, 0, 20_000, 0, 5_000, 10),
    ).toBe(0);
  });
});

describe("allocateFifo", () => {
  const batches = (list: [string, number, number | null][]): OpenBatch[] =>
    list.map(([movementId, remaining, cost]) => ({ movementId, remaining, cost }));

  it("ambil dari batch tertua dulu", () => {
    const r = allocateFifo(
      3,
      batches([
        ["A", 10, 1_000],
        ["B", 10, 2_000],
      ]),
      999,
    );
    expect(r.allocations).toEqual([{ movementId: "A", quantity: 3 }]);
    expect(r.cost).toBe(1_000);
    expect(r.unmatchedQty).toBe(0);
  });

  it("melewati batch habis, cost = campuran tertimbang", () => {
    const r = allocateFifo(
      5,
      batches([
        ["A", 2, 1_000],
        ["B", 10, 3_000],
      ]),
      999,
    );
    expect(r.allocations).toEqual([
      { movementId: "A", quantity: 2 },
      { movementId: "B", quantity: 3 },
    ]);
    expect(r.cost).toBe(Math.round((2 * 1_000 + 3 * 3_000) / 5));
  });

  it("stok batch tidak terjangkau → sisa pakai fallbackCost", () => {
    const r = allocateFifo(5, batches([["A", 3, 1_000]]), 2_000);
    expect(r.allocations).toEqual([{ movementId: "A", quantity: 3 }]);
    expect(r.unmatchedQty).toBe(2);
    expect(r.cost).toBe(Math.round((3 * 1_000 + 2 * 2_000) / 5));
  });

  it("cost batch null → fallback per unit", () => {
    const r = allocateFifo(4, batches([["A", 4, null]]), 1_500);
    expect(r.cost).toBe(1_500);
  });
});

describe("correctedServiceCost", () => {
  it("porsi dari batch ikut delta penuh", () => {
    // servis 4 unit, 3 unit dari batch yang dikoreksi: 10.000 → 1.000
    expect(correctedServiceCost(10_000, 4, 3, 10_000, 1_000)).toBe(
      Math.round(10_000 + (3 * (1_000 - 10_000)) / 4),
    );
  });

  it("unit dari batch lain tidak ikut", () => {
    expect(correctedServiceCost(5_000, 4, 0, 10_000, 1_000)).toBe(5_000);
  });

  it("tidak pernah negatif", () => {
    expect(correctedServiceCost(1_000, 2, 2, 10_000, 0)).toBe(0);
  });
});
