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
  windowHariWIB,
  periodeWIB,
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

  it("selalu WIB — hasil tidak bergantung TZ runtime server", () => {
    // 07:30Z = 14:30 WIB; 17:30Z = 00:30 WIB (hari berganti).
    expect(formatTanggal("2026-10-24T07:30:00.000Z")).toMatch(
      /24.*14[.:]30/,
    );
    expect(formatTanggal("2026-10-24T17:30:00.000Z")).toMatch(
      /25.*00[.:]30/,
    );
    expect(formatTanggalPendek("2026-10-24T17:30:00.000Z")).toMatch(
      /25.*00[.:]30/,
    );
  });
});

describe("windowHariWIB (filter tanggal papan servis)", () => {
  it("format valid → window WIB setengah terbuka [00:00, 00:00 berikutnya)", () => {
    expect(windowHariWIB("2026-10-26")).toEqual({
      gte: "2026-10-26T00:00:00+07:00",
      lt: "2026-10-27T00:00:00+07:00",
    });
  });

  it("lintas bulan, tahun, & tahun kabisat", () => {
    expect(windowHariWIB("2026-12-31")).toEqual({
      gte: "2026-12-31T00:00:00+07:00",
      lt: "2027-01-01T00:00:00+07:00",
    });
    expect(windowHariWIB("2028-02-28")?.lt).toBe("2028-02-29T00:00:00+07:00");
    expect(windowHariWIB("2026-02-28")?.lt).toBe("2026-03-01T00:00:00+07:00");
  });

  it("nilai kosong / asing / tanggal mustahil → null (tanpa Invalid Date)", () => {
    expect(windowHariWIB(null)).toBeNull();
    expect(windowHariWIB(undefined)).toBeNull();
    expect(windowHariWIB("")).toBeNull();
    expect(windowHariWIB("26-10-2026")).toBeNull();
    expect(windowHariWIB("2026-10-26; DROP TABLE")).toBeNull();
    expect(windowHariWIB("2026-13-01")).toBeNull();
    expect(windowHariWIB("2026-02-31")).toBeNull();
  });
});

describe("periodeWIB (rentang laporan/export)", () => {
  // "now" dikunci: 24 Okt 2026 20:00Z = 25 Okt 2026 03:00 WIB → bulan WIB = Okt.
  const now = new Date("2026-10-24T20:00:00.000Z");

  it("tanpa param → bulan berjalan menurut kalender WIB (bukan UTC server)", () => {
    expect(periodeWIB(null, null, now)).toEqual({
      gte: "2026-10-01T00:00:00+07:00",
      lt: "2026-11-01T00:00:00+07:00",
      dari: "2026-10-01",
      sampai: "2026-10-31",
    });
  });

  it("sudah WIB pagi (masih bulan lama di UTC) tetap bulan WIB yang benar", () => {
    // 1 Okt 2026 16:30Z = 2 Nov 2026 00:00-07... pakai 1 Nov 16:30Z = 2 Nov 00:30 WIB
    const d = new Date("2026-11-01T16:30:00.000Z");
    const p = periodeWIB(null, null, d);
    expect(p.gte).toBe("2026-11-01T00:00:00+07:00");
    expect(p.lt).toBe("2026-12-01T00:00:00+07:00");
  });

  it("param dari/to valid → window hari WIB, bukan tanggal default", () => {
    const p = periodeWIB("2026-09-10", "2026-09-15", now);
    expect(p).toEqual({
      gte: "2026-09-10T00:00:00+07:00",
      lt: "2026-09-16T00:00:00+07:00",
      dari: "2026-09-10",
      sampai: "2026-09-15",
    });
  });

  it("param tercampur: yang valid dipakai, yang tidak → default bulan", () => {
    const p = periodeWIB("2026-10-20", "2026-99-99", now);
    expect(p.gte).toBe("2026-10-20T00:00:00+07:00");
    expect(p.lt).toBe("2026-11-01T00:00:00+07:00");
    expect(p.dari).toBe("2026-10-20");
    expect(p.sampai).toBe("2026-10-31");
  });

  it("sampai = hari terakhir periode (lt − 1 hari, lintas akhir tahun)", () => {
    const p = periodeWIB("2026-12-25", "2026-12-31", now);
    expect(p.lt).toBe("2027-01-01T00:00:00+07:00");
    expect(p.sampai).toBe("2026-12-31");
  });
});
