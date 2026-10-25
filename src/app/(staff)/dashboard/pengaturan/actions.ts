"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrSysAdmin } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type SettingState = { error?: string; success?: string };
export type BranchState = { error?: string; success?: string };

/** Key pengaturan yang boleh ditulis — jangan biarkan input bebas membuat key sembarangan. */
const ALLOWED_SETTING_KEYS = new Set([
  "app_name",
  "logo_url",
  "service_code_prefix",
  "dp_policy",
  "booking_lead_minutes",
  "booking_horizon_days",
  "booking_buffer_minutes",
]);

/** Rentang valid config booking (sinkron dengan parseBookingConfig). */
const SETTING_NUMERIK: Record<string, { min: number; max: number; label: string }> = {
  booking_lead_minutes: { min: 0, max: 10080, label: "Lead time booking" },
  booking_horizon_days: { min: 1, max: 90, label: "Horizon booking" },
  booking_buffer_minutes: { min: 0, max: 120, label: "Buffer antar jadwal" },
};

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
  if (!ALLOWED_SETTING_KEYS.has(key)) {
    return { error: "Key pengaturan tidak dikenal." };
  }
  // Logo hanya https:// atau path relatif — sejalan dengan sanitasi di branding.ts.
  if (key === "logo_url" && value && !value.startsWith("https://") && !value.startsWith("/")) {
    return { error: "Logo harus URL https:// atau path gambar (diawali /)." };
  }
  const numerik = SETTING_NUMERIK[key];
  if (numerik) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < numerik.min || n > numerik.max) {
      return {
        error: `${numerik.label} harus bilangan bulat ${numerik.min}–${numerik.max}.`,
      };
    }
  }

  const prev = await prisma.systemSetting.findUnique({ where: { key } });

  await prisma.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key },
      update: { value, updatedBy: session.user.id },
      create: { key, value, updatedBy: session.user.id },
    });
    await logAudit(tx, session.user, {
      action: "SETTING_UPDATE",
      entityType: "SystemSetting",
      entityId: key,
      summary: `Pengaturan "${key}" diubah`,
      before: prev ? { value: prev.value } : undefined,
      after: { value },
    });
  });

  revalidatePath("/dashboard/pengaturan");
  return { success: `Pengaturan "${key}" tersimpan.` };
}

function bacaHariAktif(formData: FormData): string | null {
  const hari = formData
    .getAll("hari")
    .map((v) => String(v))
    .filter((v) => /^[0-6]$/.test(v))
    .sort();
  if (hari.length === 0) return null;
  return [...new Set(hari)].join(",");
}

function bacaKuotaParalel(formData: FormData): number {
  const raw = String(formData.get("kuotaParalel") ?? "2").trim();
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) return NaN;
  return n;
}

export async function createBranch(
  _prev: BranchState,
  formData: FormData,
): Promise<BranchState> {
  const session = await requireOwnerOrSysAdminAction();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const jamBuka = String(formData.get("jamBuka") ?? "08:00").trim();
  const jamTutup = String(formData.get("jamTutup") ?? "17:00").trim();
  const hariAktif = bacaHariAktif(formData);
  const kuotaParalel = bacaKuotaParalel(formData);

  if (!name) return { error: "Nama cabang wajib diisi." };
  if (!hariAktif) return { error: "Pilih minimal satu hari operasional." };
  if (Number.isNaN(kuotaParalel)) {
    return { error: "Jumlah pit paralel harus 1–20." };
  }

  const existing = await prisma.branch.findFirst({ where: { name } });
  if (existing) return { error: "Nama cabang sudah dipakai." };

  const branch = await prisma.$transaction(async (tx) => {
    const created = await tx.branch.create({
      data: {
        name,
        address: address || null,
        phone: phone || null,
        jamBuka,
        jamTutup,
        hariAktif,
        kuotaParalel,
      },
    });
    await logAudit(tx, session.user, {
      action: "BRANCH_CREATE",
      entityType: "Branch",
      entityId: created.id,
      branchId: created.id,
      summary: `Cabang "${name}" dibuat`,
      after: { name, jamBuka, jamTutup, hariAktif, kuotaParalel },
    });
    return created;
  });

  revalidatePath("/dashboard/pengaturan");
  return { success: `Cabang "${branch.name}" dibuat.` };
}

export async function updateBranch(
  _prev: BranchState,
  formData: FormData,
): Promise<BranchState> {
  const session = await requireOwnerOrSysAdminAction();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const jamBuka = String(formData.get("jamBuka") ?? "08:00").trim();
  const jamTutup = String(formData.get("jamTutup") ?? "17:00").trim();
  const hariAktif = bacaHariAktif(formData);
  const kuotaParalel = bacaKuotaParalel(formData);
  const aktif = formData.get("aktif") === "on";

  if (!id || !name) return { error: "Data cabang tidak lengkap." };
  if (!hariAktif) return { error: "Pilih minimal satu hari operasional." };
  if (Number.isNaN(kuotaParalel)) {
    return { error: "Jumlah pit paralel harus 1–20." };
  }

  const dup = await prisma.branch.findFirst({
    where: { name, NOT: { id } },
  });
  if (dup) return { error: "Nama cabang sudah dipakai cabang lain." };

  const prev = await prisma.branch.findUnique({ where: { id } });
  if (!prev) return { error: "Cabang tidak ditemukan." };

  await prisma.$transaction(async (tx) => {
    await tx.branch.update({
      where: { id },
      data: {
        name,
        address: address || null,
        phone: phone || null,
        jamBuka,
        jamTutup,
        hariAktif,
        kuotaParalel,
        aktif,
      },
    });
    await logAudit(tx, session.user, {
      action: "BRANCH_UPDATE",
      entityType: "Branch",
      entityId: id,
      branchId: id,
      summary: `Cabang "${name}" diperbarui${prev.aktif !== aktif ? ` · ${aktif ? "diaktifkan" : "dinonaktifkan"}` : ""}`,
      before: {
        name: prev.name,
        aktif: prev.aktif,
        jamBuka: prev.jamBuka,
        jamTutup: prev.jamTutup,
        hariAktif: prev.hariAktif,
        kuotaParalel: prev.kuotaParalel,
      },
      after: { name, aktif, jamBuka, jamTutup, hariAktif, kuotaParalel },
    });
  });

  revalidatePath("/dashboard/pengaturan");
  return { success: `Cabang "${name}" diperbarui.` };
}
