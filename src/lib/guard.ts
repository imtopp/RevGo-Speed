import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { Role } from "@db/prisma/client";

const STAFF_ROLES: Role[] = ["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"];
const OWNER_SYSADMIN: Role[] = ["OWNER", "SYS_ADMIN"];

export async function requireStaff() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CUSTOMER") redirect("/pesanan");
  // Revalidasi akun tiap request: JWT bisa hidup 30 hari — akun yang
  // dinonaktifkan/diharuskan keluar harus langsung terblokir.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!user || !user.isActive) redirect("/login?error=session");
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

/** Return branchId staff (null = lintas cabang, untuk owner/sysadmin).
 *  Admin/mekanik selalu punya branchId. */
export async function getStaffBranchId(): Promise<string | null> {
  const session = await requireStaff();
  if (session.user.role === "OWNER" || session.user.role === "SYS_ADMIN") {
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { branchId: true },
  });
  // Fail-closed: admin/mekanik tanpa cabang = data akun corrupt — tanpa
  // filter cabang berarti semua cabang terbuka, jadi paksa keluar.
  if (!user?.branchId) redirect("/login?error=session");
  return user.branchId;
}

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isOwnerOrSysAdmin(role: Role): boolean {
  return OWNER_SYSADMIN.includes(role);
}

/**
 * Lempar bila akun tidak ada/nonaktif — untuk server action & route yang
 * memanggil `auth()` sendiri (JWT bisa hidup 30 hari; redirect guard tidak
 * berlaku di sana). Pakai ini setelah cek role berbasis session.
 */
export async function assertActiveUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  if (!user?.isActive) throw new Error("Akun tidak aktif.");
}
