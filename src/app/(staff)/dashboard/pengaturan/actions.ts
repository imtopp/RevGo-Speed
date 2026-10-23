"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrSysAdmin } from "@/lib/guard";
import { revalidatePath } from "next/cache";

export type SettingState = { error?: string; success?: string };
export type BranchState = { error?: string; success?: string };

async function requireOwnerOrSysAdminAction() {
  const session = await auth();
  if (!session?.user || !isOwnerOrSysAdmin(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  return session;
}

export async function updateSetting(
  _prev: SettingState,
  formData: FormData,
): Promise<SettingState> {
  const session = await requireOwnerOrSysAdminAction();
  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();

  if (!key) return { error: "Key wajib diisi." };

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value, updatedBy: session.user.id },
    create: { key, value, updatedBy: session.user.id },
  });

  revalidatePath("/dashboard/pengaturan");
  return { success: `Pengaturan "${key}" tersimpan.` };
}

export async function createBranch(
  _prev: BranchState,
  formData: FormData,
): Promise<BranchState> {
  await requireOwnerOrSysAdminAction();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const jamBuka = String(formData.get("jamBuka") ?? "08:00").trim();
  const jamTutup = String(formData.get("jamTutup") ?? "17:00").trim();
  const hariAktif = String(formData.get("hariAktif") ?? "1,2,3,4,5,6").trim();

  if (!name) return { error: "Nama cabang wajib diisi." };

  const existing = await prisma.branch.findFirst({ where: { name } });
  if (existing) return { error: "Nama cabang sudah dipakai." };

  await prisma.branch.create({
    data: {
      name,
      address: address || null,
      phone: phone || null,
      jamBuka,
      jamTutup,
      hariAktif,
    },
  });

  revalidatePath("/dashboard/pengaturan");
  return { success: `Cabang "${name}" dibuat.` };
}

export async function updateBranch(
  _prev: BranchState,
  formData: FormData,
): Promise<BranchState> {
  await requireOwnerOrSysAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const jamBuka = String(formData.get("jamBuka") ?? "08:00").trim();
  const jamTutup = String(formData.get("jamTutup") ?? "17:00").trim();
  const hariAktif = String(formData.get("hariAktif") ?? "1,2,3,4,5,6").trim();
  const aktif = formData.get("aktif") === "on";

  if (!id || !name) return { error: "Data cabang tidak lengkap." };

  const dup = await prisma.branch.findFirst({
    where: { name, NOT: { id } },
  });
  if (dup) return { error: "Nama cabang sudah dipakai cabang lain." };

  await prisma.branch.update({
    where: { id },
    data: { name, address: address || null, phone: phone || null, jamBuka, jamTutup, hariAktif, aktif },
  });

  revalidatePath("/dashboard/pengaturan");
  return { success: `Cabang "${name}" diperbarui.` };
}
