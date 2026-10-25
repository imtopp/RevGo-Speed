import { describe, expect, it } from "vitest";
import {
  BOOKING_CONFIG_DEFAULT,
  cekKapasitas,
  daftarSlot,
  daftarTanggal,
  dateStrOf,
  epochFromWall,
  formatAlternatif,
  formatDurasi,
  jamOf,
  jendelaDari,
  parseBookingConfig,
  parseHariAktif,
  parseJam,
  parseJadwal,
  pesanDitolak,
  sisaKuota,
  slotTitikHari,
  startOfDayWib,
  statusTanggal,
  validasiSlot,
  wibParts,
  type CekSlotInput,
  type Jendela,
} from "./availability";

const cfg = BOOKING_CONFIG_DEFAULT;

function input(over: Partial<CekSlotInput> = {}): CekSlotInput {
  return {
    epoch: epochFromWall(2026, 11, 2, 10, 0),
    now: epochFromWall(2026, 11, 2, 7, 0),
    config: cfg,
    kuotaParalel: 2,
    jamBuka: "08:00",
    jamTutup: "17:00",
    hariAktif: "1,2,3,4,5,6",
    jendelas: [],
    durasiMenit: 60,
    pakaiLeadTime: true,
    ...over,
  };
}

describe("parseBookingConfig", () => {
  it("tanpa data → default", () => {
    expect(parseBookingConfig([])).toEqual(cfg);
  });

  it("nilai valid dipakai", () => {
    expect(
      parseBookingConfig([
        { key: "booking_lead_minutes", value: "30" },
        { key: "booking_horizon_days", value: "7" },
        { key: "booking_buffer_minutes", value: "10" },
      ]),
    ).toEqual({ leadMinutes: 30, horizonDays: 7, bufferMinutes: 10 });
  });

  it("nilai tidak valid / di luar rentang → default per key", () => {
    expect(
      parseBookingConfig([
        { key: "booking_lead_minutes", value: "abc" },
        { key: "booking_horizon_days", value: "-3" },
        { key: "booking_buffer_minutes", value: "99999" },
      ]),
    ).toEqual(cfg);
    expect(parseBookingConfig([{ key: "booking_lead_minutes", value: "12.5" }]).leadMinutes).toBe(
      cfg.leadMinutes,
    );
  });
});

describe("helper waktu WIB", () => {
  it("parseJadwal valid + detik opsional", () => {
    expect(parseJadwal("2026-11-02T10:30")).toBe(epochFromWall(2026, 11, 2, 10, 30));
    expect(parseJadwal("2026-11-02T10:30:15")).toBe(epochFromWall(2026, 11, 2, 10, 30));
    expect(parseJadwal(" 2026-11-02T10:30 ")).toBe(epochFromWall(2026, 11, 2, 10, 30));
  });

  it("parseJadwal invalid → null", () => {
    expect(parseJadwal("2026-11-02")).toBeNull();
    expect(parseJadwal("2026-13-01T10:00")).toBeNull();
    expect(parseJadwal("2026-02-30T10:00")).toBeNull();
    expect(parseJadwal("2026-11-02T25:00")).toBeNull();
    expect(parseJadwal("abc")).toBeNull();
    expect(parseJadwal("")).toBeNull();
  });

  it("dateStrOf & jamOf dari komponen WIB", () => {
    const e = epochFromWall(2026, 1, 5, 0, 30);
    expect(dateStrOf(e)).toBe("2026-01-05");
    expect(jamOf(e)).toBe("00:30");
  });

  it("startOfDayWib = tengah malam WIB yang sama", () => {
    const e = epochFromWall(2026, 11, 2, 15, 45);
    expect(dateStrOf(startOfDayWib(e))).toBe("2026-11-02");
    expect(jamOf(startOfDayWib(e))).toBe("00:00");
  });

  it("parseJam", () => {
    expect(parseJam("08:00")).toBe(480);
    expect(parseJam("8:00")).toBe(480);
    expect(parseJam("17:00")).toBe(1020);
    expect(parseJam("24:00")).toBeNull();
    expect(parseJam("08:60")).toBeNull();
    expect(parseJam("buka")).toBeNull();
  });

  it("parseHariAktif", () => {
    expect([...parseHariAktif("1,2,3")].sort()).toEqual([1, 2, 3]);
    expect([...parseHariAktif("0, 6,3")].sort()).toEqual([0, 3, 6]);
    expect(parseHariAktif("9,x").size).toBe(0);
    expect(parseHariAktif("").size).toBe(0);
  });
});

describe("slotTitikHari", () => {
  it("08:00–17:00 → 9 titik per jam", () => {
    const pts = slotTitikHari("2026-11-02", "08:00", "17:00");
    expect(pts).toHaveLength(9);
    expect(pts[0]).toBe(epochFromWall(2026, 11, 2, 8, 0));
    expect(pts[8]).toBe(epochFromWall(2026, 11, 2, 16, 0));
    expect(pts[1] - pts[0]).toBe(3600000);
  });

  it("buka non-kelipatan jam & tutup == buka", () => {
    const pts = slotTitikHari("2026-11-02", "08:30", "10:00");
    expect(pts).toHaveLength(2);
    expect(pts[0]).toBe(epochFromWall(2026, 11, 2, 8, 30));
    expect(slotTitikHari("2026-11-02", "09:00", "09:00")).toEqual([]);
    expect(slotTitikHari("2026-11-02", "17:00", "08:00")).toEqual([]);
    expect(slotTitikHari("bukan-tanggal", "08:00", "17:00")).toEqual([]);
  });
});

describe("jendelaDari & sisaKuota", () => {
  it("durasi + buffer, di-cap akhir hari WIB", () => {
    const mulai = epochFromWall(2026, 11, 2, 8, 0);
    const jw = jendelaDari(mulai, 60, 15);
    expect(jw.selesai - jw.mulai).toBe(75 * 60000);
    const malam = epochFromWall(2026, 11, 2, 23, 0);
    const jwCap = jendelaDari(malam, 300, 0);
    expect(jwCap.selesai).toBe(startOfDayWib(malam) + 24 * 3600000);
  });

  it("coverage per titik: mulai inklusif, selesai eksklusif", () => {
    const jw: Jendela[] = [jendelaDari(epochFromWall(2026, 11, 2, 10, 0), 60, 15)];
    expect(sisaKuota(epochFromWall(2026, 11, 2, 10, 0), jw, 2)).toBe(1);
    expect(sisaKuota(epochFromWall(2026, 11, 2, 11, 0), jw, 2)).toBe(1);
    expect(sisaKuota(epochFromWall(2026, 11, 2, 11, 15), jw, 2)).toBe(2);
    expect(sisaKuota(epochFromWall(2026, 11, 2, 9, 59), jw, 2)).toBe(2);
    const tiga: Jendela[] = [
      jendelaDari(epochFromWall(2026, 11, 2, 10, 0), 60, 15),
      jendelaDari(epochFromWall(2026, 11, 2, 10, 30), 60, 15),
      jendelaDari(epochFromWall(2026, 11, 2, 10, 45), 60, 15),
    ];
    expect(sisaKuota(epochFromWall(2026, 11, 2, 11, 0), tiga, 2)).toBe(0);
  });

  it("cekKapasitas → titik pertama yang penuh", () => {
    const existing = jendelaDari(epochFromWall(2026, 11, 2, 10, 0), 60, 15);
    const penuh = cekKapasitas(
      epochFromWall(2026, 11, 2, 10, 30),
      60,
      15,
      [existing],
      1,
      "08:00",
      "17:00",
    );
    expect(penuh).toBe(epochFromWall(2026, 11, 2, 10, 30));
    const bebas = cekKapasitas(
      epochFromWall(2026, 11, 2, 13, 0),
      60,
      15,
      [existing],
      1,
      "08:00",
      "17:00",
    );
    expect(bebas).toBeNull();
  });
});

describe("validasiSlot", () => {
  it("slot kosong & jauh → ok", () => {
    expect(validasiSlot(input())).toEqual({ ok: true });
  });

  it("waktu sudah lewat → tolak", () => {
    const h = validasiSlot(input({ epoch: epochFromWall(2026, 11, 1, 10, 0) }));
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.error).toContain("lewat");
  });

  it("customer kurang dari lead time 2 jam → tolak + alternatif", () => {
    const h = validasiSlot(input({ epoch: epochFromWall(2026, 11, 2, 8, 0) }));
    expect(h.ok).toBe(false);
    if (!h.ok) {
      expect(h.error).toContain("2 jam");
      expect(h.alternatif[0]).toEqual({ date: "2026-11-02", jam: "09:00" });
      expect(pesanDitolak(h)).toContain("Alternatif");
    }
  });

  it("staff (tanpa lead) boleh booking dekat sekarang", () => {
    expect(
      validasiSlot(input({ epoch: epochFromWall(2026, 11, 2, 8, 0), pakaiLeadTime: false })),
    ).toEqual({ ok: true });
  });

  it("melewati horizon 14 hari → tolak", () => {
    const h = validasiSlot(input({ epoch: epochFromWall(2026, 12, 1, 10, 0) }));
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.error).toContain("14 hari");
  });

  it("hari non-operasional → tolak (dibangun dari dow aktual)", () => {
    const epoch = epochFromWall(2026, 11, 2, 10, 0);
    const dow = wibParts(epoch).dow;
    const hariAktif = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== dow).join(",");
    const h = validasiSlot(input({ epoch, hariAktif }));
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.error).toContain("tutup pada hari");
  });

  it("di luar jam buka → tolak + alternatif", () => {
    const h = validasiSlot(
      input({ now: epochFromWall(2026, 11, 1, 20, 0), epoch: epochFromWall(2026, 11, 2, 7, 0) }),
    );
    expect(h.ok).toBe(false);
    if (!h.ok) expect(h.error).toContain("Di luar jam operasional");
    if (!h.ok) expect(h.alternatif[0].jam).toBe("08:00");
  });

  it("kuota penuh → tolak dengan slot yang penuh + alternatif", () => {
    const jendelas = [jendelaDari(epochFromWall(2026, 11, 2, 10, 0), 60, 15)];
    const h = validasiSlot(
      input({ epoch: epochFromWall(2026, 11, 2, 10, 30), kuotaParalel: 1, jendelas }),
    );
    expect(h.ok).toBe(false);
    if (!h.ok) {
      expect(h.error).toContain("10.30");
      expect(h.alternatif.some((a) => a.jam === "13:00")).toBe(true);
    }
  });

  it("kuota paralel 2: dua booking bersamaan → booking ketiga ditolak", () => {
    const jendelas = [
      jendelaDari(epochFromWall(2026, 11, 2, 10, 0), 60, 15),
      jendelaDari(epochFromWall(2026, 11, 2, 10, 30), 60, 15),
    ];
    const h = validasiSlot(
      input({ epoch: epochFromWall(2026, 11, 2, 11, 0), kuotaParalel: 2, jendelas }),
    );
    expect(h.ok).toBe(false);
  });

  it("cabang tutup sehari tidak menghalangi hari lain", () => {
    const h = validasiSlot(input({ hariAktif: "1,2,3,4,5,6" }));
    expect(h.ok).toBe(true);
    const besok = validasiSlot(
      input({ epoch: epochFromWall(2026, 11, 3, 10, 0), hariAktif: "1,2,3,4,5,6" }),
    );
    expect(besok.ok).toBe(true);
  });
});

describe("statusTanggal & daftarSlot", () => {
  const now = epochFromWall(2026, 11, 2, 7, 0);

  it("lewat / tutup / kosong / penuh", () => {
    const base = {
      now,
      jamBuka: "08:00",
      jamTutup: "17:00",
      hariAktif: "1,2,3,4,5,6",
      kuotaParalel: 1,
      jendelas: [] as Jendela[],
    };
    expect(statusTanggal({ ...base, dateStr: "2026-11-01" })).toBe("lewat");
    const dow = wibParts(epochFromWall(2026, 11, 2, 0, 0)).dow;
    const aktifTanpaIni = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== dow).join(",");
    expect(statusTanggal({ ...base, dateStr: "2026-11-02", hariAktif: aktifTanpaIni })).toBe(
      "tutup",
    );
    expect(statusTanggal({ ...base, dateStr: "2026-11-02" })).toBe("kosong");
    expect(
      statusTanggal({
        ...base,
        dateStr: "2026-11-02",
        jendelas: [jendelaDari(epochFromWall(2026, 11, 2, 8, 0), 600, 0)],
      }),
    ).toBe("penuh");
  });

  it("daftarSlot menampilkan sisa kuota per jam", () => {
    const slots = daftarSlot({
      dateStr: "2026-11-02",
      jamBuka: "08:00",
      jamTutup: "17:00",
      kuotaParalel: 2,
      jendelas: [jendelaDari(epochFromWall(2026, 11, 2, 10, 0), 60, 15)],
    });
    expect(slots).toHaveLength(9);
    const jam10 = slots.find((s) => s.jam === "10:00")!;
    const jam11 = slots.find((s) => s.jam === "11:00")!;
    const jam13 = slots.find((s) => s.jam === "13:00")!;
    expect(jam10.sisa).toBe(1);
    expect(jam10.penuh).toBe(false);
    expect(jam11.sisa).toBe(1);
    expect(jam13.sisa).toBe(2);
  });

  it("daftarTanggal: hari ini s/d horizon", () => {
    const list = daftarTanggal(now, 14);
    expect(list).toHaveLength(15);
    expect(list[0]).toBe("2026-11-02");
    expect(list[14]).toBe("2026-11-16");
  });
});

describe("format", () => {
  it("formatDurasi", () => {
    expect(formatDurasi(120)).toBe("2 jam");
    expect(formatDurasi(90)).toBe("1 jam 30 menit");
    expect(formatDurasi(45)).toBe("45 menit");
  });

  it("formatAlternatif mengelompokkan per tanggal", () => {
    expect(
      formatAlternatif([
        { date: "2026-11-02", jam: "10:00" },
        { date: "2026-11-02", jam: "11:00" },
        { date: "2026-11-03", jam: "09:00" },
      ]),
    ).toBe(" Alternatif: 2 Nov 10.00, 11.00; 3 Nov 09.00.");
    expect(formatAlternatif([])).toBe("");
  });
});
