import { describe, expect, it } from "vitest";
import {
  dedupBatal,
  dedupBookingBaru,
  dedupEstimasi,
  dedupJadwal,
  dedupSelesai,
  dedupStokMenipis,
  penerimaCustomerDari,
  penerimaStaffDari,
  payloadBatal,
  payloadBookingBaru,
  payloadEstimasi,
  payloadJadwal,
  payloadSelesai,
  payloadStokMenipis,
  pushEnabled,
  stokMelintasiBatas,
  uniqueIds,
} from "@/lib/push";

describe("dedupKey anti-dobel", () => {
  it("per-event punya prefix berbeda (bentrok lintas event tidak saling menelan)", () => {
    expect(dedupBookingBaru("s1")).toBe("booking:s1");
    expect(dedupEstimasi("s1")).toBe("estimasi:s1");
    expect(dedupBatal("s1")).toBe("batal:s1");
    expect(dedupSelesai("s1")).toBe("selesai:s1");
    expect(dedupJadwal("s1", 123)).toBe("jadwal:s1:123");
  });

  it("jadwal: beda waktu jadwal = beda key (2x ganti jadwal = 2 notif)", () => {
    expect(dedupJadwal("s1", 1000)).not.toBe(dedupJadwal("s1", 2000));
    expect(dedupJadwal("s1", 1000)).toBe(dedupJadwal("s1", 1000));
  });

  it("stok: per menit per part — gerakan cepat di menit sama = 1 klaim", () => {
    const a = new Date("2026-11-13T10:00:10.000Z");
    const b = new Date("2026-11-13T10:00:50.000Z");
    const c = new Date("2026-11-13T10:01:10.000Z");
    expect(dedupStokMenipis("p1", a)).toBe(dedupStokMenipis("p1", b));
    expect(dedupStokMenipis("p1", a)).not.toBe(dedupStokMenipis("p1", c));
    expect(dedupStokMenipis("p1", a)).not.toBe(dedupStokMenipis("p2", a));
  });
});

describe("payload", () => {
  it("booking baru → detail servis staff", () => {
    const p = payloadBookingBaru({
      id: "s1",
      code: "SV-1",
      plate: "B 1234 XY",
      scheduledAt: new Date("2026-11-13T07:00:00Z"),
      tag: "booking:s1",
    });
    expect(p.title).toBe("Booking baru masuk");
    expect(p.body).toContain("SV-1");
    expect(p.body).toContain("B 1234 XY");
    expect(p.url).toBe("/dashboard/servis/s1");
    expect(p.tag).toBe("booking:s1");
  });

  it("estimasi/jadwal/batal/selesai → pesanan customer", () => {
    const est = payloadEstimasi({ id: "s1", code: "SV-1", estimate: 150000, tag: "estimasi:s1" });
    expect(est.url).toBe("/pesanan");
    expect(est.body).toContain("150.000");
    const jadwal = payloadJadwal({
      id: "s1",
      code: "SV-1",
      scheduledAt: new Date("2026-11-13T07:00:00Z"),
      tag: "jadwal:s1:1",
    });
    expect(jadwal.url).toBe("/pesanan");
    const batal = payloadBatal({ id: "s1", code: "SV-1", reason: "Pelanggan batal", tag: "batal:s1" });
    expect(batal.body).toContain("Pelanggan batal");
    const tanpaAlasan = payloadBatal({ id: "s1", code: "SV-1", reason: null, tag: "batal:s1" });
    expect(tanpaAlasan.body).toBe("SV-1");
    const selesai = payloadSelesai({ id: "s1", code: "SV-1", tag: "selesai:s1" });
    expect(selesai.title).toBe("Servis selesai");
    expect(selesai.url).toBe("/pesanan");
  });

  it("stok menipis → halaman stok + sisa & batas", () => {
    const p = payloadStokMenipis({
      name: "Oli 10W-40",
      qty: 2,
      unit: "liter",
      minStock: 5,
      tag: "stok:p1:1",
    });
    expect(p.url).toBe("/dashboard/stok");
    expect(p.body).toContain("2 liter");
    expect(p.body).toContain("min 5");
    expect(p.tag).toBe("stok:p1:1");
  });
});

describe("penerima", () => {
  const staff = [
    { id: "own", role: "OWNER", branchId: null, isActive: true },
    { id: "adm-a", role: "ADMIN", branchId: "A", isActive: true },
    { id: "adm-b", role: "ADMIN", branchId: "B", isActive: true },
    { id: "adm-off", role: "ADMIN", branchId: "A", isActive: false },
    { id: "mek", role: "MECHANIC", branchId: "A", isActive: true },
  ];

  it("staff: owner lintas cabang + admin hanya cabang terkait, non-aktif & mekanik gugur", () => {
    expect(penerimaStaffDari(staff, "A").sort()).toEqual(["adm-a", "own"]);
    expect(penerimaStaffDari(staff, "B").sort()).toEqual(["adm-b", "own"]);
    expect(penerimaStaffDari(staff, null).sort()).toEqual(["adm-a", "adm-b", "own"]);
  });

  it("customer: unik [customerId, ownerId] + hanya CUSTOMER aktif; walk-in kosong", () => {
    const users = [
      { id: "c1", role: "CUSTOMER", isActive: true },
      { id: "c2", role: "CUSTOMER", isActive: false },
      { id: "own", role: "OWNER", isActive: true },
    ];
    expect(penerimaCustomerDari(["c1", "c1"], users)).toEqual(["c1"]);
    expect(penerimaCustomerDari(["c1", "c2"], users)).toEqual(["c1"]);
    expect(penerimaCustomerDari(["c1", "own"], users)).toEqual(["c1"]);
    expect(penerimaCustomerDari([null, null], users)).toEqual([]);
    expect(penerimaCustomerDari(["c1"], [users[1]])).toEqual([]);
  });

  it("uniqueIds: buang null & duplikat", () => {
    expect(uniqueIds(["a", null, "a", undefined, "b"])).toEqual(["a", "b"]);
    expect(uniqueIds([null, undefined])).toEqual([]);
  });
});

describe("stokMelintasiBatas", () => {
  it("hanya penyeberangan dari atas ke bawah/sama dengan batas", () => {
    expect(stokMelintasiBatas(10, 5, 5)).toBe(true);
    expect(stokMelintasiBatas(10, 4, 5)).toBe(true);
    expect(stokMelintasiBatas(5, 3, 5)).toBe(false); // sudah di bawah
    expect(stokMelintasiBatas(6, 7, 5)).toBe(false); // naik
    expect(stokMelintasiBatas(4, 5, 5)).toBe(false); // masih di bawah
  });

  it("minStock <= 0 (tanpa batas) tidak pernah memberi peringatan", () => {
    expect(stokMelintasiBatas(10, 0, 0)).toBe(false);
    expect(stokMelintasiBatas(10, -1, -1)).toBe(false);
  });
});

describe("pushEnabled", () => {
  it("mati (false) saat env VAPID tidak di-set", () => {
    const beforePub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const beforePriv = process.env.VAPID_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    expect(pushEnabled()).toBe(false);
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub-test";
    process.env.VAPID_PRIVATE_KEY = "priv-test";
    expect(pushEnabled()).toBe(true);
    if (beforePub === undefined) delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    else process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = beforePub;
    if (beforePriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = beforePriv;
  });
});
