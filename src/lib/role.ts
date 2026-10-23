import type { Role } from "@db/prisma/client";

export function homePathForRole(role: Role): string {
  return role === "CUSTOMER" ? "/pesanan" : "/dashboard";
}
