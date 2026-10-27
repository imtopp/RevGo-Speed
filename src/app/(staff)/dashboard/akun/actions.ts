"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrSysAdmin, assertActiveUser } from "@/lib/guard";
import { validasiAssignCabang, validasiCabangBaru } from "@/lib/staff-branch";
import { hashPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type StaffState = { error?: string; success?: string };

async function requireOwnerOrSysAdminAction() {
  const session = await auth();
  if (!session?.user || !isOwnerOrSysAdmin(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  await assertActiveUser(session.user.id);
  return session;
}

const STAFF_ROLES = ["SYS_ADMIN", "ADMIN", "MECHANIC"] as const;

export async function createStaff(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const session = await requireOwnerOrSysAdminAction();
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
  if (role === "SYS_ADMIN" && session.user.role !== "OWNER") {
    return { error: "Hanya Owner yang bisa membuat akun SysAdmin." };
  }
  const errCabang = validasiCabangBaru(role, branchId);
  if (errCabang) return { error: errCabang };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Email sudah terpakai." };

  await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash: hashPassword(password),
        // Password dipilih orang lain → wajib ganti saat login pertama.
        mustChangePassword: true,
        role: role as (typeof STAFF_ROLES)[number],
        branchId: branchId || null,
      },
    });
    await logAudit(tx, session.user, {
      action: "ACCOUNT_CREATE",
      entityType: "User",
      entityId: created.id,
      branchId: branchId || null,
      summary: `Akun ${name} (${email}) sebagai ${role} dibuat`,
      after: { name, email, role, branchId: branchId || null },
    });
  });

  revalidatePath("/dashboard/akun");
  return { success: `Akun ${name} (${role}) dibuat.` };
}

export async function resetPassword(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const session = await requireOwnerOrSysAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!id) return { error: "User tidak ditemukan." };
  if (password.length < 6) return { error: "Password minimal 6 karakter." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "User tidak ditemukan." };
  if (user.role === "OWNER") return { error: "Password owner tidak bisa direset dari sini." };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash: hashPassword(password), mustChangePassword: true },
    });
    await logAudit(tx, session.user, {
      action: "ACCOUNT_RESET_PASSWORD",
      entityType: "User",
      entityId: id,
      branchId: user.branchId,
      summary: `Password ${user.name} (${user.email ?? "tanpa email"}) direset`,
    });
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

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });
    await logAudit(tx, session.user, {
      action: "ACCOUNT_TOGGLE",
      entityType: "User",
      entityId: id,
      branchId: user.branchId,
      summary: `${user.name} (${user.email ?? "tanpa email"}) ${user.isActive ? "dinonaktifkan" : "diaktifkan"}`,
      before: { isActive: user.isActive },
      after: { isActive: !user.isActive },
    });
  });

  revalidatePath("/dashboard/akun");
  return { success: `${user.name} ${user.isActive ? "dinonaktifkan" : "diaktifkan"}.` };
}

export async function assignBranch(
  _prev: StaffState,
  formData: FormData,
): Promise<StaffState> {
  const session = await requireOwnerOrSysAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim();

  if (!id) return { error: "User tidak ditemukan." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { error: "User tidak ditemukan." };
  const errCabang = validasiAssignCabang(user.role, branchId);
  if (errCabang) return { error: errCabang };

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { branchId: branchId || null },
    });
    await logAudit(tx, session.user, {
      action: "ACCOUNT_ASSIGN",
      entityType: "User",
      entityId: id,
      branchId: branchId || null,
      summary: `Cabang ${user.name} diubah`,
      before: { branchId: user.branchId },
      after: { branchId: branchId || null },
    });
  });

  revalidatePath("/dashboard/akun");
  return { success: `Cabang ${user.name} diperbarui.` };
}
