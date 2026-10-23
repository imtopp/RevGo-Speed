"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { ServiceStatus } from "@db/prisma/client";

export type ServisState = { error?: string; success?: string };

async function requireStaffRole(roles: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Belum login.");
  if (!roles.includes(session.user.role)) throw new Error("Tidak punya akses.");
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

// ─── Booking / Pembuatan Servis ───────────────────────────────────────

export async function createBooking(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const branchId = String(formData.get("branchId") ?? "").trim();
  const plateNumber = String(formData.get("plateNumber") ?? "").trim().toUpperCase();
  const catalogId = String(formData.get("catalogId") ?? "").trim();
  const complaint = String(formData.get("complaint") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

  // Data kendaraan & customer baru (jika belum terdaftar)
  const brand = String(formData.get("brand") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim().toLowerCase();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();

  if (!branchId || !plateNumber) {
    return { error: "Cabang dan plat nomor wajib diisi." };
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, aktif: true },
  });
  if (!branch) return { error: "Cabang tidak valid." };

  // Cari kendaraan by plat
  let vehicle = await prisma.vehicle.findUnique({
    where: { plateNumber },
    include: { owner: true },
  });

  if (!vehicle) {
    // Kendaraan baru → butuh data customer + merek/tipe
    if (!brand || !model || !customerName || !customerEmail) {
      return {
        error:
          "Kendaraan belum terdaftar. Isi juga nama, email, merek, dan tipe customer untuk mendaftarkan.",
      };
    }
    let customer = await prisma.user.findUnique({ where: { email: customerEmail } });
    if (!customer) {
      const { hashPassword } = await import("@/lib/password");
      customer = await prisma.user.create({
        data: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone || null,
          passwordHash: hashPassword("bengkel123"),
          role: "CUSTOMER",
        },
      });
    }
    vehicle = await prisma.vehicle.create({
      data: { plateNumber, brand, model, ownerId: customer.id },
      include: { owner: true },
    });
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
      source: "ADMIN",
      catalogId: catalog?.id ?? null,
      vehicleId: vehicle.id,
      customerId: vehicle.ownerId,
      status: "PENDING",
      complaint: complaint || catalog?.nama || null,
      estimate: catalog?.hargaDasar ?? 0,
      scheduledAt,
    },
  });

  revalidatePath("/dashboard/servis");
  return { success: `Booking ${code} dibuat untuk ${plateNumber}.` };
}

// ─── Transisi Status ──────────────────────────────────────────────────

async function getServiceOrThrow(id: string) {
  const service = await prisma.service.findUnique({
    where: { id },
    include: { vehicle: { include: { owner: true } }, mechanic: true, branch: true },
  });
  if (!service) throw new Error("Servis tidak ditemukan.");
  return service;
}

async function transition(
  id: string,
  from: ServiceStatus[],
  to: ServiceStatus,
  extra: Record<string, unknown> = {},
) {
  const service = await getServiceOrThrow(id);
  if (!from.includes(service.status)) {
    throw new Error(
      `Status saat ini "${service.status}" tidak bisa diubah ke "${to}".`,
    );
  }
  return prisma.service.update({
    where: { id },
    data: { status: to, ...extra },
  });
}

export async function submitEstimate(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const estimate = Number(formData.get("estimate") ?? 0);
  const laborCost = Number(formData.get("laborCost") ?? 0);
  const mechanicId = String(formData.get("mechanicId") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

  if (estimate < 0 || laborCost < 0) return { error: "Biaya tidak valid." };

  await transition(id, ["PENDING"], "WAITING_APPROVAL", {
    estimate,
    laborCost,
    mechanicId: mechanicId || null,
    scheduledAt: scheduledAtRaw ? new Date(scheduledAtRaw) : undefined,
  });

  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "Estimasi dikirim — menunggu persetujuan pelanggan." };
}

export async function approveInPerson(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  await transition(id, ["PENDING", "WAITING_APPROVAL"], "CONFIRMED");
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "Disetujui di tempat → Dikonfirmasi." };
}

export async function checkInUnit(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"]);
  const id = String(formData.get("id") ?? "").trim();
  const odometer = String(formData.get("odometer") ?? "").trim();
  const fuelLevel = String(formData.get("fuelLevel") ?? "").trim();
  const existingCondition = String(formData.get("existingCondition") ?? "").trim();
  const agreedComplaint = String(formData.get("agreedComplaint") ?? "").trim();

  if (!odometer) return { error: "Odometer (km) wajib diisi." };

  const note = [
    odometer ? `Km: ${odometer}` : null,
    fuelLevel ? `BBM: ${fuelLevel}` : null,
    existingCondition ? `Kondisi awal: ${existingCondition}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  await transition(id, ["CONFIRMED"], "CHECKED_IN", {
    checkedInAt: new Date(),
    complaint: agreedComplaint || undefined,
    diagnosis: note,
  });

  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "Unit diterima (precheck terisi). Siap dikerjakan." };
}

export async function startWork(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"]);
  const id = String(formData.get("id") ?? "").trim();
  const service = await getServiceOrThrow(id);

  // Mekanik hanya boleh mulai tugasnya sendiri; admin boleh mana pun
  if (
    session.user.role === "MECHANIC" &&
    service.mechanicId !== session.user.id
  ) {
    return { error: "Ini bukan tugas Anda." };
  }

  await transition(id, ["CHECKED_IN"], "IN_PROGRESS", { startedAt: new Date() });
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/tugas`);
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "Pengerjaan dimulai." };
}

export async function markWaitingParts(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"]);
  const id = String(formData.get("id") ?? "").trim();
  await transition(id, ["IN_PROGRESS"], "WAITING_PARTS");
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/tugas`);
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "Ditandai menunggu part." };
}

export async function resumeWork(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"]);
  const id = String(formData.get("id") ?? "").trim();
  await transition(id, ["WAITING_PARTS"], "IN_PROGRESS");
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/tugas`);
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "Lanjut dikerjakan." };
}

export async function saveDiagnosis(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"]);
  const id = String(formData.get("id") ?? "").trim();
  const diagnosis = String(formData.get("diagnosis") ?? "").trim();
  await prisma.service.update({ where: { id }, data: { diagnosis } });
  revalidatePath(`/dashboard/servis/${id}`);
  revalidatePath("/dashboard/tugas");
  return { success: "Diagnosis tersimpan." };
}

export async function mechanicFinish(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"]);
  const id = String(formData.get("id") ?? "").trim();
  const service = await getServiceOrThrow(id);
  if (
    session.user.role === "MECHANIC" &&
    service.mechanicId !== session.user.id
  ) {
    return { error: "Ini bukan tugas Anda." };
  }
  await transition(id, ["IN_PROGRESS"], "IN_PROGRESS", {
    finishedAt: new Date(),
  });
  revalidatePath(`/dashboard/servis/${id}`);
  revalidatePath("/dashboard/tugas");
  revalidatePath("/dashboard/servis");
  return { success: "Ditandai selesai dikerjakan — menunggu QC admin." };
}

export async function qcDone(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  await transition(id, ["IN_PROGRESS", "WAITING_PARTS"], "DONE", {
    finishedAt: new Date(),
  });
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "QC lolos → servis SELESAI. Siap diambil & bayar." };
}

export async function cancelService(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Alasan pembatalan wajib diisi." };
  await transition(
    id,
    ["PENDING", "WAITING_APPROVAL", "CONFIRMED", "CHECKED_IN"],
    "CANCELLED",
    { cancelReason: reason },
  );
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  revalidatePath("/pesanan");
  return { success: "Servis dibatalkan." };
}

// ─── Part Terpakai ────────────────────────────────────────────────────

export async function addServicePart(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN", "MECHANIC"]);
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const partId = String(formData.get("partId") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!serviceId || !partId || quantity <= 0) {
    return { error: "Part dan jumlah tidak valid." };
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { branch: true },
  });
  if (!service) return { error: "Servis tidak ditemukan." };

  const part = await prisma.part.findFirst({
    where: { id: partId, branchId: service.branchId },
  });
  if (!part) return { error: "Part tidak tersedia di cabang ini." };
  if (part.quantity < quantity) {
    return { error: `Stok ${part.name} kurang (tersisa ${part.quantity}).` };
  }

  // Transaksi atomik: tambah ServicePart + kurangi stok + catat movement
  await prisma.$transaction([
    prisma.servicePart.create({
      data: {
        serviceId,
        partId,
        quantity,
        price: part.sellPrice,
        cost: part.buyPrice,
      },
    }),
    prisma.part.update({
      where: { id: partId },
      data: { quantity: { decrement: quantity } },
    }),
    prisma.stockMovement.create({
      data: {
        partId,
        type: "OUT",
        quantity,
        note: `Terpakai di servis ${service.code}`,
      },
    }),
  ]);

  revalidatePath(`/dashboard/servis/${serviceId}`);
  revalidatePath("/dashboard/tugas");
  return { success: `${quantity} ${part.unit} ${part.name} dicatat & stok berkurang.` };
}

export async function removeServicePart(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "SYS_ADMIN", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const sp = await prisma.servicePart.findUnique({
    where: { id },
    include: { part: true, service: true },
  });
  if (!sp) return { error: "Item tidak ditemukan." };
  if (sp.service.status === "DONE" || sp.service.status === "CANCELLED") {
    return { error: "Tidak bisa ubah part servis yang sudah selesai/dibatalkan." };
  }

  await prisma.$transaction([
    prisma.servicePart.delete({ where: { id } }),
    prisma.part.update({
      where: { id: sp.partId },
      data: { quantity: { increment: sp.quantity } },
    }),
    prisma.stockMovement.create({
      data: {
        partId: sp.partId,
        type: "IN",
        quantity: sp.quantity,
        note: `Dikembalikan dari servis ${sp.service.code}`,
      },
    }),
  ]);

  revalidatePath(`/dashboard/servis/${sp.serviceId}`);
  return { success: "Item dikembalikan ke stok." };
}
