"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrSysAdmin } from "@/lib/guard";
import { hashPassword } from "@/lib/password";
import { revalidatePath } from "next/cache";

export type StaffState = { error?: string; success?: string };

async function requireOwnerOrSysAdminAction() {
  const session = await auth();
  if (!session?.user || !isOwnerOrSysAdmin(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  return session;
}

const STAFF_ROLES = ["SYS_ADMIN", "ADMIN", "MECHANIC"] as const;

export async function createStaff(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  await requireOwnerOrSysAdminAction();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "ADMIN");
  const branchId = String(formData.get("branchId") ?? "").trim();

  if (!name || !email) return { error: "Nama dan email wajib diisi." };
  if (password.length < 6) return { error: "Password minimal 6 karakter." };
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return { error: "Role staff tidak valid." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Email sudah terpakai." };

  await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash: hashPassword(password),
      role: role as (typeof STAFF_ROLES)[number],
      branchId: branchId || null,
    },
  });

  revalidatePath("/dashboard/akun");
  return { success: `Akun ${name} (${role}) dibuat.` };
}

export async function resetPassword(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  await requireOwnerOrSysAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!id) return { error: "User tidak ditemukan." };
  if (password.length < 6) return { error: "Password minimal 6 karakter." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "User tidak ditemukan." };
  if (user.role === "OWNER") return { error: "Password owner tidak bisa direset dari sini." };

  await prisma.user.update({
    where: { id },
    data: { passwordHash: hashPassword(password) },
  });

  revalidatePath("/dashboard/akun");
  return { success: `Password ${user.name} direset.` };
}

export async function toggleActive(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const session = await requireOwnerOrSysAdminAction();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) return { error: "User tidak ditemukan." };
  if (id === session.user.id) return { error: "Tidak bisa menonaktifkan akun sendiri." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "User tidak ditemukan." };
  if (user.role === "OWNER") return { error: "Akun owner tidak bisa dinonaktifkan." };

  await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/dashboard/akun");
  return { success: `${user.name} ${user.isActive ? "dinonaktifkan" : "diaktifkan"}.` };
}

export async function assignBranch(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  await requireOwnerOrSysAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();

  if (!id) return { error: "User tidak ditemukan." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "User tidak ditemukan." };
  if (user.role === "OWNER" || user.role === "SYS_ADMIN") {
    return { error: "Owner & SysAdmin lintas cabang, tidak di-assign." };
  }

  await prisma.user.update({
    where: { id },
    data: { branchId: branchId || null },
  });

  revalidatePath("/dashboard/akun");
  return { success: `Cabang ${user.name} diperbarui.` };
}
