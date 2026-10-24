import { describe, it, expect } from "vitest";
import { homePathForRole } from "./role";

describe("homePathForRole", () => {
  it("CUSTOMER → halaman pesanan", () => {
    expect(homePathForRole("CUSTOMER")).toBe("/pesanan");
  });

  it("semua role staff → dashboard", () => {
    expect(homePathForRole("OWNER")).toBe("/dashboard");
    expect(homePathForRole("SYS_ADMIN")).toBe("/dashboard");
    expect(homePathForRole("ADMIN")).toBe("/dashboard");
    expect(homePathForRole("MECHANIC")).toBe("/dashboard");
  });
});
