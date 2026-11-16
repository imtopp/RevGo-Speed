import { describe, expect, it } from "vitest";
import {
  DP_CONFIG_DEFAULT,
  dpAktif,
  getDpConfig,
  labelTerlambat,
  parseDpConfig,
  type DpConfig,
} from "./dp";

describe("parseDpConfig", () => {
  it("tanpa baris → default (DP aktif 50rb, policy TANPA_REFUND)", () => {
    const cfg = parseDpConfig([]);
    expect(cfg).toEqual(DP_CONFIG_DEFAULT);
    expect(dpAktif(cfg)).toBe(true);
  });

  it("membaca nilai yang tersimpan", () => {
    const cfg = parseDpConfig([
      { key: "dp_nominal", value: "100000" },
      { key: "dp_transfer_enabled", value: "true" },
      { key: "dp_bank", value: "BCA" },
      { key: "dp_account_number", value: "1234567890" },
      { key: "dp_account_name", value: "Bengkel Jaya" },
      { key: "dp_qris_enabled", value: "true" },
      { key: "dp_qris_image", value: "data:image/webp;base64,xx" },
      { key: "dp_no_show_days", value: "14" },
      { key: "dp_policy", value: "REFUND_PENUH" },
    ]);
    expect(cfg.nominal).toBe(100000);
    expect(cfg.transferEnabled).toBe(true);
    expect(cfg.bank).toBe("BCA");
    expect(cfg.accountNumber).toBe("1234567890");
    expect(cfg.accountName).toBe("Bengkel Jaya");
    expect(cfg.qrisEnabled).toBe(true);
    expect(cfg.qrisImage).toBe("data:image/webp;base64,xx");
    expect(cfg.noShowDays).toBe(14);
    expect(cfg.policy).toBe("REFUND_PENUH");
  });

  it("nominal 0 → DP nonaktif; nilai tidak valid → default", () => {
    expect(dpAktif(parseDpConfig([{ key: "dp_nominal", value: "0" }]))).toBe(
      false,
    );
    expect(
      parseDpConfig([
        { key: "dp_nominal", value: "abc" },
        { key: "dp_no_show_days", value: "-1" },
        { key: "dp_transfer_enabled", value: "yes" },
      ]),
    ).toEqual(DP_CONFIG_DEFAULT);
  });

  it("policy kosong / tak dikenal → fallback TANPA_REFUND", () => {
    expect(
      parseDpConfig([{ key: "dp_policy", value: "" }]).policy,
    ).toBe("TANPA_REFUND");
    expect(
      parseDpConfig([{ key: "dp_policy", value: "SEPARUH" }]).policy,
    ).toBe("TANPA_REFUND");
  });

  it("sakelar tunai: default aktif (key belum ada), bisa dimatikan", () => {
    expect(parseDpConfig([]).cashEnabled).toBe(true);
    expect(
      parseDpConfig([{ key: "dp_cash_enabled", value: "false" }]).cashEnabled,
    ).toBe(false);
    expect(
      parseDpConfig([{ key: "dp_cash_enabled", value: "true" }]).cashEnabled,
    ).toBe(true);
    // Nilai ngawur → jatuh ke default aktif (sekalian selaras default lain).
    expect(
      parseDpConfig([{ key: "dp_cash_enabled", value: "yes" }]).cashEnabled,
    ).toBe(true);
  });
});

describe("labelTerlambat", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const cfg: DpConfig = { ...DP_CONFIG_DEFAULT, noShowDays: 7 };

  it("belum lewat / tanpa jadwal → null", () => {
    expect(labelTerlambat(null, now, cfg)).toBeNull();
    expect(
      labelTerlambat(new Date("2026-11-16T13:00:00Z"), now, cfg),
    ).toBeNull();
    expect(
      labelTerlambat(new Date("2026-11-16T12:00:00Z"), now, cfg),
    ).toBeNull();
  });

  it("lewat < noShowDays → tanpa suffix", () => {
    // 2 hr 3 jam sebelum now
    const t = new Date(now.getTime() - (2 * 24 + 3) * 3_600_000);
    expect(labelTerlambat(t, now, cfg)).toBe("Terlambat 2 hr 3 jam");
  });

  it("lewat ≥ noShowDays → suffix ikut TANPA_REFUND (default)", () => {
    const t = new Date(now.getTime() - (8 * 24 + 2) * 3_600_000);
    expect(labelTerlambat(t, now, cfg)).toBe(
      "Terlambat 8 hr 2 jam · boleh dibatalkan, DP hangus",
    );
  });

  it("lewat ≥ noShowDays → suffix ikut REFUND_PENUH", () => {
    const t = new Date(now.getTime() - (8 * 24 + 2) * 3_600_000);
    expect(
      labelTerlambat(t, now, { ...cfg, policy: "REFUND_PENUH" }),
    ).toBe("Terlambat 8 hr 2 jam · jika dibatalkan, DP direfund");
  });

  it("kurang dari sehari → format jam/menit", () => {
    const t = new Date(now.getTime() - 5 * 60_000);
    expect(labelTerlambat(t, now, cfg)).toBe("Terlambat 5 menit");
    const t2 = new Date(now.getTime() - 3 * 3_600_000);
    expect(labelTerlambat(t2, now, cfg)).toBe("Terlambat 3 jam");
  });

  it("noShowDays 0 → suffix langsung muncul sejak lewat", () => {
    const t = new Date(now.getTime() - 60 * 60_000);
    expect(labelTerlambat(t, now, { ...cfg, noShowDays: 0 })).toBe(
      "Terlambat 1 jam · boleh dibatalkan, DP hangus",
    );
  });
});

describe("getDpConfig", () => {
  it("menerima db tiruan (Pick systemSetting) tanpa prisma asli", async () => {
    const db = {
      systemSetting: {
        findMany: async () => [
          { key: "dp_nominal", value: "75000" },
          { key: "dp_policy", value: "REFUND_PENUH" },
        ],
      },
    } as never;
    const cfg = await getDpConfig(db);
    expect(cfg.nominal).toBe(75000);
    expect(cfg.policy).toBe("REFUND_PENUH");
  });
});
