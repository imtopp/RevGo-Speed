import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  validasiPasswordBaru,
} from "./password";

describe("hashPassword", () => {
  it("format salt:hash — salt 32 hex, hash 128 hex", () => {
    const stored = hashPassword("rahasia123");
    const [salt, hash] = stored.split(":");
    expect(stored.split(":")).toHaveLength(2);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it("salt unik — hash sama tidak boleh identik", () => {
    expect(hashPassword("rahasia123")).not.toBe(hashPassword("rahasia123"));
  });
});

describe("verifyPassword", () => {
  it("benar untuk password yang cocok", () => {
    const stored = hashPassword("rahasia123");
    expect(verifyPassword("rahasia123", stored)).toBe(true);
  });

  it("salah untuk password berbeda", () => {
    const stored = hashPassword("rahasia123");
    expect(verifyPassword("rahasia124", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("tolak stored yang rusak/tanpa format salt:hash", () => {
    expect(verifyPassword("x", "abc")).toBe(false);
    expect(verifyPassword("x", "abc:def")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });

  it("tolak hash yang dipotong/diubah (timing-safe compare)", () => {
    const stored = hashPassword("rahasia123");
    const [salt, hash] = stored.split(":");
    expect(verifyPassword("rahasia123", `${salt}:${hash.slice(0, 126)}`)).toBe(
      false,
    );
    expect(verifyPassword("rahasia123", `${salt}:${"0".repeat(128)}`)).toBe(
      false,
    );
  });
});

describe("validasiPasswordBaru", () => {
  it("lolos kalau ≥6 karakter dan konfirmasi cocok", () => {
    expect(validasiPasswordBaru("rahasia123", "rahasia123")).toBeNull();
  });

  it("tolak password baru <6 karakter", () => {
    expect(validasiPasswordBaru("abc12", "abc12")).toMatch(/minimal 6/);
  });

  it("tolak konfirmasi tidak cocok", () => {
    expect(validasiPasswordBaru("rahasia123", "rahasia124")).toMatch(
      /tidak cocok/,
    );
  });
});
