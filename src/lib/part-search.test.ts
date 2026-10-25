import { describe, expect, it } from "vitest";
import { cariPart, type PartCari } from "./part-search";

const parts: PartCari[] = [
  { id: "1", name: "Oli Mesin 10W-30", sku: "OLI-001", category: "Oli", quantity: 12 },
  { id: "2", name: "Oli Gardan", sku: "OLI-002", category: "Oli", quantity: 0 },
  { id: "3", name: "Kampas Rem Depan", sku: "KMP-010", category: "Rem", quantity: 5 },
  { id: "4", name: "Filter Udara X1", sku: "FLT-020", category: "Filter", quantity: 3 },
  { id: "5", name: "Baut Roda M8", sku: "OLI-BAUT", category: "Baut", quantity: 40 },
];

describe("cariPart", () => {
  it("query kosong → semua part, urutan asli utuh", () => {
    expect(cariPart(parts, "")).toHaveLength(5);
    expect(cariPart(parts, "   ").map((p) => p.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("cari nama case-insensitive", () => {
    expect(cariPart(parts, "KAMPAS").map((p) => p.id)).toEqual(["3"]);
    expect(cariPart(parts, "kampas rem").map((p) => p.id)).toEqual(["3"]);
  });

  it("bisa cari lewat SKU", () => {
    expect(cariPart(parts, "flt-020").map((p) => p.id)).toEqual(["4"]);
  });

  it("bisa cari lewat kategori", () => {
    expect(cariPart(parts, "rem").map((p) => p.id)).toEqual(["3"]);
  });

  it("multi-kata: semua token harus cocok", () => {
    expect(cariPart(parts, "oli mesin").map((p) => p.id)).toEqual(["1"]);
    // "oli" + "rem" tidak ada di satu part yang sama
    expect(cariPart(parts, "oli rem")).toEqual([]);
  });

  it("ranking: cocok di awal nama di depan, match SKU/kategori di belakang", () => {
    const hasil = cariPart(parts, "oli").map((p) => p.id);
    // "Oli …" di awal nama menang; "Baut Roda" (SKU OLI-BAUT) paling belakang
    expect(hasil).toEqual(["1", "2", "5"]);
  });

  it("tidak ada yang cocok → array kosong", () => {
    expect(cariPart(parts, "karbu")).toEqual([]);
  });
});
