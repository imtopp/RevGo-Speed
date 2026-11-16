"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { normalizeMerek, normalizeTipe, modelTidakSesuaiMerek, normalizePlate, MEREK_LAINNYA, merekListrikDilarang } from "@/lib/vehicle";
import { cekSlotTersedia, kunciSlot } from "@/lib/booking";
import { DURASI_DEFAULT_MENIT, parseJadwal, pesanDitolak } from "@/lib/availability";
import { normalizeWa } from "@/lib/wa";
import { formatTanggalWIB } from "@/lib/service-status";
import { getDpConfig, dpAktif, type DpConfig } from "@/lib/dp";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { notifyBookingBaru } from "@/lib/push";
import type { Prisma } from "@db/prisma/client";

export type CustomerState = {
  error?: string;
  success?: string;
  code?: string;
  /** service.id — dipakai form klaim DP di panel sukses booking. */
  id?: string;
  rincian?: {
    kendaraan: string;
    layanan: string | null;
    jadwal: string | null;
  };
  /** Info DP — hanya saat booking lahir dengan status WAITING_DP. */
  dp?: DpConfig;
};

async function requireCustomer() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER") {
    throw new Error("Tidak punya akses.");
  }
  return session;
}

async function generateServiceCode(
  tx: Prisma.TransactionClient,
  branchId: string,
): Promise<string> {
  // Advisory lock penomoran — serialisasi count+1 antar booking paralel di
  // cabang yang sama, cegah bentrok unique Service.code (klik booking
  // barengan dari dua device bisa menghasilkan kode sama).
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`service-code:${branchId}`}))`;
  const prefixSetting = await tx.systemSetting.findUnique({
    where: { key: "service_code_prefix" },
  });
  const prefix = prefixSetting?.value ?? "SV-";
  const branch = await tx.branch.findUnique({ where: { id: branchId } });
  const branchCode = (branch?.name ?? "X").slice(0, 2).toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await tx.service.count({
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

  // No. WA wajib sudah ada di akun — booking tanpa nomor ditolak dan
  // diarahkan ke halaman Profil (tidak ada input nomor di form ini).
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phone: true },
  });
  if (!me?.phone) {
    return {
      error:
        "No. WhatsApp belum terdaftar di akunmu — lengkapi dulu di halaman Profil.",
    };
  }
  // Snapshot booking: selalu format kanonik 62… (akun lama masih 08…).
  const phoneSnapshot = normalizeWa(me.phone) ?? me.phone;

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

  const catalog = catalogId
    ? await prisma.serviceCatalog.findFirst({ where: { id: catalogId, aktif: true } })
    : null;

  if (!scheduledAtRaw) {
    return { error: "Jadwal kedatangan wajib dipilih." };
  }
  const epoch = parseJadwal(scheduledAtRaw);
  if (epoch === null) {
    return { error: "Jadwal kedatangan tidak valid." };
  }
  const durasiMenit = catalog?.estimasiMenit ?? DURASI_DEFAULT_MENIT;

  // Alur DP: semua booking (APP) mulai WAITING_DP bila DP aktif;
  // dp_nominal = 0 → DP nonaktif, langsung PENDING (§C3).
  const dpCfg = await getDpConfig();
  const menungguDp = dpAktif(dpCfg);

  const hasil = await prisma.$transaction(async (tx) => {
    // Kode dihitung di DALAM transaksi setelah advisory lock (anti race
    // count+1 antar booking paralel → bentrok unique code).
    const code = await generateServiceCode(tx, branchId);
    await kunciSlot(tx, branchId, epoch);
    const cek = await cekSlotTersedia({
      branchId,
      epoch,
      durasiMenit,
      pakaiLeadTime: true,
      db: tx,
    });
    if (!cek.ok) return cek;
    const created = await tx.service.create({
      data: {
        code,
        branchId,
        source: "APP",
        catalogId: catalog?.id ?? null,
        vehicleId,
        customerId: session.user.id,
        customerName: session.user.name,
        customerPhone: phoneSnapshot,
        status: menungguDp ? "WAITING_DP" : "PENDING",
        complaint: complaint || catalog?.nama || null,
        estimate: catalog?.hargaDasar ?? 0,
        scheduledAt: new Date(epoch),
        estimasiMenit: durasiMenit,
      },
    });
    return { ok: true as const, id: created.id, code: created.code };
  });
  if (!hasil.ok) {
    return { error: pesanDitolak(hasil) };
  }

  after(() => notifyBookingBaru(hasil.id));
  revalidatePath("/pesanan");
  return {
    success: menungguDp
      ? `Booking ${hasil.code} terkirim — bayar DP dulu agar jadwal dikunci.`
      : `Booking ${hasil.code} terkirim. Menunggu konfirmasi bengkel.`,
    code: hasil.code,
    id: hasil.id,
    ...(menungguDp ? { dp: dpCfg } : {}),
    rincian: {
      kendaraan: `${vehicle.plateNumber} · ${vehicle.brand} ${vehicle.model}`,
      layanan: complaint || catalog?.nama || null,
      jadwal: formatTanggalWIB(new Date(epoch)),
    },
  };
}

export async function customerAddVehicle(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const session = await requireCustomer();
  const plateRaw = String(formData.get("plateNumber") ?? "").trim();
  const brandRaw = String(formData.get("brand") ?? "").trim();
  const brand = normalizeMerek(
    brandRaw === MEREK_LAINNYA ? String(formData.get("brandLain") ?? "") : brandRaw,
  );
  const model = normalizeTipe(String(formData.get("model") ?? ""));
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
    return { error: "Tahun kendaraan tidak valid." };
  }

  if (!plateRaw || !brand || !model) {
    return { error: "Plat, merek, dan tipe wajib diisi." };
  }
  const plateNumber = normalizePlate(plateRaw);
  if (!plateNumber) {
      return { error: "Format nomor plat tidak valid. Contoh: B 1234 XY." };
  }
  if (modelTidakSesuaiMerek(brand, model)) {
    return { error: `"${model}" bukan tipe merek ${brand}. Periksa pilihan merek/tipe.` };
  }
  if (merekListrikDilarang(brand)) {
    return { error: "Merek motor listrik tidak didukung di bengkel ini." };
  }

  const existing = await prisma.vehicle.findUnique({ where: { plateNumber } });
  if (existing) {
    if (existing.ownerId === session.user.id) {
      return { error: "Nomor plat sudah terdaftar di kendaraan Anda." };
    }
    if (existing.ownerId !== null) {
      // Plat milik orang lain — pesan generik, cegah enumeration plat lintas user.
      return { error: "Nomor plat tidak bisa digunakan." };
    }
    // Klaim kendaraan walk-in: pelanggan lama mendaftar lalu mengadopsi
    // kendaraan yang pernah dicatat tanpa akun. Sinkronkan nama & nomor
    // ke data akun (satu nomor — nomor akun diprioritaskan).
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, phone: true },
    });
    await prisma.vehicle.update({
      where: { id: existing.id },
      data: {
        ownerId: session.user.id,
        ownerName: me?.name ?? existing.ownerName,
        ownerPhone: me?.phone ? (normalizeWa(me.phone) ?? me.phone) : existing.ownerPhone,
      },
    });
    revalidatePath("/pesanan");
    return {
      success: `Kendaraan ${plateNumber} (sebelumnya walk-in) ditambahkan ke akun Anda.`,
    };
  }

  await prisma.vehicle.create({
    data: {
      plateNumber,
      brand,
      model,
      year,
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
  const plateRaw = String(formData.get("plateNumber") ?? "").trim();
  const brandRaw = String(formData.get("brand") ?? "").trim();
  const brand = normalizeMerek(
    brandRaw === MEREK_LAINNYA ? String(formData.get("brandLain") ?? "") : brandRaw,
  );
  const model = normalizeTipe(String(formData.get("model") ?? ""));

  if (!plateRaw || !brand || !model) {
    return { error: "Plat, merek, dan tipe wajib diisi." };
  }
  const plateNumber = normalizePlate(plateRaw);
  if (!plateNumber) {
      return { error: "Format nomor plat tidak valid. Contoh: B 1234 XY." };
  }
  if (modelTidakSesuaiMerek(brand, model)) {
    return { error: `"${model}" bukan tipe merek ${brand}. Periksa pilihan merek/tipe.` };
  }
  if (merekListrikDilarang(brand)) {
    return { error: "Merek motor listrik tidak didukung di bengkel ini." };
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!vehicle) return { error: "Kendaraan tidak ditemukan." };

  if (plateNumber !== vehicle.plateNumber) {
    const dup = await prisma.vehicle.findUnique({
      where: { plateNumber },
      select: { id: true, ownerId: true },
    });
    if (dup) {
      return {
        error:
          dup.ownerId === session.user.id
            ? "Nomor plat sudah terdaftar di kendaraan Anda."
            : "Nomor plat tidak bisa digunakan.",
      };
    }
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

/**
 * Klaim "Sudah Bayar DP" — set `dpClaimedAt` (idempoten) supaya staf melihat
 * tanda klaim di papan servis; pengiriman pesan WA konfirmasi dilakukan
 * customer lewat tombol yang sama (buka waLink saat ditekan).
 */
export async function customerClaimDp(
  _prev: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const session = await requireCustomer();
  const id = String(formData.get("id") ?? "").trim();

  const service = await prisma.service.findFirst({
    // Syarat ganda sama dengan query Pesanan: milik akun ini, ATAU booking
    // walk-in pada kendaraan yang sudah diadopsi.
    where: {
      id,
      OR: [
        { customerId: session.user.id },
        { vehicle: { ownerId: session.user.id } },
      ],
    },
    select: { id: true, status: true, dpClaimedAt: true },
  });
  if (!service) return { error: "Pesanan tidak ditemukan." };
  if (service.status !== "WAITING_DP") {
    return { error: "Pesanan tidak dalam tahap Menunggu DP." };
  }

  if (!service.dpClaimedAt) {
    await prisma.service.update({
      where: { id: service.id },
      data: { dpClaimedAt: new Date() },
    });
    revalidatePath("/pesanan");
  }
  return {
    success:
      "Terima kasih — konfirmasi pembayaran sudah ditandai. Menunggu verifikasi bengkel.",
  };
}
