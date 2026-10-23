import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Role } from "@db/prisma/client";

const STAFF_ROLES: Role[] = ["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"];
const OWNER_SYSADMIN: Role[] = ["OWNER", "SYS_ADMIN"];

export async function requireStaff() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CUSTOMER") redirect("/pesanan");
  return session;
}

export async function requireOwnerOrSysAdmin() {
  const session = await requireStaff();
  if (!OWNER_SYSADMIN.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export async function requireStaffRole(roles: Role[]) {
  const session = await requireStaff();
  if (!roles.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isOwnerOrSysAdmin(role: Role): boolean {
  return OWNER_SYSADMIN.includes(role);
}
