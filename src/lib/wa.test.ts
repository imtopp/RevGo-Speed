import { describe, expect, it } from "vitest";
import { formatWaLocal, normalizeWa, waLink } from "./wa";

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
