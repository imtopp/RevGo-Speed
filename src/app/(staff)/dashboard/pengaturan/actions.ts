"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isOwnerOrSysAdmin, assertActiveUser } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import {
  LOGO_MAX_DATA_URL_CHARS,
  isSafeLogoValue,
  summarizeLogoValue,
  validateLogoFileMeta,
} from "@/lib/logo";
import { processLogoImage, processQrisImage } from "@/lib/logo-image";
import { normalizeWa } from "@/lib/wa";
import { revalidatePath } from "next/cache";

export type SettingState = { error?: string; success?: string };
export type BranchState = { error?: string; success?: string };

/** Key pengaturan yang boleh ditulis — jangan biarkan input bebas membuat key sembarangan. */
const ALLOWED_SETTING_KEYS = new Set([
  "app_name",
  "logo_url",
  "wa_bengkel",
  "service_code_prefix",
  "dp_policy",
  "booking_lead_minutes",
  "booking_horizon_days",
  "booking_buffer_minutes",
  // DP Booking (§C1)
  "dp_nominal",
  "dp_transfer_enabled",
  "dp_bank",
  "dp_account_number",
  "dp_account_name",
  "dp_qris_enabled",
  "dp_qris_image",
  "dp_cash_enabled",
  "dp_no_show_days",
]);

/** Rentang valid config booking (sinkron dengan parseBookingConfig). */
const SETTING_NUMERIK: Record<string, { min: number; max: number; label: string }> = {
  booking_lead_minutes: { min: 0, max: 10080, label: "Lead time booking" },
  booking_horizon_days: { min: 1, max: 90, label: "Horizon booking" },
  booking_buffer_minutes: { min: 0, max: 120, label: "Buffer antar jadwal" },
  dp_nominal: { min: 0, max: 2_000_000_000, label: "Nominal DP" },
  dp_no_show_days: { min: 0, max: 90, label: "Batas no-show" },
};

/** Key sakelar on/off — hanya boleh "true" atau "false". */
const SETTING_BOOLEAN = new Set([
  "dp_transfer_enabled",
  "dp_qris_enabled",
  "dp_cash_enabled",
]);

async function requireOwnerOrSysAdminAction() {
  const session = await auth();
  if (!session?.user || !isOwnerOrSysAdmin(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  await assertActiveUser(session.user.id);
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
  // Logo: https://, path relatif /, atau data URL image — sejalan branding.ts.
  if (key === "logo_url" && value && !isSafeLogoValue(value)) {
    return { error: "Logo harus URL https://, path gambar (/), atau data URL image yang valid." };
  }
  // Gambar QRIS: aturan sama dengan logo (URL https / path / data URL image).
  if (key === "dp_qris_image" && value && !isSafeLogoValue(value)) {
    return { error: "Gambar QRIS harus URL https://, path gambar (/), atau data URL image yang valid." };
  }
  // Sakelar on/off: hanya "true"/"false" (kosong = nonaktif).
  if (SETTING_BOOLEAN.has(key) && value && value !== "true" && value !== "false") {
    return { error: 'Nilai harus "true" (aktif) atau "false" (nonaktif).' };
  }
  // Kebijakan refund DP: hanya dua nilai yang dikenal kode (fallback TANPA_REFUND).
  if (key === "dp_policy" && value && !["TANPA_REFUND", "REFUND_PENUH"].includes(value)) {
    return { error: 'Kebijakan refund DP harus "TANPA_REFUND" atau "REFUND_PENUH".' };
  }
  // No. WA Bengkel: kosong = bersihkan; terisi = wajib nomor seluler valid,
  // disimpan ternormalisasi (628…) — sejalan getBranding().waNumber.
  let savedValue = value;
  if (key === "wa_bengkel" && value) {
    const wa = normalizeWa(value);
    if (!wa) {
      return { error: "No. WA Bengkel tidak valid. Contoh: 0812xxxxxxxx." };
    }
    savedValue = wa;
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
      update: { value: savedValue, updatedBy: session.user.id },
      create: { key, value: savedValue, updatedBy: session.user.id },
    });
    await logAudit(tx, session.user, {
      action: "SETTING_UPDATE",
      entityType: "SystemSetting",
      entityId: key,
      summary: `Pengaturan "${key}" diubah`,
      before: prev ? { value: prev.value } : undefined,
      after: { value: savedValue },
    });
  });

  revalidatePath("/dashboard/pengaturan");
  return { success: `Pengaturan "${key}" tersimpan.` };
}

/**
 * Simpan seluruh bagian DP Booking sekaligus (satu form): nominal, sakelar
 * transfer + detail rekening, sakelar QRIS, batas no-show, dan kebijakan
 * refund. Hanya key yang nilainya berubah yang di-upsert + audit.
 * Detail rekening hanya ditulis saat transfer aktif — saat nonaktif data
 * lama dipertahankan agar tidak hilang bila sakelar dinyalakan lagi.
 */
export async function updateDpSettings(
  _prev: SettingState,
  formData: FormData,
): Promise<SettingState> {
  const session = await requireOwnerOrSysAdminAction();

  const baca = (k: string) => String(formData.get(k) ?? "").trim();
  const transferAktif = baca("dp_transfer_enabled") === "true";
  const qrisAktif = baca("dp_qris_enabled") === "true";

  const nominal = Number(baca("dp_nominal"));
  if (!Number.isInteger(nominal) || nominal < 0 || nominal > 2_000_000_000) {
    return { error: "Nominal DP harus bilangan bulat 0–2.000.000.000 (0 = nonaktif)." };
  }
  const noShow = Number(baca("dp_no_show_days"));
  if (!Number.isInteger(noShow) || noShow < 0 || noShow > 90) {
    return { error: "Batas No-Show harus bilangan bulat 0–90 hari." };
  }
  const policy = baca("dp_policy");
  if (!["TANPA_REFUND", "REFUND_PENUH"].includes(policy)) {
    return { error: "Kebijakan refund DP tidak valid." };
  }
  const bank = baca("dp_bank");
  const noRek = baca("dp_account_number");
  const atasNama = baca("dp_account_name");
  if (bank.length > 60 || noRek.length > 40 || atasNama.length > 80) {
    return {
      error: "Data rekening terlalu panjang (maks: bank 60, no. rekening 40, atas nama 80).",
    };
  }

  // Gambar QRIS (opsional, satu form dengan Simpan): file baru diproses
  // dulu; tanpa file tapi centang hapus → gambar dikosongkan.
  const file = formData.get("qris");
  const hapusQris = baca("hapus_qris") === "true";
  let qrisBaru: string | undefined;
  if (file instanceof File && file.size > 0) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      return { error: "Format gambar QRIS harus PNG, JPEG, atau WebP." };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { error: "Ukuran file QRIS maksimal 5 MB." };
    }
    const input = Buffer.from(await file.arrayBuffer());
    let output: Buffer;
    try {
      output = await processQrisImage(input, 85);
      if (output.length > 250_000) output = await processQrisImage(input, 62);
    } catch {
      return { error: "File QRIS tidak bisa diproses. Pastikan gambar tidak rusak." };
    }
    const dataUrl = `data:image/webp;base64,${output.toString("base64")}`;
    if (dataUrl.length > LOGO_MAX_DATA_URL_CHARS) {
      return { error: "Hasil QRIS terlalu besar. Coba gambar lebih kecil." };
    }
    qrisBaru = dataUrl;
  } else if (hapusQris) {
    qrisBaru = "";
  }

  const values = new Map<string, string>([
    ["dp_nominal", String(nominal)],
    ["dp_transfer_enabled", transferAktif ? "true" : "false"],
    ["dp_qris_enabled", qrisAktif ? "true" : "false"],
    // Default aktif (key belum ada = tunai jalan) — checkbox menyimpan
    // eksplisit "true"/"false" begitu form disimpan.
    ["dp_cash_enabled", baca("dp_cash_enabled") === "true" ? "true" : "false"],
    ["dp_no_show_days", String(noShow)],
    ["dp_policy", policy],
  ]);
  if (qrisBaru !== undefined) values.set("dp_qris_image", qrisBaru);
  if (transferAktif) {
    values.set("dp_bank", bank);
    values.set("dp_account_number", noRek);
    values.set("dp_account_name", atasNama);
  }

  const keys = [...values.keys()];
  const prevRows = await prisma.systemSetting.findMany({
    where: { key: { in: keys } },
  });
  const prevMap = new Map(prevRows.map((r) => [r.key, r.value]));
  const berubah = keys.filter((k) => prevMap.get(k) !== values.get(k));
  if (berubah.length === 0) {
    return { success: "Tidak ada perubahan pada pengaturan DP." };
  }

  await prisma.$transaction(async (tx) => {
    for (const key of berubah) {
      const value = values.get(key)!;
      await tx.systemSetting.upsert({
        where: { key },
        update: { value, updatedBy: session.user.id },
        create: { key, value, updatedBy: session.user.id },
      });
      // Audit: data URL gambar diringkas, jangan tulis base64 penuh.
      const ringkas = (v: string) =>
        key === "dp_qris_image" ? summarizeLogoValue(v) : v;
      await logAudit(tx, session.user, {
        action: "SETTING_UPDATE",
        entityType: "SystemSetting",
        entityId: key,
        summary: `Pengaturan "${key}" diubah`,
        before: prevMap.has(key) ? { value: ringkas(prevMap.get(key)!) } : undefined,
        after: { value: ringkas(value) },
      });
    }
  }, { maxWait: 10_000, timeout: 30_000 });

  revalidatePath("/dashboard/pengaturan");
  return {
    success: `Pengaturan DP Booking tersimpan (${berubah.length} kolom berubah).`,
  };
}

/**
 * Upload logo aplikasi: file → auto-orient, rapikan margin tepi, resize maks
 * 512px, konversi WebP, lalu simpan sebagai data URL di SystemSetting.logo_url
 * (ikut backup otomatis).
 */
export async function uploadLogo(
  _prev: SettingState,
  formData: FormData,
): Promise<SettingState> {
  const session = await requireOwnerOrSysAdminAction();

  const file = formData.get("logo");
  if (!(file instanceof File)) return { error: "Pilih file logo dulu." };
  const metaError = validateLogoFileMeta({ type: file.type, size: file.size });
  if (metaError) return { error: metaError };

  const input = Buffer.from(await file.arrayBuffer());

  const proses = (quality: number): Promise<Buffer> =>
    processLogoImage(input, quality);

  let output: Buffer;
  try {
    output = await proses(82);
    if (output.length > 250_000) output = await proses(62);
  } catch {
    return { error: "File logo tidak bisa diproses. Pastikan gambar tidak rusak." };
  }

  const dataUrl = `data:image/webp;base64,${output.toString("base64")}`;
  if (dataUrl.length > LOGO_MAX_DATA_URL_CHARS) {
    return { error: "Hasil proses logo terlalu besar. Coba gambar sederhana." };
  }

  const prev = await prisma.systemSetting.findUnique({ where: { key: "logo_url" } });

  await prisma.$transaction(async (tx) => {
    await tx.systemSetting.upsert({
      where: { key: "logo_url" },
      update: { value: dataUrl, updatedBy: session.user.id },
      create: { key: "logo_url", value: dataUrl, updatedBy: session.user.id },
    });
    await logAudit(tx, session.user, {
      action: "SETTING_UPDATE",
      entityType: "SystemSetting",
      entityId: "logo_url",
      summary: `Logo aplikasi diunggah (diproses otomatis: margin dirapikan, maks 512px WebP)`,
      before: prev ? { value: summarizeLogoValue(prev.value) } : undefined,
      after: { value: summarizeLogoValue(dataUrl) },
    });
  });

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/pengaturan");
  return { success: "Logo berhasil diproses & disimpan (margin dirapikan, maks 512px, WebP)." };
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
