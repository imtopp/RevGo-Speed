import { describe, it, expect } from "vitest";
import {
  KATA_BATALKAN,
  konfirmasiBatal,
  rencanaPembatalan,
  type BayarAktif,
} from "./cancel-plan";

const bayar = (kind: string, amount: number, id = kind): BayarAktif => ({
  id,
  kind,
  method: "CASH",
  amount,
});

describe("rencanaPembatalan", () => {
  it("tanpa pembayaran → rencana kosong, tanpa centang & tanpa blokir", () => {
    const p = rencanaPembatalan([], "TANPA_REFUND");
    expect(p.voids).toHaveLength(0);
    expect(p.hangusDp).toHaveLength(0);
    expect(p.totalVoid).toBe(0);
    expect(p.totalHangus).toBe(0);
    expect(p.perluCentangHangus).toBe(false);
    expect(p.terblokirRefund).toBe(false);
  });

  it("TANPA_REFUND + DP saja → hangus (tidak divoid), wajib centang", () => {
    const p = rencanaPembatalan([bayar("DP", 50_000)], "TANPA_REFUND");
    expect(p.voids).toHaveLength(0);
    expect(p.totalVoid).toBe(0);
    expect(p.hangusDp).toHaveLength(1);
    expect(p.totalHangus).toBe(50_000);
    expect(p.perluCentangHangus).toBe(true);
    expect(p.terblokirRefund).toBe(false);
  });

  it("TANPA_REFUND + campuran → non-DP di-void, DP hangus, tetap wajib centang", () => {
    const p = rencanaPembatalan(
      [bayar("DP", 50_000, "a"), bayar("PELUNASAN", 100_000, "b")],
      "TANPA_REFUND",
    );
    expect(p.voids.map((x) => x.id)).toEqual(["b"]);
    expect(p.totalVoid).toBe(100_000);
    expect(p.hangusDp.map((x) => x.id)).toEqual(["a"]);
    expect(p.totalHangus).toBe(50_000);
    expect(p.perluCentangHangus).toBe(true);
  });

  it("REFUND_PENUH → semua pembayaran (termasuk DP) di-void, tanpa centang", () => {
    const p = rencanaPembatalan(
      [bayar("DP", 50_000, "a"), bayar("PELUNASAN", 100_000, "b")],
      "REFUND_PENUH",
    );
    expect(p.voids).toHaveLength(2);
    expect(p.totalVoid).toBe(150_000);
    expect(p.hangusDp).toHaveLength(0);
    expect(p.totalHangus).toBe(0);
    expect(p.perluCentangHangus).toBe(false);
  });

  it("REFUND bersama pembayaran lain → terblokirRefund (cancel ditolak server)", () => {
    const p = rencanaPembatalan(
      [bayar("PELUNASAN", 200_000, "a"), bayar("REFUND", -50_000, "b")],
      "TANPA_REFUND",
    );
    expect(p.terblokirRefund).toBe(true);
    expect(p.adaRefund).toBe(true);
    // Tetap dihitung untuk tampilan, tapi server menolak sebelum eksekusi.
    expect(p.voids.map((x) => x.id)).toEqual(["a"]);
  });

  it("REFUND saja yang tersisa (positif sudah di-void manual) → boleh", () => {
    const p = rencanaPembatalan(
      [bayar("REFUND", -50_000, "b")],
      "TANPA_REFUND",
    );
    expect(p.terblokirRefund).toBe(false);
    expect(p.adaRefund).toBe(true);
    expect(p.voids).toHaveLength(0);
    expect(p.totalVoid).toBe(0);
  });

  it("REFUND + DP yang ditahan (TANPA_REFUND) → boleh — tanpa gerakan kas", () => {
    // Net tercatat sudah benar: DP gantung + refund keluar = sesuai total.
    const p = rencanaPembatalan(
      [bayar("DP", 50_000, "a"), bayar("REFUND", -20_000, "b")],
      "TANPA_REFUND",
    );
    expect(p.terblokirRefund).toBe(false);
    expect(p.adaRefund).toBe(true);
    expect(p.voids).toHaveLength(0);
    expect(p.hangusDp.map((x) => x.id)).toEqual(["a"]);
  });

  it("REFUND + DP di-void (REFUND_PENUH) → terblokirRefund", () => {
    const p = rencanaPembatalan(
      [bayar("DP", 50_000, "a"), bayar("REFUND", -20_000, "b")],
      "REFUND_PENUH",
    );
    expect(p.terblokirRefund).toBe(true);
    expect(p.voids.map((x) => x.id)).toEqual(["a"]);
  });
});

describe("konfirmasiBatal", () => {
  it("menerima kata persis, dengan spasi di sekitar & huruf kecil", () => {
    expect(konfirmasiBatal(KATA_BATALKAN)).toBe(true);
    expect(konfirmasiBatal(" batalkan ")).toBe(true);
    expect(konfirmasiBatal("Batalkan")).toBe(true);
  });

  it("menolak kata lain / kosong / sebagian", () => {
    expect(konfirmasiBatal("")).toBe(false);
    expect(konfirmasiBatal("batal")).toBe(false);
    expect(konfirmasiBatal("BATALKAN!")).toBe(false);
    expect(konfirmasiBatal("ya")).toBe(false);
  });
});
