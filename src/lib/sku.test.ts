import { describe, expect, it } from "vitest";
import { skuBerikutnya } from "./sku";

describe("skuBerikutnya", () => {
  it("cabang kosong → PART-0001", () => {
    expect(skuBerikutnya([])).toBe("PART-0001");
  });

  it("mengabaikan seri manual (OLI-xxx, CB-xxx)", () => {
    expect(skuBerikutnya(["OLI-001", "CB-2"])).toBe("PART-0001");
  });

  it("lanjut setelah seri auto terakhir", () => {
    expect(skuBerikutnya(["PART-0001", "PART-0002"])).toBe("PART-0003");
  });

  it("mengisi bolong tanpa lompat", () => {
    expect(skuBerikutnya(["PART-0001", "PART-0003"])).toBe("PART-0002");
  });

  it("tidak pernah menghasilkan SKU yang sudah terpakai (manual sekalipun)", () => {
    expect(skuBerikutnya(["PART-0001", "PART-0002", "PART-9999"])).toBe(
      "PART-0003",
    );
    expect(skuBerikutnya(["PART-0001", "PART-0002", "PART-0003"])).toBe(
      "PART-0004",
    );
  });

  it("lebih dari 4 digit tetap valid dan unik", () => {
    const ada = Array.from({ length: 9999 }, (_, i) =>
      `PART-${String(i + 1).padStart(4, "0")}`,
    );
    expect(skuBerikutnya(ada)).toBe("PART-10000");
  });
});
