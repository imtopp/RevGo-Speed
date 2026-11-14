import { describe, expect, it } from "vitest";
import {
  formatWaLocal,
  normalizeWa,
  pesanJadwalBaru,
  pesanKonfirmasiBooking,
  pesanPembatalan,
  waLink,
} from "./wa";

describe("normalizeWa", () => {
  it("menerima format lokal 08xx dengan spasi/strip", () => {
    expect(normalizeWa("0812 3456-7890")).toBe("6281234567890");
    expect(normalizeWa("0812.3456.7890")).toBe("6281234567890");
    expect(normalizeWa("(0812) 3456 7890")).toBe("6281234567890");
  });

  it("menerima +62 dan 628 langsung", () => {
    expect(normalizeWa("+6281234567890")).toBe("6281234567890");
    expect(normalizeWa("6281234567890")).toBe("6281234567890");
  });

  it("menerima nomor tanpa prefix (8xx) — diasumsikan seluler", () => {
    expect(normalizeWa("81234567890")).toBe("6281234567890");
  });

  it("menolak nomor darat, huruf, dan format aneh", () => {
    expect(normalizeWa("0211234567")).toBeNull(); // darat
    expect(normalizeWa("62211234567")).toBeNull(); // darat prefix 62
    expect(normalizeWa("628012345678")).toBeNull(); // 6280 bukan seluler
    expect(normalizeWa("abc")).toBeNull();
    expect(normalizeWa("")).toBeNull();
    expect(normalizeWa("08123")).toBeNull(); // terlalu pendek
    expect(normalizeWa("08123456789012345")).toBeNull(); // terlalu panjang
    expect(normalizeWa("62812345abc")).toBeNull();
  });

  it("idempoten — hasil normalisasi dinormalisasi ulang tetap sama", () => {
    const once = normalizeWa("0812 3456-7890")!;
    expect(normalizeWa(once)).toBe(once);
  });
});

describe("formatWaLocal", () => {
  it("menampilkan nomor kanonik sebagai format lokal 08xx-xxxx-xxxx", () => {
    expect(formatWaLocal("6281234567890")).toBe("0812-3456-7890");
    expect(formatWaLocal("628123456789")).toBe("0812-3456-789");
  });

  it("tahan data lama mentah 08… — tidak menghasilkan 0950-… (bug slice prefix)", () => {
    // Regresi: nomor akun lama "089501590598" pernah tampil "0950-1590-598"
    // karena formatWaLocal langsung slice(2) tanpa normalisasi.
    expect(formatWaLocal("089501590598")).toBe("0895-0159-0598");
    expect(formatWaLocal("0812-3456-7890")).toBe("0812-3456-7890");
    expect(formatWaLocal("81234567890")).toBe("0812-3456-7890");
  });

  it("input tak dikenal ditampilkan apa adanya", () => {
    expect(formatWaLocal("bukan-nomor")).toBe("bukan-nomor");
    expect(formatWaLocal("")).toBe("");
  });
});

describe("waLink", () => {
  it("membuat tautan dasar tanpa pesan", () => {
    expect(waLink("6281234567890")).toBe("https://wa.me/6281234567890");
  });

  it("menormalisasi data lama 08… menjadi wa.me 62…", () => {
    expect(waLink("081234567890")).toBe("https://wa.me/6281234567890");
  });

  it("meng-encode pesan awal", () => {
    expect(waLink("6281234567890", "Halo, saya mau konfirmasi booking SV-1")).toBe(
      "https://wa.me/6281234567890?text=" +
        encodeURIComponent("Halo, saya mau konfirmasi booking SV-1"),
    );
  });
});

describe("pesanKonfirmasiBooking", () => {
  it("gabungkan greeting, kode, dan semua rincian yang tersedia", () => {
    expect(
      pesanKonfirmasiBooking({
        appName: "TBRT",
        code: "SV-BT26-0001",
        kendaraan: "B 1234 XY · Honda Beat",
        layanan: "Ganti oli",
        jadwal: "13 Nov 2026, 10:00 WIB",
      }),
    ).toBe(
      "Halo TBRT, saya mau konfirmasi booking SV-BT26-0001.\n" +
        "Motor: B 1234 XY · Honda Beat\n" +
        "Layanan: Ganti oli\n" +
        "Jadwal: 13 Nov 2026, 10:00 WIB",
    );
  });

  it("hanya greeting + kode bila rincian tidak ada", () => {
    expect(pesanKonfirmasiBooking({ appName: "RevGo", code: "SV-01" })).toBe(
      "Halo RevGo, saya mau konfirmasi booking SV-01.",
    );
    expect(
      pesanKonfirmasiBooking({
        appName: "RevGo",
        code: "SV-01",
        kendaraan: null,
        layanan: "",
        jadwal: undefined,
      }),
    ).toBe("Halo RevGo, saya mau konfirmasi booking SV-01.");
  });

  it("lewatkan rincian sebagian tanpa baris kosong", () => {
    expect(
      pesanKonfirmasiBooking({
        appName: "TBRT",
        code: "SV-BT26-0002",
        layanan: "Servis rem",
      }),
    ).toBe(
      "Halo TBRT, saya mau konfirmasi booking SV-BT26-0002.\nLayanan: Servis rem",
    );
  });
});

describe("pesanPembatalan", () => {
  it("gabungkan greeting, kode, alasan, dan penutup", () => {
    expect(
      pesanPembatalan({
        appName: "TBRT",
        code: "SV-BT26-0009",
        alasan: "Customer tidak jadi datang",
      }),
    ).toBe(
      "Halo, booking SV-BT26-0009 di TBRT dibatalkan oleh bengkel.\n" +
        "Alasan: Customer tidak jadi datang\n" +
        "Mohon maaf atas ketidaknyamanannya — silakan booking ulang kapan saja.",
    );
  });

  it("alasan kosong/tidak ada tidak menghasilkan baris kosong", () => {
    const tanpaAlasan = "Halo, booking SV-01 di RevGo dibatalkan oleh bengkel.\n" +
      "Mohon maaf atas ketidaknyamanannya — silakan booking ulang kapan saja.";
    expect(pesanPembatalan({ appName: "RevGo", code: "SV-01" })).toBe(tanpaAlasan);
    expect(
      pesanPembatalan({ appName: "RevGo", code: "SV-01", alasan: null }),
    ).toBe(tanpaAlasan);
    expect(
      pesanPembatalan({ appName: "RevGo", code: "SV-01", alasan: "" }),
    ).toBe(tanpaAlasan);
  });
});

describe("pesanJadwalBaru", () => {
  it("gabungkan greeting, kode, dan jadwal baru", () => {
    expect(
      pesanJadwalBaru({
        appName: "TBRT",
        code: "SV-BT26-0010",
        jadwal: "14 Nov 2026, 10.00",
      }),
    ).toBe(
      "Halo, jadwal kedatangan booking SV-BT26-0010 di TBRT diubah.\n" +
        "Jadwal baru: 14 Nov 2026, 10.00\n" +
        "Mohon dikonfirmasi bila berkenan. Terima kasih.",
    );
  });
});
