"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStaffBranchId } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import { normalizeMerek, normalizeTipe, modelTidakSesuaiMerek, normalizePlate, MEREK_LAINNYA, merekListrikDilarang } from "@/lib/vehicle";
import { allocateFifo } from "@/lib/inventory";
import { cekSlotTersedia, getBookingConfig, getJendelaAktif, kunciSlot, mekanikSibuk } from "@/lib/booking";
import {
  DURASI_DEFAULT_MENIT,
  DURASI_MAX_MENIT,
  DURASI_MIN_MENIT,
  cekKapasitas,
  parseJadwal,
  pesanDitolak,
} from "@/lib/availability";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { formatRupiah, formatTanggalWIB, totalTagihan } from "@/lib/service-status";
import {
  notifyBatal,
  notifyBookingBaru,
  notifyDpDiterima,
  notifyEstimasi,
  notifyJadwalDiubah,
  notifySelesai,
  notifyStokMenipis,
} from "@/lib/push";
import { getDpConfig, dpAktif } from "@/lib/dp";
import { normalizeWa, formatWaLocal } from "@/lib/wa";
import type { Prisma, ServiceStatus, PaymentMethod } from "@db/prisma/client";

export type ServisState = { error?: string; success?: string };

async function requireStaffRole(roles: string[]) {
  const session = await auth();
  if (!session?.user) throw new Error("Belum login.");
  if (!roles.includes(session.user.role)) throw new Error("Tidak punya akses.");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!user?.isActive) throw new Error("Akun tidak aktif.");
  return session;
}

/** ADMIN/MECHANIC terikat cabang: kembalikan pesan error bila beda cabang, null bila boleh. */
async function cekCabangServis(branchId: string): Promise<string | null> {
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && branchId !== branchIdStaff) {
    return "Servis bukan di cabang Anda.";
  }
  return null;
}

async function generateServiceCode(
  tx: Prisma.TransactionClient,
  branchId: string,
): Promise<string> {
  // Advisory lock penomoran — serialisasi count+1 antar booking paralel di
  // cabang yang sama. Tanpa ini dua booking bisa menghasilkan kode sama →
  // bentrok unique Service.code (transaksi gagal, pesan error kasar).
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

// ─── Booking / Pembuatan Servis ───────────────────────────────────────

export async function createBooking(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "ADMIN"]);
  const branchIdStaff = await getStaffBranchId();
  const branchId = branchIdStaff || String(formData.get("branchId") ?? "").trim();
  const plateRaw = String(formData.get("plateNumber") ?? "").trim();
  const catalogId = String(formData.get("catalogId") ?? "").trim();
  const complaint = String(formData.get("complaint") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();
  const kedatangan = String(formData.get("kedatangan") ?? "walkin").trim();
  const durasiRaw = String(formData.get("durasiMenit") ?? "").trim();

  // Data kendaraan & customer baru (jika belum terdaftar)
  const brandRaw = String(formData.get("brand") ?? "").trim();
  const brand = normalizeMerek(
    brandRaw === MEREK_LAINNYA ? String(formData.get("brandLain") ?? "") : brandRaw,
  );
  const model = normalizeTipe(String(formData.get("model") ?? ""));
  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerEmail = String(formData.get("customerEmail") ?? "").trim().toLowerCase();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();

  if (!branchId || !plateRaw) {
    return { error: "Cabang dan nomor plat wajib diisi." };
  }
  const plateNumber = normalizePlate(plateRaw);
  if (!plateNumber) {
    return { error: "Format nomor plat tidak valid. Contoh: B 1234 XY." };
  }

  // No. WA wajib untuk semua booking (walk-in maupun reservasi) — dipakai
  // bengkel untuk konfirmasi. Snapshot disimpan di Service.customerPhone.
  const customerWa = normalizeWa(customerPhone);
  if (!customerWa) {
    return {
      error:
        "No. WhatsApp customer wajib diisi dengan nomor seluler yang valid, contoh: 0812xxxxxxxx.",
    };
  }

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, aktif: true },
  });
  if (!branch) return { error: "Cabang tidak valid." };

  const catalog = catalogId
    ? await prisma.serviceCatalog.findFirst({ where: { id: catalogId, aktif: true } })
    : null;

  // §C4: booking baru berstatus WAITING_DP selama DP aktif (nominal > 0) —
  // konfirmasi DP oleh admin mengubahnya ke PENDING (siap estimasi).
  const dpCfg = await getDpConfig();
  const menungguDp = dpAktif(dpCfg);

  let durasiMenit = catalog?.estimasiMenit ?? DURASI_DEFAULT_MENIT;
  if (durasiRaw) {
    const n = Number(durasiRaw);
    if (!Number.isInteger(n) || n < DURASI_MIN_MENIT || n > DURASI_MAX_MENIT) {
      return {
        error: `Estimasi durasi harus ${DURASI_MIN_MENIT}–${DURASI_MAX_MENIT} menit.`,
      };
    }
    durasiMenit = n;
  }

  const reservasi = kedatangan === "reservasi";
  let epoch: number | null = null;
  if (reservasi) {
    if (!scheduledAtRaw) return { error: "Pilih jadwal kedatangan untuk reservasi." };
    epoch = parseJadwal(scheduledAtRaw);
    if (epoch === null) return { error: "Jadwal kedatangan tidak valid." };
  }

  const hasil = await prisma.$transaction(async (tx) => {
    // Kode dihitung DI DALAM transaksi setelah advisory lock — jangan di luar
    // (race count+1 antar booking paralel → bentrok unique code).
    const code = await generateServiceCode(tx, branchId);
    const jadwalEpoch = reservasi && epoch !== null ? epoch : Date.now();
    await kunciSlot(tx, branchId, jadwalEpoch);

    if (reservasi && epoch !== null) {
      const cek = await cekSlotTersedia({
        branchId,
        epoch,
        durasiMenit,
        pakaiLeadTime: false,
        db: tx,
      });
      if (!cek.ok) return cek;
    }

    // Cari kendaraan by plat
    let vehicle = await tx.vehicle.findUnique({
      where: { plateNumber },
      include: { owner: true },
    });
    let passwordSementara: string | null = null;

    if (!vehicle) {
      // Kendaraan baru → butuh data customer + merek/tipe.
      // Tanpa email: TIDAK ada row User sama sekali — nama & telp pemilik
      // disimpan langsung di Vehicle, tanpa akun login.
      if (!brand || !model || !customerName) {
        return {
          ok: false as const,
          error:
            "Kendaraan belum terdaftar. Isi nama customer, merek, dan tipe. (Email opsional — untuk akun login online.)",
        };
      }
      if (merekListrikDilarang(brand)) {
        return {
          ok: false as const,
          error: "Merek motor listrik tidak didukung di bengkel ini.",
        };
      }
      if (modelTidakSesuaiMerek(brand, model)) {
        return {
          ok: false as const,
          error: `"${model}" bukan tipe merek ${brand}. Periksa pilihan merek/tipe.`,
        };
      }
      let customer = customerEmail
        ? await tx.user.findUnique({ where: { email: customerEmail } })
        : null;
      if (customerEmail && !customer) {
        const { hashPassword } = await import("@/lib/password");
        const { randomBytes } = await import("node:crypto");
        // Password acak per akun — jangan pernah pakai default publik.
        passwordSementara = randomBytes(8).toString("hex");
        customer = await tx.user.create({
          data: {
            name: customerName,
            email: customerEmail,
            phone: customerWa,
            passwordHash: hashPassword(passwordSementara),
            mustChangePassword: true,
            role: "CUSTOMER",
          },
        });
      }
      vehicle = await tx.vehicle.create({
        data: {
          plateNumber,
          brand,
          model,
          ownerId: customer?.id ?? null,
          ownerName: customer?.name ?? customerName,
          ownerPhone: customer?.phone
            ? (normalizeWa(customer.phone) ?? customer.phone)
            : customerWa,
        },
        include: { owner: true },
      });
    }

    // Walk-in tidak pernah ditolak — hanya peringatan bila melebihi kuota pit.
    let peringatan = "";
    if (!reservasi) {
      const config = await getBookingConfig(tx);
      const jendelas = await getJendelaAktif({
        branchId,
        epoch: jadwalEpoch,
        bufferMenit: config.bufferMinutes,
        db: tx,
      });
      const titikPenuh = cekKapasitas(
        jadwalEpoch,
        durasiMenit,
        config.bufferMinutes,
        jendelas,
        branch.kuotaParalel,
        branch.jamBuka,
        branch.jamTutup,
      );
      if (titikPenuh !== null) {
        peringatan = " Kuota pit terlampaui — slot berikutnya otomatis ditutup.";
      }
    }

    const created = await tx.service.create({
      data: {
        code,
        branchId,
        source: "ADMIN",
        catalogId: catalog?.id ?? null,
        vehicleId: vehicle.id,
        customerId: vehicle.ownerId,
        customerName: vehicle.owner?.name ?? vehicle.ownerName,
        customerPhone: customerWa,
        status: menungguDp ? "WAITING_DP" : "PENDING",
        complaint: complaint || catalog?.nama || null,
        estimate: catalog?.hargaDasar ?? 0,
        scheduledAt: new Date(jadwalEpoch),
        estimasiMenit: durasiMenit,
      },
    });
    await logAudit(tx, session.user, {
      action: "SERVICE_CREATE",
      entityType: "Service",
      entityId: created.id,
      branchId,
      summary: `${code} dibuat untuk ${plateNumber}`,
      after: {
        source: "ADMIN",
        catalogId: catalog?.id ?? null,
        estimate: catalog?.hargaDasar ?? 0,
        scheduledAt: new Date(jadwalEpoch).toISOString(),
        estimasiMenit: durasiMenit,
      },
    });
    return { ok: true as const, id: created.id, code, passwordSementara, peringatan };
  });

  if (!hasil.ok) {
    return { error: hasil.error };
  }

  after(() => notifyBookingBaru(hasil.id));
  revalidatePath("/dashboard/servis");
  return {
    success:
      (reservasi
        ? `Reservasi ${hasil.code} dibuat untuk ${plateNumber}.`
        : `Booking ${hasil.code} dibuat untuk ${plateNumber} (walk-in).`) +
      (menungguDp ? " Menunggu pembayaran DP." : "") +
      hasil.peringatan +
      (hasil.passwordSementara
        ? ` Akun customer baru dibuat — password sementara: ${hasil.passwordSementara} (beritahu customer, sarankan diganti).`
        : ""),
  };
}

// ─── Transisi Status ──────────────────────────────────────────────────

async function getServiceOrThrow(id: string) {
  const service = await prisma.service.findUnique({
    where: { id },
    include: {
      vehicle: { include: { owner: true } },
      mechanic: true,
      branch: true,
      catalog: { select: { hargaDasar: true } },
    },
  });
  if (!service) throw new Error("Servis tidak ditemukan.");
  return service;
}

type TransitionOpts = {
  lock?: { branchId: string; epoch: number };
  validasi?: (tx: Prisma.TransactionClient) => Promise<string | null>;
};

async function transition(
  id: string,
  from: ServiceStatus[],
  to: ServiceStatus,
  extra: Record<string, unknown> = {},
  opts?: TransitionOpts,
) {
  const service = await getServiceOrThrow(id);
  const aksesError = await cekCabangServis(service.branchId);
  if (aksesError) throw new Error(aksesError);
  if (!from.includes(service.status)) {
    throw new Error(
      `Status saat ini "${service.status}" tidak bisa diubah ke "${to}".`,
    );
  }
  return prisma.$transaction(async (tx) => {
    if (opts?.lock) {
      await kunciSlot(tx, opts.lock.branchId, opts.lock.epoch);
    }
    if (opts?.validasi) {
      const err = await opts.validasi(tx);
      if (err) throw new Error(err);
    }
    const updated = await tx.service.update({
      where: { id },
      data: { status: to, ...extra },
    });
    const session = await auth();
    if (session?.user) {
      await logAudit(tx, session.user, {
        action: "SERVICE_STATUS",
        entityType: "Service",
        entityId: id,
        branchId: service.branchId,
        summary: `${service.code}: ${service.status} → ${to}`,
        before: { status: service.status },
        after: { status: to, ...extra },
      });
    }
    return updated;
  });
}

export async function submitEstimate(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const estimate = Number(formData.get("estimate") ?? 0);
  const laborCost = Number(formData.get("laborCost") ?? 0);
  const mechanicId = String(formData.get("mechanicId") ?? "").trim();
  const catalogId = String(formData.get("catalogId") ?? "").trim();

  if (
    !Number.isFinite(estimate) ||
    !Number.isFinite(laborCost) ||
    estimate < 0 ||
    laborCost < 0 ||
    estimate > 2_000_000_000 ||
    laborCost > 2_000_000_000
  ) {
    return { error: "Biaya tidak valid." };
  }

  if (catalogId) {
    const cat = await prisma.serviceCatalog.findFirst({
      where: { id: catalogId, aktif: true },
      select: { id: true },
    });
    if (!cat) return { error: "Jenis jasa tidak ditemukan di katalog." };
  }

  const service = await prisma.service.findUnique({
    where: { id },
    select: { status: true, branchId: true, scheduledAt: true, estimasiMenit: true },
  });
  if (!service) return { error: "Servis tidak ditemukan." };
  if (service.status !== "PENDING") {
    return { error: "Servis tidak dalam tahap Booking." };
  }

  if (mechanicId) {
    const err = await validasiMekanik({
      id,
      branchId: service.branchId,
      scheduledAt: service.scheduledAt,
      durasiMenit: service.estimasiMenit ?? DURASI_DEFAULT_MENIT,
      mechanicId,
    });
    if (err) return { error: err };
  }

  try {
    // §C9: estimasi informatif — customer tidak perlu approve; simpan →
    // langsung CONFIRMED (booking jalan tanpa langkah approval).
    await transition(
      id,
      ["PENDING"],
      "CONFIRMED",
      {
        estimate,
        laborCost,
        mechanicId: mechanicId || null,
        catalogId: catalogId || null,
      },
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan estimasi." };
  }

  after(() => notifyEstimasi(id));
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "Estimasi dikirim — booking sudah dikonfirmasi." };
}

// ─── Konfirmasi DP (WAITING_DP → PENDING) ─────────────────────────────

export async function confirmDp(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const method = String(formData.get("method") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!["TRANSFER", "QRIS", "CASH"].includes(method)) {
    return { error: "Metode pembayaran tidak valid." };
  }

  const service = await prisma.service.findUnique({
    where: { id },
    include: { customer: { select: { name: true } } },
  });
  if (!service) return { error: "Servis tidak ditemukan." };
  if (service.status !== "WAITING_DP") {
    return { error: "Servis tidak dalam tahap Menunggu DP." };
  }
  const aksesError = await cekCabangServis(service.branchId);
  if (aksesError) return { error: aksesError };

  const cfg = await getDpConfig();
  if (!dpAktif(cfg)) return { error: "DP tidak aktif (nominal 0) — gunakan konfirmasi booking biasa." };
  // Metode wajib yang sedang aktif di Pengaturan DP (dropdown disaring
  // di client; ini penjaga server kalau ada yang maksa submit).
  const metodeAktif =
    (method === "TRANSFER" && cfg.transferEnabled) ||
    (method === "QRIS" && cfg.qrisEnabled) ||
    (method === "CASH" && cfg.cashEnabled);
  if (!metodeAktif) {
    return { error: "Metode pembayaran tersebut tidak aktif di Pengaturan DP." };
  }
  const amount = cfg.nominal;
  const account = method === "CASH" ? "KAS" : "BANK";

  try {
    await prisma.$transaction(async (tx) => {
      // Kunci baris servis — serialisasi cek status antar request.
      await tx.$queryRaw`SELECT id FROM "Service" WHERE id = ${id} FOR UPDATE`;
      const fresh = await tx.service.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!fresh) throw new Error("Servis tidak ditemukan.");
      if (fresh.status !== "WAITING_DP") {
        throw new Error("Servis tidak lagi dalam tahap Menunggu DP.");
      }

      // DP sudah pernah dicatat (mis. lewat menu Kas) → jangan dobel;
      // cukup transisi statusnya saja.
      const existingDp = await tx.payment.findFirst({
        where: { serviceId: id, kind: "DP", voidedAt: null },
        select: { id: true },
      });
      if (!existingDp) {
        await tx.payment.create({
          data: {
            serviceId: id,
            amount,
            kind: "DP",
            method: method as PaymentMethod,
            note: note || null,
            receivedById: session.user.id,
          },
        });
        await tx.cashflow.create({
          data: {
            type: "INCOME",
            category: "DP Servis",
            amount,
            account,
            branchId: service.branchId,
            description: `${service.code} · ${service.customerName ?? service.customer?.name ?? "Tanpa nama"}`,
            createdBy: session.user.id,
          },
        });
        await logAudit(tx, session.user, {
          action: "DP_CONFIRM",
          entityType: "Service",
          entityId: id,
          branchId: service.branchId,
          summary: `${service.code}: DP ${amount.toLocaleString("id-ID")} (${method}) diterima — WAITING_DP → PENDING`,
          after: {
            amount,
            kind: "DP",
            method,
            account,
            status: "PENDING",
          },
        });
      }

      await tx.service.update({ where: { id }, data: { status: "PENDING" } });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal konfirmasi DP." };
  }

  after(() => notifyDpDiterima(id));
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  revalidatePath("/pesanan");
  return { success: `DP diterima — ${service.code} lanjut ke tahap Booking.` };
}

/** Mekanik harus aktif, role MECHANIC, se-cabang, dan bebas (tidak tabrakan jadwal). */
async function validasiMekanik(opts: {
  id: string;
  branchId: string;
  scheduledAt: Date | null;
  durasiMenit: number;
  mechanicId: string;
}): Promise<string | null> {
  const m = await prisma.user.findFirst({
    where: {
      id: opts.mechanicId,
      role: "MECHANIC",
      isActive: true,
      branchId: opts.branchId,
    },
    select: { name: true },
  });
  if (!m) return "Mekanik tidak valid untuk cabang ini.";
  const sibuk = await mekanikSibuk({
    branchId: opts.branchId,
    epoch: opts.scheduledAt?.getTime() ?? null,
    durasiMenit: opts.durasiMenit,
    excludeId: opts.id,
  });
  if (sibuk.has(opts.mechanicId)) {
    return `Mekanik ${m.name} sudah terjadwal di servis lain pada jam tersebut — pilih mekanik lain.`;
  }
  return null;
}

export async function reassignMechanic(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const mechanicId = String(formData.get("mechanicId") ?? "").trim();

  const service = await getServiceOrThrow(id);
  if (service.status === "DONE" || service.status === "CANCELLED") {
    return { error: "Servis sudah selesai — mekanik tidak bisa diganti." };
  }
  const aksesError = await cekCabangServis(service.branchId);
  if (aksesError) return { error: aksesError };

  if (mechanicId) {
    const err = await validasiMekanik({
      id,
      branchId: service.branchId,
      scheduledAt: service.scheduledAt,
      durasiMenit: service.estimasiMenit ?? DURASI_DEFAULT_MENIT,
      mechanicId,
    });
    if (err) return { error: err };
  }

  const lama = service.mechanic?.name ?? "Belum ditentukan";
  const baru = mechanicId
    ? (
        await prisma.user.findUnique({
          where: { id: mechanicId },
          select: { name: true },
        })
      )?.name ?? "Belum ditentukan"
    : "Belum ditentukan";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.service.update({
        where: { id },
        data: { mechanicId: mechanicId || null },
      });
      await logAudit(tx, session.user, {
        action: "SERVICE_MECHANIC",
        entityType: "Service",
        entityId: id,
        branchId: service.branchId,
        summary: `${service.code}: mekanik ${lama} → ${baru}`,
        before: { mechanicId: service.mechanicId, mechanicName: lama },
        after: { mechanicId: mechanicId || null, mechanicName: baru },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengganti mekanik." };
  }

  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: `Mekanik diubah ke ${baru}.` };
}

export async function changeSchedule(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "").trim();

  if (!scheduledAtRaw) return { error: "Pilih jadwal baru dulu." };
  const epoch = parseJadwal(scheduledAtRaw);
  if (epoch === null) return { error: "Jadwal tidak valid." };

  const service = await prisma.service.findUnique({
    where: { id },
    select: {
      status: true,
      branchId: true,
      estimasiMenit: true,
      mechanicId: true,
      mechanic: { select: { name: true } },
    },
  });
  if (!service) return { error: "Servis tidak ditemukan." };
  if (service.status !== "PENDING") {
    return { error: "Servis tidak dalam tahap Booking." };
  }

  // Pindah jadwal tidak boleh membuat mekanik yang sudah ditugasi tabrakan.
  if (service.mechanicId) {
    const sibuk = await mekanikSibuk({
      branchId: service.branchId,
      epoch,
      durasiMenit: service.estimasiMenit ?? DURASI_DEFAULT_MENIT,
      excludeId: id,
    });
    if (sibuk.has(service.mechanicId)) {
      return {
        error: `Mekanik ${service.mechanic?.name ?? ""} sudah terjadwal di servis lain pada jam baru itu — ganti mekanik lewat form estimasi dulu.`,
      };
    }
  }

  try {
    await transition(
      id,
      ["PENDING"],
      "PENDING",
      { scheduledAt: new Date(epoch) },
      {
        lock: { branchId: service.branchId, epoch },
        validasi: async (tx) => {
          const cek = await cekSlotTersedia({
            branchId: service.branchId,
            epoch,
            durasiMenit: service.estimasiMenit ?? DURASI_DEFAULT_MENIT,
            excludeId: id,
            pakaiLeadTime: false,
            db: tx,
          });
          return cek.ok ? null : pesanDitolak(cek);
        },
      },
    );
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengubah jadwal." };
  }

  after(() => notifyJadwalDiubah(id));
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return {
    success: `Jadwal diubah ke ${formatTanggalWIB(new Date(epoch))}. Beri tahu customer tentang perubahan ini.`,
  };
}

export async function approveInPerson(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const service = await getServiceOrThrow(id);

  // Dari PENDING biaya jasa belum pernah diisi form → isi harga katalog
  // agar tagihan/omzet tidak jatuh ke Rp0. Dari WAITING_APPROVAL hormati
  // angka yang sudah dikirim lewat form (termasuk 0 = gratis).
  const laborOtomatis =
    service.status === "PENDING" &&
    service.laborCost === 0 &&
    service.catalog
      ? service.catalog.hargaDasar
      : null;

  await transition(
    id,
    ["PENDING", "WAITING_APPROVAL"],
    "CONFIRMED",
    laborOtomatis === null ? {} : { laborCost: laborOtomatis },
  );
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return {
    success:
      laborOtomatis === null
        ? "Disetujui di tempat → Dikonfirmasi."
        : `Disetujui di tempat → Dikonfirmasi · biaya jasa mengikuti katalog (${formatRupiah(laborOtomatis)}).`,
  };
}

export async function checkInUnit(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "ADMIN", "MECHANIC"]);
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
  const session = await requireStaffRole(["OWNER", "ADMIN", "MECHANIC"]);
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
  await requireStaffRole(["OWNER", "ADMIN", "MECHANIC"]);
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
  await requireStaffRole(["OWNER", "ADMIN", "MECHANIC"]);
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
  await requireStaffRole(["OWNER", "ADMIN", "MECHANIC"]);
  const id = String(formData.get("id") ?? "").trim();
  const diagnosis = String(formData.get("diagnosis") ?? "").trim();
  const service = await getServiceOrThrow(id);
  const aksesError = await cekCabangServis(service.branchId);
  if (aksesError) return { error: aksesError };
  await prisma.service.update({ where: { id }, data: { diagnosis } });
  revalidatePath(`/dashboard/servis/${id}`);
  revalidatePath("/dashboard/tugas");
  return { success: "Diagnosis tersimpan." };
}

export async function mechanicFinish(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "ADMIN", "MECHANIC"]);
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
  await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  await transition(id, ["IN_PROGRESS", "WAITING_PARTS"], "DONE", {
    finishedAt: new Date(),
  });
  after(() => notifySelesai(id));
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "QC lolos → servis SELESAI. Siap diambil & bayar." };
}

export async function cancelService(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "Alasan pembatalan wajib diisi." };

  const service = await prisma.service.findUnique({
    where: { id },
    select: { status: true, scheduledAt: true },
  });
  if (!service) return { error: "Servis tidak ditemukan." };

  // Aturan DP seragam ikut `dp_policy` (tidak ada override no-show):
  // - TANPA_REFUND (default): pembayaran aktif kind=DP saja → boleh cancel
  //   tanpa void, DP tetap income (hangus) — wajib centang konfirmasi.
  // - REFUND_PENUH: masih ada pembayaran aktif → ditolak, wajib void
  //   (refund) dulu lewat menu Kas.
  // - Selalu blokir bila ada pembayaran non-DP aktif (mis. PELUNASAN).
  const bayar = await prisma.payment.findMany({
    where: { serviceId: id, voidedAt: null },
    select: { amount: true, kind: true },
  });
  let dpHangus = 0;
  if (bayar.length > 0) {
    const hanyaDp = bayar.every((p) => p.kind === "DP");
    if (hanyaDp) {
      const cfg = await getDpConfig();
      if (cfg.policy !== "REFUND_PENUH") {
        dpHangus = bayar.reduce((s, p) => s + p.amount, 0);
      }
    }
    if (dpHangus === 0) {
      const totalBayar = bayar.reduce((s, p) => s + p.amount, 0);
      return {
        error: `Ada pembayaran aktif total Rp${totalBayar.toLocaleString("id-ID")} — batalkan (void) dulu pembayarannya lewat menu Kas sebelum membatalkan servis.`,
      };
    }
    if (String(formData.get("dpHangus") ?? "") !== "1") {
      return {
        error: `Centang konfirmasi "DP Rp${dpHangus.toLocaleString("id-ID")} ditahan (tidak direfund)" sebelum membatalkan servis.`,
      };
    }
  }

  await transition(
    id,
    ["WAITING_DP", "PENDING", "WAITING_APPROVAL", "CONFIRMED", "CHECKED_IN"],
    "CANCELLED",
    { cancelReason: reason },
  );
  after(() => notifyBatal(id));
  revalidatePath("/dashboard/servis");
  revalidatePath(`/dashboard/servis/${id}`);
  revalidatePath("/pesanan");
  return {
    success:
      dpHangus > 0
        ? `Servis dibatalkan. DP Rp${dpHangus.toLocaleString("id-ID")} tetap diterima bengkel (hangus).`
        : "Servis dibatalkan.",
  };
}

// ─── Part Terpakai ────────────────────────────────────────────────────

export async function addServicePart(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  // Hanya OWNER/ADMIN (§B): mekanik tidak menambah part sendirian —
  // perencanaan & akurasi jasa/part di tangan pengelola.
  await requireStaffRole(["OWNER", "ADMIN"]);
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const partId = String(formData.get("partId") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);

  if (!serviceId) return { error: "Servis tidak valid." };
  if (!partId) {
    return {
      error:
        "Part belum dipilih — ketik nama part lalu pilih satu dari daftar saran.",
    };
  }
  if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1_000_000) {
    return { error: "Jumlah tidak valid — isi bilangan bulat minimal 1." };
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { branch: true },
  });
  if (!service) return { error: "Servis tidak ditemukan." };
  if (service.status === "DONE" || service.status === "CANCELLED") {
    return { error: "Tidak bisa menambah part pada servis yang sudah selesai/dibatalkan." };
  }
  const aksesError = await cekCabangServis(service.branchId);
  if (aksesError) return { error: aksesError };

  const part = await prisma.part.findFirst({
    where: { id: partId, branchId: service.branchId },
  });
  if (!part) return { error: "Part tidak tersedia di cabang ini." };
  if (part.quantity < quantity) {
    return { error: `Stok ${part.name} kurang (tersisa ${part.quantity}).` };
  }

  // Transaksi atomik: tambah ServicePart + kurangi stok + catat movement
  let qtySebelum = 0;
  let qtySesudah = 0;
  await prisma.$transaction(async (tx) => {
    // Guard atomik anti-race: decrement hanya bila stok masih mencukupi di DB.
    const updated = await tx.part.updateMany({
      where: { id: partId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (updated.count === 0) {
      throw new Error(`Stok ${part.name} kurang (tersisa ${part.quantity}).`);
    }

    // Baca ulang part SETELAH baris terkunci — harga jual & rata-rata fallback
    // harus dari angka terkini, bukan bacaan basi sebelum transaksi.
    const partF = await tx.part.findUnique({ where: { id: partId } });
    if (!partF) throw new Error("Part tidak ditemukan.");
    qtySebelum = partF.quantity + quantity;
    qtySesudah = partF.quantity;

    // Alokasi FIFO: unit diambil dari batch pembelian tertua yang masih sisa,
    // jejaknya dicatat di PartBatchUsage supaya koreksi harga batch nanti bisa
    // tepat sasaran (terbatas jumlah unit yang benar-benar terpakai).
    const movements = await tx.stockMovement.findMany({
      where: { partId, type: "IN" },
      // Tiebreak id: createdAt bisa sama (ms) → urutan FIFO harus deterministik.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, quantity: true, cost: true },
    });
    const usedAgg = await tx.partBatchUsage.groupBy({
      by: ["movementId"],
      where: { movementId: { in: movements.map((m) => m.id) } },
      _sum: { quantity: true },
    });
    const usedMap = new Map(
      usedAgg.map((u) => [u.movementId, u._sum?.quantity ?? 0]),
    );
    const openBatches = movements.map((m) => ({
      movementId: m.id,
      remaining: m.quantity - (usedMap.get(m.id) ?? 0),
      cost: m.cost,
    }));
    const { allocations, cost } = allocateFifo(quantity, openBatches, partF.buyPrice);

    const sp = await tx.servicePart.create({
      data: {
        serviceId,
        partId,
        quantity,
        price: partF.sellPrice,
        cost,
      },
    });
    for (const a of allocations) {
      await tx.partBatchUsage.create({
        data: {
          movementId: a.movementId,
          servicePartId: sp.id,
          quantity: a.quantity,
        },
      });
    }
    await tx.stockMovement.create({
      data: {
        partId,
        type: "OUT",
        quantity,
        note: `Terpakai di servis ${service.code}`,
      },
    });
    const session = await auth();
    if (session?.user) {
      await logAudit(tx, session.user, {
        action: "SERVICE_PART_ADD",
        entityType: "ServicePart",
        entityId: sp.id,
        branchId: service.branchId,
        summary: `${service.code} · +${quantity} ${part.unit} ${part.name} @${sp.price.toLocaleString("id-ID")}`,
        after: { partId, quantity, price: sp.price, cost },
      });
    }
  });

  after(() => notifyStokMenipis(partId, qtySebelum, qtySesudah));
  revalidatePath(`/dashboard/servis/${serviceId}`);
  revalidatePath("/dashboard/tugas");
  return { success: `${quantity} ${part.unit} ${part.name} dicatat & stok berkurang.` };
}

export async function removeServicePart(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  // Hanya OWNER/ADMIN: mekanik yang memegang part secara fisik tidak boleh
  // menghapus jejaknya di sistem sendirian (risiko part fisik tidak kembali).
  await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const sp = await prisma.servicePart.findUnique({
    where: { id },
    include: { part: true, service: true },
  });
  if (!sp) return { error: "Item tidak ditemukan." };
  if (sp.service.status === "DONE" || sp.service.status === "CANCELLED") {
    return { error: "Tidak bisa ubah part servis yang sudah selesai/dibatalkan." };
  }
  const aksesError = await cekCabangServis(sp.service.branchId);
  if (aksesError) return { error: aksesError };

  await prisma.$transaction(async (tx) => {
    // Kunci baris part dulu (sebelum hapus ServicePart) — urutan lock konsisten
    // dengan addServicePart/correctStockCost (Part → ServicePart), anti-deadlock.
    await tx.$queryRaw`SELECT id FROM "Part" WHERE id = ${sp.partId} FOR UPDATE`;
    const partF = (await tx.part.findUnique({ where: { id: sp.partId } }))!;

    // Alokasi FIFO lama ikut terhapus bersama ServicePart (FK cascade) — batch
    // asal otomatis terbuka kembali sejumlah unit. Baris IN pengembalian dibuat
    // hanya sebagai jejak gerakan (konservasi Σ IN − Σ OUT = stok) dan langsung
    // ditahan usage-nya sendiri, supaya Σ batch terbuka tidak dobel — unit yang
    // sama tak boleh muncul dua kali di antrean FIFO.
    const costPerUnit =
      sp.quantity > 0 ? Math.round(sp.cost / sp.quantity) : null;
    const retur = await tx.stockMovement.create({
      data: {
        partId: sp.partId,
        type: "IN",
        quantity: sp.quantity,
        cost: costPerUnit,
        note: `Dikembalikan dari servis ${sp.service.code}`,
      },
    });
    await tx.part.update({
      where: { id: sp.partId },
      data: { quantity: { increment: sp.quantity } },
    });
    await tx.servicePart.delete({ where: { id } });
    await tx.partBatchUsage.create({
      data: { movementId: retur.id, quantity: sp.quantity },
    });
    const session = await auth();
    if (session?.user) {
      await logAudit(tx, session.user, {
        action: "SERVICE_PART_REMOVE",
        entityType: "ServicePart",
        entityId: id,
        branchId: sp.service.branchId,
        summary: `${sp.service.code} · −${sp.quantity} ${partF.unit} ${partF.name} dikembalikan ke stok`,
        before: { partId: sp.partId, quantity: sp.quantity, price: sp.price },
      });
    }
  });

  revalidatePath(`/dashboard/servis/${sp.serviceId}`);
  return { success: "Item dikembalikan ke stok." };
}

// ─── Rincian jasa (per baris) ─────────────────────────────────────────
// Jasa murni: tanpa stok, tanpa qty — hanya nama + harga. Total ikut
// `totalTagihan()` (jasa utama + rincian + part). OWNER/ADMIN saja.

export async function addServiceLabor(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "ADMIN"]);
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!serviceId) return { error: "Servis tidak valid." };
  if (!name) return { error: "Nama jasa wajib diisi." };
  if (name.length > 200) return { error: "Nama jasa maksimal 200 karakter." };
  if (note.length > 500) return { error: "Catatan maksimal 500 karakter." };
  if (!Number.isInteger(price) || price < 0 || price > 2_000_000_000) {
    return { error: "Harga tidak valid — isi bilangan bulat rupiah (0–2 miliar)." };
  }

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { id: true, code: true, branchId: true, status: true },
  });
  if (!service) return { error: "Servis tidak ditemukan." };
  // Rincian jasa hanya masuk akal saat unit sudah disepakati dikerjakan —
  // bukan saat booking/estimasi masih menunggu (laborCost estimasi beda haluan).
  const bolehJasa: ServiceStatus[] = [
    "CONFIRMED",
    "CHECKED_IN",
    "IN_PROGRESS",
    "WAITING_PARTS",
  ];
  if (!bolehJasa.includes(service.status)) {
    return { error: "Rincian jasa bisa ditambah setelah booking dikonfirmasi." };
  }
  const aksesError = await cekCabangServis(service.branchId);
  if (aksesError) return { error: aksesError };

  await prisma.$transaction(async (tx) => {
    const labor = await tx.serviceLabor.create({
      data: { serviceId, name, price, note: note || null },
    });
    await logAudit(tx, session.user, {
      action: "SERVICE_LABOR_ADD",
      entityType: "ServiceLabor",
      entityId: labor.id,
      branchId: service.branchId,
      summary: `${service.code} · +jasa ${name} @${price.toLocaleString("id-ID")}`,
      after: { name, price, note: note || null },
    });
  });

  revalidatePath(`/dashboard/servis/${serviceId}`);
  return { success: `Jasa "${name}" ditambahkan.` };
}

export async function removeServiceLabor(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Item tidak valid." };

  const labor = await prisma.serviceLabor.findUnique({
    where: { id },
    include: {
      service: {
        select: {
          id: true,
          code: true,
          branchId: true,
          status: true,
          laborCost: true,
          parts: { select: { price: true, quantity: true } },
          payments: { where: { voidedAt: null }, select: { amount: true } },
        },
      },
    },
  });
  if (!labor) return { error: "Jasa tidak ditemukan." };
  if (labor.service.status === "DONE" || labor.service.status === "CANCELLED") {
    return { error: "Tidak bisa ubah jasa servis yang sudah selesai/dibatalkan." };
  }
  const aksesError = await cekCabangServis(labor.service.branchId);
  if (aksesError) return { error: aksesError };

  // Hapus tak boleh membuat total jatuh di bawah yang sudah dibayar —
  // tagihan tak boleh negatif / piutang tak terkejar.
  const laborsLain = await prisma.serviceLabor.findMany({
    where: { serviceId: labor.serviceId, id: { not: id } },
    select: { price: true },
  });
  const totalSesudah = totalTagihan(
    labor.service.laborCost,
    labor.service.parts,
    laborsLain,
  );
  const sudahDibayar = labor.service.payments.reduce((s, p) => s + p.amount, 0);
  if (totalSesudah < sudahDibayar) {
    return {
      error: `Tidak bisa hapus — total sesudah dihapus (${totalSesudah.toLocaleString("id-ID")}) kurang dari yang sudah dibayar (${sudahDibayar.toLocaleString("id-ID")}).`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceLabor.delete({ where: { id } });
    await logAudit(tx, session.user, {
      action: "SERVICE_LABOR_REMOVE",
      entityType: "ServiceLabor",
      entityId: id,
      branchId: labor.service.branchId,
      summary: `${labor.service.code} · −jasa ${labor.name}`,
      before: { name: labor.name, price: labor.price },
    });
  });

  revalidatePath(`/dashboard/servis/${labor.serviceId}`);
  return { success: `Jasa "${labor.name}" dihapus.` };
}

/**
 * Ubah jasa utama (`laborCost`) setelah estimasi — OWNER/ADMIN, selain
 * PENDING (paketnya form Estimasi) & DONE/CANCELLED. Total tagihan ikut
 * berubah; tak boleh turun di bawah yang sudah dibayar (invariant yang
 * sama dengan hapus rincian jasa).
 */
export async function updateServiceLaborCost(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const laborCost = Number(formData.get("laborCost") ?? 0);
  if (!Number.isInteger(laborCost) || laborCost < 0 || laborCost > 2_000_000_000) {
    return { error: "Biaya jasa tidak valid — isi bilangan bulat rupiah (0–2 miliar)." };
  }

  const service = await prisma.service.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      branchId: true,
      status: true,
      laborCost: true,
      parts: { select: { price: true, quantity: true } },
      payments: { where: { voidedAt: null }, select: { amount: true } },
    },
  });
  if (!service) return { error: "Servis tidak ditemukan." };
  if (["PENDING", "DONE", "CANCELLED"].includes(service.status)) {
    return { error: "Biaya jasa tidak bisa diubah pada tahap ini." };
  }
  const aksesError = await cekCabangServis(service.branchId);
  if (aksesError) return { error: aksesError };

  const labors = await prisma.serviceLabor.findMany({
    where: { serviceId: id },
    select: { price: true },
  });
  const totalSesudah = totalTagihan(laborCost, service.parts, labors);
  const sudahDibayar = service.payments.reduce((s, p) => s + p.amount, 0);
  if (totalSesudah < sudahDibayar) {
    return {
      error: `Tidak bisa menurunkan jasa — total sesudah diubah (${totalSesudah.toLocaleString("id-ID")}) kurang dari yang sudah dibayar (${sudahDibayar.toLocaleString("id-ID")}).`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data: { laborCost } });
    await logAudit(tx, session.user, {
      action: "SERVICE_LABOR_COST_UPDATE",
      entityType: "Service",
      entityId: id,
      branchId: service.branchId,
      summary: `${service.code} · jasa utama ${service.laborCost.toLocaleString("id-ID")} → ${laborCost.toLocaleString("id-ID")}`,
      before: { laborCost: service.laborCost },
      after: { laborCost },
    });
  });

  revalidatePath(`/dashboard/servis/${id}`);
  return { success: "Biaya jasa diperbarui." };
}

/**
 * Edit No. WhatsApp customer pada 1 booking (OWNER/ADMIN).
 *
 * Sinkron dalam (satu transaksi): snapshot `Service.customerPhone` +
 * akun customer bila ada (`User.phone`) + fallback pemilik kendaraan
 * (`Vehicle.ownerPhone`). Satu nomor = sumber kebenaran dari input ini.
 */
export async function updateServiceWa(
  _prev: ServisState,
  formData: FormData,
): Promise<ServisState> {
  const session = await requireStaffRole(["OWNER", "ADMIN"]);
  const id = String(formData.get("id") ?? "").trim();
  const wa = normalizeWa(String(formData.get("phone") ?? "").trim());
  if (!wa) {
    return { error: "No. WhatsApp tidak valid. Contoh: 0812xxxxxxxx." };
  }

  const service = await prisma.service.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      branchId: true,
      customerId: true,
      vehicleId: true,
      customerPhone: true,
    },
  });
  if (!service) return { error: "Servis tidak ditemukan." };
  const aksesError = await cekCabangServis(service.branchId);
  if (aksesError) return { error: aksesError };

  await prisma.$transaction(async (tx) => {
    await tx.service.update({ where: { id }, data: { customerPhone: wa } });
    if (service.customerId) {
      await tx.user.update({
        where: { id: service.customerId },
        data: { phone: wa },
      });
    }
    await tx.vehicle.update({
      where: { id: service.vehicleId },
      data: { ownerPhone: wa },
    });
    await logAudit(tx, session.user, {
      action: "SERVICE_WA_UPDATE",
      entityType: "Service",
      entityId: id,
      branchId: service.branchId,
      summary: `${service.code} · No. WhatsApp → ${formatWaLocal(wa)}`,
      before: { customerPhone: service.customerPhone },
      after: { customerPhone: wa },
    });
  });

  revalidatePath(`/dashboard/servis/${id}`);
  return {
    success: `No. WhatsApp diperbarui: ${formatWaLocal(wa)} — pastikan nomor aktif di WhatsApp.`,
  };
}
