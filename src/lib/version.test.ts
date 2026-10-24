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

  it("fallback ke commit sha bila deployment id kosong", () => {
    expect(
      resolveVersion({ deploymentId: "  ", commitSha: "abc456" }, "local-1"),
    ).toBe("abc456");
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
