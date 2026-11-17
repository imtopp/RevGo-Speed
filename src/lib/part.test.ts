import { describe, expect, it } from "vitest";
import { alasanTolakHapusPart, gerakanBukanPembelianKas } from "./part";

const stokAwal = [{ type: "IN" as const, note: "Stok awal" }];

describe("alasanTolakHapusPart", () => {
  it("part bersih (tanpa gerakan) → boleh", () => {
    expect(
      alasanTolakHapusPart({ serviceParts: 0, saleItems: 0, movements: [] }),
    ).toBeNull();
  });

  it("hanya stok awal → boleh", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 0,
        saleItems: 0,
        movements: stokAwal,
      }),
    ).toBeNull();
  });

  it("dipakai servis → tolak", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 1,
        saleItems: 0,
        movements: stokAwal,
      }),
    ).toBe("dipakai-transaksi");
  });

  it("terjual via POS → tolak", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 0,
        saleItems: 2,
        movements: stokAwal,
      }),
    ).toBe("dipakai-transaksi");
  });

  it("dipakai transaksi menang atas pemeriksaan gerakan lain", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 1,
        saleItems: 0,
        movements: [{ type: "OUT", note: "Opname koreksi" }],
      }),
    ).toBe("dipakai-transaksi");
  });

  it("pembelian via Stok Masuk (IN, note PO) → tolak", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 0,
        saleItems: 0,
        movements: [
          { type: "IN", note: "Stok awal" },
          { type: "IN", note: "PO-001" },
        ],
      }),
    ).toBe("bukan-stok-awal");
  });

  it("penyesuaian opname (OUT) → tolak", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 0,
        saleItems: 0,
        movements: [
          { type: "IN", note: "Stok awal" },
          { type: "OUT", note: "Opname koreksi" },
        ],
      }),
    ).toBe("bukan-stok-awal");
  });

  it("gerakan OUT apa pun → tolak", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 0,
        saleItems: 0,
        movements: [{ type: "OUT", note: null }],
      }),
    ).toBe("bukan-stok-awal");
  });

  it("stok awal konsinyasi (tanpa kas) → boleh", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 0,
        saleItems: 0,
        movements: [{ type: "IN", note: "Stok awal (konsinyasi)" }],
      }),
    ).toBeNull();
  });

  it("stok masuk konsinyasi (IN, note Konsinyasi) → tolak", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 0,
        saleItems: 0,
        movements: [
          { type: "IN", note: "Stok awal (konsinyasi)" },
          { type: "IN", note: "Konsinyasi: PO-001" },
        ],
      }),
    ).toBe("bukan-stok-awal");
  });

  it("retur konsinyasi (OUT) → tolak", () => {
    expect(
      alasanTolakHapusPart({
        serviceParts: 0,
        saleItems: 0,
        movements: [
          { type: "IN", note: "Stok awal (konsinyasi)" },
          { type: "OUT", note: "Retur konsinyasi" },
        ],
      }),
    ).toBe("bukan-stok-awal");
  });
});

describe("gerakanBukanPembelianKas", () => {
  it("pembelian asli (stok awal / pembelian stok / catatan bebas) ? false", () => {
    expect(gerakanBukanPembelianKas("Stok awal")).toBe(false);
    expect(gerakanBukanPembelianKas("Pembelian stok")).toBe(false);
    expect(gerakanBukanPembelianKas("Beli di supplier X")).toBe(false);
    expect(gerakanBukanPembelianKas(null)).toBe(false);
  });

  it("konsinyasi ? true (tanpa kas, jangan dicocokkan)", () => {
    expect(gerakanBukanPembelianKas("Stok awal (konsinyasi)")).toBe(true);
    expect(gerakanBukanPembelianKas("Konsinyasi: PO-001")).toBe(true);
  });

  it("retur servis / penyesuaian opname / retur penjualan batal ? true", () => {
    expect(
      gerakanBukanPembelianKas("Dikembalikan dari servis SV-001 (batal)"),
    ).toBe(true);
    expect(gerakanBukanPembelianKas("Penyesuaian: opname rutin")).toBe(true);
    expect(
      gerakanBukanPembelianKas("Penjualan SL-001 dibatalkan"),
    ).toBe(true);
  });

  it("abai besar-kecil huruf & spasi di awal", () => {
    expect(gerakanBukanPembelianKas("  KONSINYASI")).toBe(true);
    expect(gerakanBukanPembelianKas("penyesuaian: x")).toBe(true);
  });
});
