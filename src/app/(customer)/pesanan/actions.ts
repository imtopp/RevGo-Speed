"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeMerek, normalizeTipe, modelTidakSesuaiMerek, MEREK_LAINNYA } from "@/lib/vehicle";
import { revalidatePath } from "next/cache";

export type CustomerState = { error?: string; success?: string };

async function requireCustomer() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER") {
    throw new Error("Tidak punya akses.");
  }
  return session;
}

async function generateServiceCode(branchId: string): Promise<string> {
  const prefixSetting = await prisma.systemSetting.findUnique({
    where: { key: "service_code_prefix" },
  });
  const prefix = prefixSetting?.value ?? "SV-";
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  const branchCode = (branch?.name ?? "X").slice(0, 2).toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await prisma.service.count({
    where: { branchId, createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) } },
  });
  return `${prefix}${branchCode}${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function customerBooking(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const session = await requireCustomer();
  const branchId = String(formData.get("branchId") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const catalogId = String(formData.get("catalogId") ?? "").trim();
  const complaint = String(formData.get("complaint") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

  if (!branchId || !vehicleId) {
    return { error: "Cabang dan kendaraan wajib dipilih." };
  }

  // Pastikan kendaraan milik customer ini
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, ownerId: session.user.id },
  });
  if (!vehicle) return { error: "Kendaraan tidak valid." };

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, aktif: true },
  });
  if (!branch) return { error: "Cabang tidak valid." };

  // Cek jam operasional
  const now = new Date();
  const day = now.getDay().toString();
  if (!branch.hariAktif.split(",").includes(day)) {
    // Tetap terima (antrian buka berikutnya) — hanya catat
  }

  const catalog = catalogId
    ? await prisma.serviceCatalog.findFirst({ where: { id: catalogId, aktif: true } })
    : null;

  const code = await generateServiceCode(branchId);
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

  await prisma.service.create({
    data: {
      code,
      branchId,
      source: "APP",
      catalogId: catalog?.id ?? null,
      vehicleId,
      customerId: session.user.id,
      status: "PENDING",
      complaint: complaint || catalog?.nama || null,
      estimate: catalog?.hargaDasar ?? 0,
      scheduledAt,
    },
  });

  revalidatePath("/pesanan");
  return { success: `Booking ${code} terkirim. Menunggu konfirmasi bengkel.` };
}

export async function customerAddVehicle(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const session = await requireCustomer();
  const plateNumber = String(formData.get("plateNumber") ?? "").trim().toUpperCase();
  const brandRaw = String(formData.get("brand") ?? "").trim();
  const brand = normalizeMerek(
    brandRaw === MEREK_LAINNYA ? String(formData.get("brandLain") ?? "") : brandRaw,
  );
  const model = normalizeTipe(String(formData.get("model") ?? ""));
  const yearRaw = String(formData.get("year") ?? "").trim();

  if (!plateNumber || !brand || !model) {
    return { error: "Plat, merek, dan tipe wajib diisi." };
  }
  if (modelTidakSesuaiMerek(brand, model)) {
    return { error: `"${model}" bukan tipe merek ${brand}. Periksa pilihan merek/tipe.` };
  }

  const existing = await prisma.vehicle.findUnique({ where: { plateNumber } });
  if (existing) return { error: "Plat nomor sudah terdaftar." };

  await prisma.vehicle.create({
    data: {
      plateNumber,
      brand,
      model,
      year: yearRaw ? Number(yearRaw) : null,
      ownerId: session.user.id,
    },
  });

  revalidatePath("/pesanan");
  return { success: `Kendaraan ${plateNumber} ditambahkan.` };
}

export async function customerUpdateVehicle(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const session = await requireCustomer();
  const id = String(formData.get("id") ?? "").trim();
  const plateNumber = String(formData.get("plateNumber") ?? "").trim().toUpperCase();
  const brandRaw = String(formData.get("brand") ?? "").trim();
  const brand = normalizeMerek(
    brandRaw === MEREK_LAINNYA ? String(formData.get("brandLain") ?? "") : brandRaw,
  );
  const model = normalizeTipe(String(formData.get("model") ?? ""));

  if (!plateNumber || !brand || !model) {
    return { error: "Plat, merek, dan tipe wajib diisi." };
  }
  if (modelTidakSesuaiMerek(brand, model)) {
    return { error: `"${model}" bukan tipe merek ${brand}. Periksa pilihan merek/tipe.` };
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!vehicle) return { error: "Kendaraan tidak ditemukan." };

  if (plateNumber !== vehicle.plateNumber) {
    const dup = await prisma.vehicle.findUnique({
      where: { plateNumber },
      select: { id: true },
    });
    if (dup) return { error: "Plat nomor sudah terdaftar." };
  }

  await prisma.vehicle.update({
    where: { id },
    data: { plateNumber, brand, model, year: vehicle.year },
  });

  revalidatePath("/pesanan");
  return { success: `Kendaraan ${plateNumber} diperbarui.` };
}

export async function customerDeleteVehicle(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const session = await requireCustomer();
  const id = String(formData.get("id") ?? "").trim();

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!vehicle) return { error: "Kendaraan tidak ditemukan." };

  const jumlahServis = await prisma.service.count({ where: { vehicleId: id } });
  if (jumlahServis > 0) {
    return {
      error: "Kendaraan ini punya riwayat servis — tidak bisa dihapus. Data plat bisa diubah bila salah ketik.",
    };
  }

  await prisma.vehicle.delete({ where: { id } });
  revalidatePath("/pesanan");
  return { success: `Kendaraan ${vehicle.plateNumber} dihapus.` };
}

export async function customerRespondEstimate(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const session = await requireCustomer();
  const id = String(formData.get("id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");

  const service = await prisma.service.findFirst({
    where: { id, customerId: session.user.id },
  });
  if (!service) return { error: "Pesanan tidak ditemukan." };
  if (service.status !== "WAITING_APPROVAL") {
    return { error: "Pesanan tidak dalam tahap menunggu persetujuan." };
  }

  if (decision === "approve") {
    await prisma.service.update({
      where: { id },
      data: { status: "CONFIRMED" },
    });
  } else if (decision === "reject") {
    await prisma.service.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelReason: "Ditolak pelanggan (estimasi disetujui)",
      },
    });
  } else {
    return { error: "Keputusan tidak valid." };
  }

  revalidatePath("/pesanan");
  return {
    success:
      decision === "approve"
        ? "Estimasi disetujui. Sampai jumpa di bengkel!"
        : "Estimasi ditolak. Servis dibatalkan.",
  };
}
