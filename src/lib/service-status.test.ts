import { describe, it, expect } from "vitest";
import {
  STATUS_LABEL,
  STATUS_COLOR,
  NEXT_ACTION_LABEL,
  ACTIVE_STATUSES,
  bolehBayar,
  PESAN_BAYAR_DITAHAN,
  formatRupiah,
  formatTanggal,
  formatTanggalPendek,
} from "./service-status";
import type { ServiceStatus } from "@db/prisma/client";

const ALL_STATUSES: ServiceStatus[] = [
  "PENDING",
  "WAITING_APPROVAL",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "DONE",
  "CANCELLED",
];

describe("peta status servis", () => {
  it("STATUS_LABEL punya label untuk semua status, tanpa undefined", () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_LABEL[s], `label ${s}`).toBeTruthy();
    }
    expect(Object.keys(STATUS_LABEL).sort()).toEqual([...ALL_STATUSES].sort());
  });

  it("STATUS_COLOR punya warna Tailwind untuk semua status", () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_COLOR[s], `warna ${s}`).toMatch(/^bg-/);
    }
  });

  it("NEXT_ACTION_LABEL lengkap & berisi teks aksi (dipakai sticky bar)", () => {
    for (const s of ALL_STATUSES) {
      expect(NEXT_ACTION_LABEL[s], `aksi ${s}`).toBeTruthy();
    }
  });

  it("ACTIVE_STATUSES = 6 status terbuka, tanpa DONE/CANCELLED", () => {
    expect(ACTIVE_STATUSES).toHaveLength(6);
    expect(ACTIVE_STATUSES).not.toContain("DONE");
    expect(ACTIVE_STATUSES).not.toContain("CANCELLED");
  });
});

describe("bolehBayar (urutan kas: DP di awal, sisanya setelah selesai)", () => {
  it("boleh saat booking/awal — PENDING, WAITING_APPROVAL, CONFIRMED", () => {
    expect(bolehBayar("PENDING")).toBe(true);
    expect(bolehBayar("WAITING_APPROVAL")).toBe(true);
    expect(bolehBayar("CONFIRMED")).toBe(true);
  });

  it("ditahan saat unit diterima/dikerjakan — CHECKED_IN, IN_PROGRESS, WAITING_PARTS", () => {
    expect(bolehBayar("CHECKED_IN")).toBe(false);
    expect(bolehBayar("IN_PROGRESS")).toBe(false);
    expect(bolehBayar("WAITING_PARTS")).toBe(false);
  });

  it("boleh lagi setelah SELESAI (DONE); tidak untuk CANCELLED", () => {
    expect(bolehBayar("DONE")).toBe(true);
    expect(bolehBayar("CANCELLED")).toBe(false);
  });

  it("pesan penahan menyebut DP di awal & pelunasan setelah SELESAI", () => {
    expect(PESAN_BAYAR_DITAHAN).toContain("DP");
    expect(PESAN_BAYAR_DITAHAN).toContain("SELESAI");
  });
});

describe("formatRupiah", () => {
  // CLDR lama: "Rp150.000" — CLDR baru: "Rp\u00A0150.000" (NBSP). Normalisasi dulu.
  const rp = (n: number) => formatRupiah(n).replace(/\u00A0/g, "");

  it("format integer tanpa desimal, pemisah ribuan id-ID", () => {
    expect(rp(0)).toBe("Rp0");
    expect(rp(150000)).toBe("Rp150.000");
    expect(rp(1234567)).toBe("Rp1.234.567");
  });

  it("tidak pernah menampilkan desimal (moneter wajib integer)", () => {
    expect(rp(999)).not.toMatch(/[.,]\d/);
  });
});

describe("formatTanggal & formatTanggalPendek", () => {
  it("null → em dash", () => {
    expect(formatTanggal(null)).toBe("—");
    expect(formatTanggalPendek(null)).toBe("—");
  });

  it("menerima ISO string & Date", () => {
    const iso = "2026-10-24T07:30:00.000Z";
    const d = new Date(iso);
    expect(formatTanggal(iso)).toBe(formatTanggal(d));
    expect(formatTanggalPendek(iso)).toBe(formatTanggalPendek(d));
  });

  it("format pendek tidak memuat tahun, format penuh memuat jam", () => {
    const d = new Date("2026-10-24T07:30:00");
    expect(formatTanggalPendek(d)).not.toMatch(/2026/);
    expect(formatTanggal(d)).toMatch(/\d{2}\.\d{2}/);
  });
});
