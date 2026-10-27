import { describe, it, expect } from "vitest";
import { resolveVersion } from "./version";

describe("resolveVersion", () => {
  it("utamakan deployment id", () => {
    expect(
      resolveVersion(
        { deploymentId: "dpl_123", commitSha: "abc456" },
        "local-1",
      ),
    ).toBe("dpl_123");
  });

  it("fallback ke commit sha (di-hash pendek, bukan SHA mentah)", () => {
    const v = resolveVersion({ deploymentId: "  ", commitSha: "abc456" }, "local-1");
    expect(v).not.toBe("abc456");
    expect(v).not.toMatch(/^[0-9a-f]{6,40}$/);
    // deterministik & berubah bila SHA berbeda
    expect(v).toBe(resolveVersion({ commitSha: "abc456" }, "x"));
    expect(v).not.toBe(resolveVersion({ commitSha: "abc457" }, "x"));
  });

  it("pakai fallback lokal bila tidak ada env sama sekali", () => {
    expect(resolveVersion({}, "local-1")).toBe("local-1");
    expect(resolveVersion({ deploymentId: "", commitSha: null as never }, "local-1")).toBe(
      "local-1",
    );
  });

  it("string env hanya spasi dianggap kosong", () => {
    expect(resolveVersion({ deploymentId: "   " }, "local-9")).toBe("local-9");
  });
});
