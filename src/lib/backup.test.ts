import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { BACKUP_TABLES, parseBackup } from "./backup";

describe("BACKUP_TABLES sinkron dengan schema.prisma", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const schemaModels = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);

  it("menyertakan SEMUA model skema (tambah/hapus model → wajib update backup.ts)", () => {
    const tableModels = BACKUP_TABLES.map((t) => t.model);
    expect([...tableModels].sort()).toEqual([...schemaModels].sort());
  });

  it("model, delegate, key unik", () => {
    for (const f of ["model", "delegate", "key"] as const) {
      const vals = BACKUP_TABLES.map((t) => t[f]);
      expect(new Set(vals).size).toBe(vals.length);
    }
  });

  it("key cocok dengan properti delegate Prisma (decapitalize model)", () => {
    for (const t of BACKUP_TABLES) {
      expect(t.delegate).toBe(t.model.charAt(0).toLowerCase() + t.model.slice(1));
    }
  });
});

function samplePayload(overrides: Record<string, unknown[]> = {}) {
  const data: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) data[t.key] = [];
  data.branches = [{ id: "b1", name: "Pusat" }];
  data.users = [{ id: "u1", name: "Admin", email: "a@x.id" }];
  return { exportedAt: "2026-10-26T00:00:00.000Z", app: "RevGo Speed", data: { ...data, ...overrides } };
}

describe("parseBackup", () => {
  it("menerima payload lengkap & menghitung counts per tabel", () => {
    const res = parseBackup(JSON.stringify(samplePayload({ parts: [{ id: "p1" }, { id: "p2" }] })));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.counts.parts).toBe(2);
    expect(res.counts.branches).toBe(1);
    expect(res.missingTables).toEqual([]);
    expect(res.ignoredKeys).toEqual([]);
    expect(res.payload.exportedAt).toBe("2026-10-26T00:00:00.000Z");
  });

  it("file versi lama (tabel baru belum ada) → ditoleransi sebagai missing, diisi kosong", () => {
    const p = samplePayload();
    delete (p.data as Record<string, unknown>)["rateLimitBuckets"];
    const res = parseBackup(JSON.stringify(p));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.missingTables).toContain("rateLimitBuckets");
    expect(res.payload.data.rateLimitBuckets).toEqual([]);
  });

  it("key asing (file versi lebih baru) → diabaikan, tidak menggagalkan", () => {
    const p = samplePayload();
    (p.data as Record<string, unknown>)["tabelMasaDepan"] = [{ id: "x" }];
    const res = parseBackup(JSON.stringify(p));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.ignoredKeys).toContain("tabelMasaDepan");
    expect(res.payload.data).not.toHaveProperty("tabelMasaDepan");
  });

  it("JSON rusak → error jelas", () => {
    const res = parseBackup("{tidak valid");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/JSON valid/);
  });

  it("bukan objek / tanpa data → ditolak", () => {
    expect(parseBackup("[1,2]").ok).toBe(false);
    expect(parseBackup('{"app":"x"}').ok).toBe(false);
  });

  it("tabel bertipe salah (bukan array) → ditolak dengan nama tabel", () => {
    const p = samplePayload({ parts: { id: "bukan-array" } as unknown as unknown[] });
    const res = parseBackup(JSON.stringify(p));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/parts/);
  });

  it("baris bukan objek → ditolak dengan posisi", () => {
    const res = parseBackup(JSON.stringify(samplePayload({ parts: ["string"] })));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/baris ke-1.*parts/i);
  });

  it("file JSON valid tanpa satu pun tabel dikenal → ditolak", () => {
    const res = parseBackup(JSON.stringify({ data: { kucing: [] } }));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/tabel yang dikenal/);
  });
});
