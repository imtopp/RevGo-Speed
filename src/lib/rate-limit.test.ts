import { describe, it, expect } from "vitest";
import { ruleFor, windowStartFor, isOverLimit } from "./rate-limit";

describe("ruleFor", () => {
  it("membatasi mutasi NextAuth (POST /api/auth/*) ketat", () => {
    const r = ruleFor("/api/auth/callback/credentials", "POST");
    expect(r?.limit).toBe(20);
    expect(r?.scope).toBe("auth");
  });

  it("meloloskan GET /api/auth/* (session/CSRF sering dipanggil)", () => {
    expect(ruleFor("/api/auth/session", "GET")).toBeNull();
  });

  it("POST /login & /register paling ketat", () => {
    expect(ruleFor("/login", "POST")?.limit).toBe(10);
    expect(ruleFor("/register", "POST")?.limit).toBe(10);
  });

  it("GET /login diberi limit longgar, bukan null", () => {
    expect(ruleFor("/login", "GET")?.limit).toBe(60);
  });

  it("export dibatasi ketat (berat)", () => {
    expect(ruleFor("/api/backup/export", "GET")?.limit).toBe(10);
    expect(ruleFor("/api/laporan/export", "GET")?.limit).toBe(10);
  });

  it("import/restore dibatasi paling ketat (destruktif)", () => {
    const r = ruleFor("/api/backup/import", "POST");
    expect(r?.limit).toBe(5);
    expect(r?.scope).toBe("import");
  });

  it("membatasi SEMUA mutasi (server action & API), bukan cuma auth", () => {
    for (const path of [
      "/dashboard/servis",
      "/dashboard/stok",
      "/dashboard/kas",
      "/pesanan",
    ]) {
      expect(ruleFor(path, "POST")?.limit).toBe(60);
      expect(ruleFor(path, "POST")?.scope).toBe("mutate");
    }
    expect(ruleFor("/api/some-write", "PUT")?.scope).toBe("mutate");
    expect(ruleFor("/api/some-write", "DELETE")?.scope).toBe("mutate");
  });

  it("meloloskan GET halaman biasa (read-only)", () => {
    expect(ruleFor("/dashboard/servis", "GET")).toBeNull();
    expect(ruleFor("/pesanan", "GET")).toBeNull();
  });
});

describe("windowStartFor", () => {
  it("membulatkan ke bawah ke awal window", () => {
    expect(windowStartFor(125_000, 60_000)).toBe(120_000);
    expect(windowStartFor(60_000, 60_000)).toBe(60_000);
    expect(windowStartFor(59_999, 60_000)).toBe(0);
  });

  it("monotonik — window berganti saat waktu maju", () => {
    expect(windowStartFor(60_000, 60_000)).toBeGreaterThan(
      windowStartFor(59_999, 60_000),
    );
  });
});

describe("isOverLimit", () => {
  it("lolos tepat di limit, ditolak di atasnya", () => {
    expect(isOverLimit(10, 10)).toBe(false);
    expect(isOverLimit(11, 10)).toBe(true);
    expect(isOverLimit(1, 10)).toBe(false);
  });
});
