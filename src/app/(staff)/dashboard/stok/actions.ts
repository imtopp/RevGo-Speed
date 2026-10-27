"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStaffBranchId } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import { samakanKategori } from "@/lib/category";
import { skuBerikutnya } from "@/lib/sku";
import { alasanTolakHapusPart } from "@/lib/part";
import { revalidatePath } from "next/cache";
import {
  movingAverageBuyPrice,
  estimateAvgAfterCostCorrection,
  correctedServiceCost,
  cekHargaRugi,
  allocateFifo,
} from "@/lib/inventory";
import {
  validasiItemJual,
  kodePenjualanPart,
} from "@/lib/sale";
import type { PaymentMethod } from "@db/prisma/client";

export type StokState = { error?: string; success?: string };

/** Batas atas nilai integer Prisma (Int32) — tolak input di luar itu. */
const MAX_RUPIAH = 2_000_000_000;

async function requireStokRole() {
  const session = await auth();
  if (!session?.user) throw new Error("Belum login.");
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!user?.isActive) throw new Error("Akun tidak aktif.");
  return session;
}

/** Kantong kas: TUNAI → KAS, TRANSFER/QRIS → BANK. */
function accountFromMethod(method: PaymentMethod): "KAS" | "BANK" {
  return method === "CASH" ? "KAS" : "BANK";
}

/** Kategori part yang sudah dipakai (lintas cabang) — dasar normalisasi input. */
async function kategoriPartExisting(): Promise<string[]> {
  const rows = await prisma.part.findMany({
    where: { category: { not: null } },
    distinct: ["category"],
    select: { category: true },
  });
  return rows.map((r) => r.category).filter((c): c is string => !!c);
}

/** Centang "sengaja jual di bawah harga beli" dari form (checkbox). */
function konfirmasiRugi(formData: FormData): boolean {
  return ["on", "true", "1"].includes(String(formData.get("confirmLoss") ?? ""));
}

// ─── Supplier ─────────────────────────────────────────────────────────

export async function createSupplier(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  const session = await requireStokRole();
  const nama = String(formData.get("nama") ?? "").trim();
  const telepon = String(formData.get("telepon") ?? "").trim();
  const catatan = String(formData.get("catatan") ?? "").trim();
  if (!nama) return { error: "Nama supplier wajib diisi." };

  await prisma.$transaction(async (tx) => {
    const s = await tx.supplier.create({
      data: { nama, telepon: telepon || null, catatan: catatan || null },
    });
    await logAudit(tx, session.user, {
      action: "SUPPLIER_CREATE",
      entityType: "Supplier",
      entityId: s.id,
      summary: `Supplier "${nama}" ditambahkan`,
      after: { nama, telepon: telepon || null, catatan: catatan || null },
    });
  });
  revalidatePath("/dashboard/stok");
  return { success: `Supplier "${nama}" ditambahkan.` };
}

export async function updateSupplier(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  const session = await requireStokRole();
  const id = String(formData.get("id") ?? "").trim();
  const nama = String(formData.get("nama") ?? "").trim();
  const telepon = String(formData.get("telepon") ?? "").trim();
  const catatan = String(formData.get("catatan") ?? "").trim();
  const aktif = formData.get("aktif") === "on";
  if (!id || !nama) return { error: "Data tidak lengkap." };

  const prev = await prisma.supplier.findUnique({ where: { id } });
  if (!prev) return { error: "Supplier tidak ditemukan." };

  await prisma.$transaction(async (tx) => {
    await tx.supplier.update({
      where: { id },
      data: { nama, telepon: telepon || null, catatan: catatan || null, aktif },
    });
    await logAudit(tx, session.user, {
      action: "SUPPLIER_UPDATE",
      entityType: "Supplier",
      entityId: id,
      summary: `Supplier "${nama}" diperbarui${prev.aktif !== aktif ? (aktif ? " · diaktifkan" : " · dinonaktifkan") : ""}`,
      before: { nama: prev.nama, aktif: prev.aktif },
      after: { nama, aktif },
    });
  });
  revalidatePath("/dashboard/stok");
  return { success: `Supplier "${nama}" diperbarui.` };
}

// ─── Part ─────────────────────────────────────────────────────────────

export async function createPart(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  await requireStokRole();
  const branchIdStaff = await getStaffBranchId();

  const branchId = branchIdStaff || String(formData.get("branchId") ?? "").trim() || "";
  let sku = String(formData.get("sku") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const category = samakanKategori(
    String(formData.get("category") ?? ""),
    await kategoriPartExisting(),
  );
  const unit = String(formData.get("unit") ?? "pcs").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const minStock = Number(formData.get("minStock") ?? 0);
  const buyPrice = Number(formData.get("buyPrice") ?? 0);
  const sellPrice = Number(formData.get("sellPrice") ?? 0);
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const consignment = formData.get("consignment") === "on";

  if (!branchId || !name) return { error: "Cabang dan nama wajib diisi." };
  if (consignment && !supplierId) {
    return { error: "Part konsinyasi wajib memilih supplier (pemilik barang)." };
  }
  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) return { error: "Supplier tidak ditemukan — pilih ulang." };
  }
  if (
    !Number.isFinite(quantity) ||
    !Number.isFinite(minStock) ||
    !Number.isFinite(buyPrice) ||
    !Number.isFinite(sellPrice) ||
    quantity < 0 ||
    minStock < 0 ||
    buyPrice < 0 ||
    sellPrice < 0 ||
    quantity > MAX_RUPIAH ||
    buyPrice > MAX_RUPIAH ||
    sellPrice > MAX_RUPIAH
  ) {
    return { error: "Nilai tidak valid." };
  }

  // SKU dikosongkan → auto urut per cabang (PART-0001, anti-bolong);
  // SKU manual tetap dipakai apa adanya. Unik per cabang dicek dua lapis
  // (app + constraint DB @@unique([branchId, sku])).
  if (!sku) {
    const existing = await prisma.part.findMany({
      where: { branchId },
      select: { sku: true },
    });
    sku = skuBerikutnya(existing.map((r) => r.sku));
  }
  const dup = await prisma.part.findFirst({ where: { branchId, sku } });
  if (dup) return { error: `SKU "${sku}" sudah ada di cabang ini.` };

  // Harga jual di bawah harga beli hanya boleh jika dikonfirmasi eksplisit.
  const rugiError = cekHargaRugi({
    buyPrice,
    sellPrice,
    konfirmasi: konfirmasiRugi(formData),
  });
  if (rugiError) return { error: rugiError };

  const session = await auth();
  if (!session?.user) return { error: "Belum login." };
  const method = String(formData.get("method") ?? "CASH") as PaymentMethod;
  if (!["CASH", "TRANSFER", "QRIS"].includes(method)) {
    return { error: "Metode bayar tidak valid." };
  }
  const total = quantity * buyPrice;

  await prisma.$transaction(async (tx) => {
    const p = await tx.part.create({
      data: {
        branchId,
        sku,
        name,
        category: category || null,
        unit,
        quantity,
        minStock,
        buyPrice,
        sellPrice,
        supplierId: supplierId || null,
        consignment,
      },
    });
    // Stok awal = pembelian: modal tertahan di barang, jadi uangnya keluar
    // sekarang juga dalam transaksi yang sama — saldo kas/laporan tetap
    // sama dengan uang fisik (kas tidak "hilang" tanpa baris).
    // Kecuali konsinyasi: barang titipan supplier — belum dibeli, stok masuk
    // tanpa kas (kas keluar baru saat bayar supplier via kas manual).
    if (quantity > 0) {
      // Kas dulu (bila ada) → gerakan stok menunjuk kasnya (cashflowId).
      let cashflowId: string | null = null;
      if (total > 0 && !consignment) {
        const cf = await tx.cashflow.create({
          data: {
            type: "EXPENSE",
            category: "Pembelian Part",
            amount: total,
            account: accountFromMethod(method),
            branchId,
            description: `Stok awal: ${quantity} ${unit} ${name}`,
            createdBy: session.user.id,
          },
        });
        cashflowId = cf.id;
      }
      await tx.stockMovement.create({
        data: {
          partId: p.id,
          type: "IN",
          quantity,
          cost: buyPrice,
          note: consignment ? "Stok awal (konsinyasi)" : "Stok awal",
          userId: session.user.id,
          supplierId: supplierId || null,
          cashflowId,
        },
      });
    }
  });
  revalidatePath("/dashboard/stok");
  if (consignment) {
    return {
      success: `Part "${name}" ditambahkan (konsinyasi, tanpa kas${
        quantity > 0 ? " — bayar supplier via kas manual" : ""
      }).`,
    };
  }
  return {
    success:
      total > 0
        ? `Part "${name}" ditambahkan. Kas keluar ${total.toLocaleString("id-ID")} (${accountFromMethod(method)}).`
        : `Part "${name}" ditambahkan.`,
  };
}

export async function updatePart(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  await requireStokRole();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = samakanKategori(
    String(formData.get("category") ?? ""),
    await kategoriPartExisting(),
  );
  const unit = String(formData.get("unit") ?? "pcs").trim();
  const minStock = Number(formData.get("minStock") ?? 0);
  const sellPrice = Number(formData.get("sellPrice") ?? 0);
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const consignment = formData.get("consignment") === "on";

  if (!id || !name) return { error: "Data tidak lengkap." };
  if (consignment && !supplierId) {
    return { error: "Part konsinyasi wajib memilih supplier (pemilik barang)." };
  }
  if (minStock < 0 || sellPrice < 0) {
    return { error: "Nilai tidak boleh negatif." };
  }

  const prev = await prisma.part.findUnique({ where: { id } });
  if (!prev) return { error: "Part tidak ditemukan." };
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && prev.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
  }
  // Konsinyasi = properti pembelian awal: menandai "barang titipan, kas belum
  // keluar". Membaliknya lewat edit membuat status konsinyasi tidak sinkron
  // dengan kas yang sudah terlanjur bergerak (atau tidak) — tolak di sini.
  if (consignment !== prev.consignment) {
    return {
      error:
        "Status konsinyasi tidak bisa diubah setelah part dibuat. Salah centang? Hapus part (bila riwayat masih bersih) lalu buat ulang.",
    };
  }
  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) return { error: "Supplier tidak ditemukan — pilih ulang." };
  }

  // Harga jual di bawah harga beli (rata-rata) hanya boleh jika dikonfirmasi.
  const rugiError = cekHargaRugi({
    buyPrice: prev.buyPrice,
    sellPrice,
    konfirmasi: konfirmasiRugi(formData),
  });
  if (rugiError) return { error: rugiError };

  // buyPrice TIDAK diubah dari sini: nilai itu rata-rata otomatis dari pembelian.
  // Koreksi harga per batch lewat koreksi riwayat (correctStockCost).
  await prisma.$transaction(async (tx) => {
    await tx.part.update({
      where: { id },
      data: {
        name,
        category: category || null,
        unit,
        minStock,
        sellPrice,
        supplierId: supplierId || null,
        consignment,
      },
    });
    const session = await auth();
    if (session?.user) {
      await logAudit(tx, session.user, {
        action: "PART_UPDATE",
        entityType: "Part",
        entityId: id,
        branchId: prev.branchId,
        summary: `${name} · harga jual ${prev.sellPrice.toLocaleString("id-ID")} → ${sellPrice.toLocaleString("id-ID")}`,
        before: { sellPrice: prev.sellPrice, name: prev.name, minStock: prev.minStock },
        after: { sellPrice, name, minStock },
      });
    }
  });
  revalidatePath("/dashboard/stok");
  return { success: `Part "${name}" diperbarui.` };
}

/**
 * Hapus part — guard bertingkat (lihat alasanTolakHapusPart):
 * - dipakai servis/penjualan → tolak (HPP & tagihan terpengaruh);
 * - riwayat selain stok awal (Stok Masuk/opname) → tolak (koreksi via Opname);
 * - riwayat HANYA stok awal → boleh, termasuk **reversal kas otomatis**:
 *   INCOME "Pembatalan Stok Awal" bertanggal gerakan aslinya (append-only —
 *   baris kas asli tidak pernah diedit/dihapus), net kas 0. Stok awal
 *   konsinyasi tanpa baris kas → tanpa reversal sama sekali.
 */
export async function deletePart(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  const session = await requireStokRole();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Data tidak lengkap." };

  const part = await prisma.part.findUnique({
    where: { id },
    include: {
      _count: { select: { movements: true, serviceParts: true, saleItems: true } },
    },
  });
  if (!part) return { error: "Part tidak ditemukan." };
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && part.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
  }

  const movements = await prisma.stockMovement.findMany({
    where: { partId: id },
    select: { id: true, type: true, quantity: true, cost: true, note: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const alasan = alasanTolakHapusPart({
    serviceParts: part._count.serviceParts,
    saleItems: part._count.saleItems,
    movements,
  });
  if (alasan === "dipakai-transaksi") {
    return {
      error: `Part "${part.name}" tidak bisa dihapus: sudah dipakai servis/penjualan (HPP & tagihan tercatat). Stok bisa dikoreksi lewat Opname.`,
    };
  }
  if (alasan === "bukan-stok-awal") {
    return {
      error: `Part "${part.name}" tidak bisa dihapus: riwayatnya bukan cuma stok awal (ada pembelian via Stok Masuk / penyesuaian). Koreksi stok lewat Opname, ubah data lewat Ubah.`,
    };
  }

  let kasDibatalkan = 0;
  try {
    kasDibatalkan = await prisma.$transaction(async (tx) => {
      // Kunci baris part — validasi diulang SETELAH kunci: stok masuk /
      // penjualan / servis yang masuk di antara cek luar dan transaksi ini
      // harus membatalkan penghapusan (bila lolos, gerakan pembelian ikut
      // terhapus padahal kas EXPENSE-nya sudah tercatat → kas fiktif).
      await tx.$queryRaw`SELECT id FROM "Part" WHERE id = ${id} FOR UPDATE`;
      const partF = await tx.part.findUnique({
        where: { id },
        include: {
          _count: { select: { serviceParts: true, saleItems: true } },
        },
      });
      if (!partF) throw new Error("Part tidak ditemukan.");
      const movementsF = await tx.stockMovement.findMany({
        where: { partId: id },
        select: { id: true, type: true, quantity: true, cost: true, note: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });
      const alasanF = alasanTolakHapusPart({
        serviceParts: partF._count.serviceParts,
        saleItems: partF._count.saleItems,
        movements: movementsF,
      });
      if (alasanF === "dipakai-transaksi") {
        throw new Error(
          `Part "${partF.name}" tidak bisa dihapus: sudah dipakai servis/penjualan (HPP & tagihan tercatat).`,
        );
      }
      if (alasanF === "bukan-stok-awal") {
        throw new Error(
          `Part "${partF.name}" tidak bisa dihapus: riwayatnya bukan cuma stok awal (ada pembelian via Stok Masuk / penyesuaian).`,
        );
      }

      let total = 0;
      for (const m of movementsF) {
        if (!m.cost || m.cost <= 0 || m.quantity <= 0) continue;
        // Konsinyasi tidak pernah membuat baris kas — jangan dicocokkan dengan
        // EXPENSE part lain (jumlah bisa kembar) supaya tidak membalik kas salah.
        if (m.note?.toLowerCase().includes("konsinyasi")) continue;
        const amount = m.quantity * m.cost;
        const orig = await tx.cashflow.findFirst({
          where: {
            type: "EXPENSE",
            category: "Pembelian Part",
            amount,
            branchId: partF.branchId,
            createdAt: {
              gte: new Date(m.createdAt.getTime() - 86_400_000),
              lte: new Date(m.createdAt.getTime() + 86_400_000),
            },
          },
          orderBy: { createdAt: "asc" },
        });
        if (!orig) continue; // stok awal tanpa baris kas (data lama) → tanpa reversal
        const sudahDibatalkan = await tx.cashflow.findFirst({
          where: {
            type: "INCOME",
            category: "Pembatalan Stok Awal",
            amount,
            branchId: partF.branchId,
            description: `Pembatalan stok awal: ${m.quantity} ${partF.unit} ${partF.name}`,
          },
        });
        if (sudahDibatalkan) continue;
        await tx.cashflow.create({
          data: {
            type: "INCOME",
            category: "Pembatalan Stok Awal",
            amount,
            account: orig.account,
            branchId: partF.branchId,
            description: `Pembatalan stok awal: ${m.quantity} ${partF.unit} ${partF.name}`,
            createdBy: session.user.id,
            createdAt: m.createdAt,
          },
        });
        total += amount;
      }

      await tx.stockMovement.deleteMany({ where: { partId: id } });
      await tx.part.delete({ where: { id } });
      await logAudit(tx, session.user, {
        action: "PART_DELETE",
        entityType: "Part",
        entityId: id,
        branchId: partF.branchId,
        summary:
          `${partF.name} (${partF.sku}) dihapus — hanya riwayat stok awal` +
          (total > 0 ? ` · reversal kas ${total.toLocaleString("id-ID")}` : ""),
        before: {
          sku: partF.sku,
          name: partF.name,
          quantity: partF.quantity,
          buyPrice: partF.buyPrice,
          sellPrice: partF.sellPrice,
          reversedCash: total,
        },
      });
      return total;
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Part gagal dihapus." };
  }

  revalidatePath("/dashboard/stok");
  revalidatePath("/dashboard/kas");
  revalidatePath("/dashboard/laporan");
  return {
    success:
      kasDibatalkan > 0
        ? `Part "${part.name}" dihapus. Kas masuk ${kasDibatalkan.toLocaleString("id-ID")} (pembatalan stok awal).`
        : `Part "${part.name}" dihapus.`,
  };
}

// ─── Stok Masuk (Pembelian) ───────────────────────────────────────────

export async function stockIn(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  const session = await requireStokRole();
  const partId = String(formData.get("partId") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const buyPrice = Number(formData.get("buyPrice") ?? 0);
  const supplierId = String(formData.get("supplierId") ?? "").trim();
  const method = String(formData.get("method") ?? "CASH") as PaymentMethod;
  const note = String(formData.get("note") ?? "").trim();

  if (
    !partId ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(buyPrice) ||
    quantity <= 0 ||
    quantity > MAX_RUPIAH ||
    buyPrice < 0 ||
    buyPrice > MAX_RUPIAH
  ) {
    return { error: "Part, jumlah, dan harga beli tidak valid." };
  }
  if (!["CASH", "TRANSFER", "QRIS"].includes(method)) {
    return { error: "Metode bayar tidak valid." };
  }

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part tidak ditemukan." };
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && part.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
  }

  const total = quantity * buyPrice;

  // Transaksi atomik: qty naik + update harga beli + movement + auto kas keluar.
  // Baris part dikunci dulu (FOR UPDATE) supaya rata-rata dihitung dari angka
  // yang benar-benar terkini saat ada stok masuk/koreksi paralel.
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Part" WHERE id = ${partId} FOR UPDATE`;
    const fresh = await tx.part.findUnique({
      where: { id: partId },
      select: { quantity: true, buyPrice: true },
    });
    if (!fresh) throw new Error("Part tidak ditemukan.");
    // Harga beli part = rata-rata tertimbang sisa stok (bukan harga batch terakhir),
    // supaya nilai persediaan & HPP tidak meleset saat harga beli naik/turun.
    const avgBaru = movingAverageBuyPrice(fresh.quantity, fresh.buyPrice, quantity, buyPrice);
    await tx.part.update({
      where: { id: partId },
      data: { quantity: { increment: quantity }, buyPrice: avgBaru },
    });
    // Konsinyasi: barang titipan supplier — stok & batch cost masuk (HPP benar),
    // tapi TIDAK ada kas keluar (kas baru saat bayar supplier via kas manual).
    // Kas dulu (bila ada) → gerakan stok menunjuk kasnya (cashflowId).
    let cashflowId: string | null = null;
    if (!part.consignment) {
      const cf = await tx.cashflow.create({
        data: {
          type: "EXPENSE",
          category: "Pembelian Part",
          amount: total,
          account: accountFromMethod(method),
          branchId: part.branchId,
          description: `${quantity} ${part.unit} ${part.name}${supplierId ? " (pembelian)" : ""}`,
          createdBy: session.user.id,
        },
      });
      cashflowId = cf.id;
    }
    await tx.stockMovement.create({
      data: {
        partId,
        type: "IN",
        quantity,
        cost: buyPrice,
        note: part.consignment
          ? `Konsinyasi${note ? `: ${note}` : ""}`
          : note || "Pembelian stok",
        userId: session.user.id,
        supplierId: supplierId || null,
        cashflowId,
      },
    });
    await logAudit(tx, session.user, {
      action: "STOCK_IN",
      entityType: "Part",
      entityId: partId,
      branchId: part.branchId,
      summary: part.consignment
        ? `Konsinyasi ${quantity} ${part.unit} ${part.name} @${buyPrice.toLocaleString("id-ID")} (tanpa kas)`
        : `Beli ${quantity} ${part.unit} ${part.name} @${buyPrice.toLocaleString("id-ID")} = ${total.toLocaleString("id-ID")} (${accountFromMethod(method)})`,
      before: { buyPrice: fresh.buyPrice, quantity: fresh.quantity },
      after: { buyPrice: avgBaru, quantity: fresh.quantity + quantity },
    });
  });

  revalidatePath("/dashboard/stok");
  if (part.consignment) {
    return {
      success: `Stok masuk ${quantity} ${part.unit} ${part.name} (konsinyasi, tanpa kas).`,
    };
  }
  return {
    success: `Stok masuk ${quantity} ${part.unit} ${part.name}. Kas keluar ${total.toLocaleString("id-ID")} (${accountFromMethod(method)}).`,
  };
}

// ─── Retur Konsinyasi ───────────────────────────────────────────────────

/**
 * Retur konsinyasi: tarik balik barang titipan yang tidak laku ke supplier.
 * Stok OUT atomik, TANPA kas (barang belum pernah dibeli) dan TANPA beban
 * opname (bukan temuan). Pembayaran supplier untuk yang terjual → kas manual
 * "Bayar konsinyasi" lewat menu Kas.
 */
export async function returKonsinyasi(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  const session = await requireStokRole();
  const partId = String(formData.get("partId") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (
    !partId ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > MAX_RUPIAH
  ) {
    return { error: "Part dan jumlah retur tidak valid." };
  }

  const part = await prisma.part.findUnique({
    where: { id: partId },
    include: { supplier: { select: { nama: true } } },
  });
  if (!part) return { error: "Part tidak ditemukan." };
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && part.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
  }
  if (!part.consignment) {
    return {
      error: "Hanya part konsinyasi yang bisa diretur. Part biasa koreksi lewat Opname.",
    };
  }
  if (part.quantity < quantity) {
    return { error: `Stok ${part.name} kurang (tersisa ${part.quantity}).` };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Part" WHERE id = ${partId} FOR UPDATE`;
      // Guard atomik anti-race: decrement hanya bila stok masih mencukupi di DB.
      const updated = await tx.part.updateMany({
        where: { id: partId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (updated.count === 0) throw new Error(`Stok ${part.name} kurang.`);
      const partF = (await tx.part.findUnique({ where: { id: partId } }))!;

      await tx.stockMovement.create({
        data: {
          partId,
          type: "OUT",
          quantity,
          cost: partF.buyPrice,
          note: `Retur konsinyasi${note ? `: ${note}` : ""}`,
          userId: session.user.id,
          supplierId: partF.supplierId,
        },
      });
      // Tanpa cashflow sengaja: barang titipan, tidak ada uang yang bergerak.
      await logAudit(tx, session.user, {
        action: "STOCK_RETURN",
        entityType: "Part",
        entityId: partId,
        branchId: partF.branchId,
        summary: `Retur ${quantity} ${partF.unit} ${partF.name}${
          part.supplier ? ` ke ${part.supplier.nama}` : ""
        } — tanpa kas (konsinyasi)`,
        before: { quantity: partF.quantity + quantity },
        after: { quantity: partF.quantity },
      });
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Retur gagal." };
  }

  revalidatePath("/dashboard/stok");
  revalidatePath("/dashboard/laporan");
  return {
    success: `Retur ${quantity} ${part.unit} ${part.name} ke supplier${
      part.supplier ? ` (${part.supplier.nama})` : ""
    }. Tanpa kas — barang konsinyasi.`,
  };
}

// ─── Jual Part (tanpa servis/booking) ────────────────────────────────

/**
 * Penjualan part tunai tanpa servis: stok OUT + alokasi FIFO batch +
 * PartSaleItem + Payment (cabang eksplisit) + kas INCOME — atomik 1 transaksi.
 * Balance: omzet Σ payment = kas cashflow = Σ(price−cost)×qty laba penjualan.
 */
export async function sellPart(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  const session = await requireStokRole();
  const partId = String(formData.get("partId") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const method = String(formData.get("method") ?? "CASH") as PaymentMethod;
  const note = String(formData.get("note") ?? "").trim();

  if (!partId) return { error: "Part belum dipilih — pilih satu dari daftar saran." };

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part tidak ditemukan." };
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && part.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
  }
  // Harga jual SELALU dari data part (sama dgn addServicePart) — bukan input kasir.
  const itemError = validasiItemJual(quantity, part.sellPrice);
  if (itemError) return { error: itemError };
  if (!["CASH", "TRANSFER", "QRIS"].includes(method)) {
    return { error: "Metode bayar tidak valid." };
  }
  if (part.quantity < quantity) {
    return { error: `Stok ${part.name} kurang (tersisa ${part.quantity}).` };
  }
  // Validasi jual rugi terjadi saat harga diatur di menu part (PartForm/PartEdit).
  // Penjualan selalu memakai sellPrice data part apa adanya — tanpa konfirmasi di sini.

  let totalAkhir = 0;

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Part" WHERE id = ${partId} FOR UPDATE`;
    // Guard atomik anti-race: decrement hanya bila stok masih mencukupi di DB.
    const updated = await tx.part.updateMany({
      where: { id: partId, quantity: { gte: quantity } },
      data: { quantity: { decrement: quantity } },
    });
    if (updated.count === 0) throw new Error(`Stok ${part.name} kurang.`);

    // Baca ulang SETELAH baris terkunci — harga & HPP FIFO dari angka terkini.
    const partF = await tx.part.findUnique({ where: { id: partId } });
    if (!partF) throw new Error("Part tidak ditemukan.");
    const price = partF.sellPrice;
    const hargaError = validasiItemJual(quantity, price);
    if (hargaError) throw new Error(hargaError);
    const total = quantity * price;
    totalAkhir = total;

    // Alokasi FIFO per-unit (sama dgn servis) — jejak di PartBatchUsage.saleItemId.
    const movements = await tx.stockMovement.findMany({
      where: { partId, type: "IN" },
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
    const { allocations, cost } = allocateFifo(
      quantity,
      openBatches,
      partF.buyPrice,
    );

    const branch = await tx.branch.findUnique({
      where: { id: partF.branchId },
      select: { name: true },
    });
    // Kunci baris cabang SEBELUM hitung urut — serialisasi penomoran kode SL
    // antar penjualan paralel cabang yang sama (count+1 tanpa lock bisa sama
    // → bentrok unique code `PartSale.code` → transaksi gagal).
    await tx.$queryRaw`SELECT id FROM "Branch" WHERE id = ${partF.branchId} FOR UPDATE`;
    const year = new Date().getFullYear();
    const urut = await tx.partSale.count({
      where: {
        branchId: partF.branchId,
        soldAt: { gte: new Date(year, 0, 1) },
      },
    });
    const code = kodePenjualanPart(branch?.name ?? "", year, urut + 1);

    const sale = await tx.partSale.create({
      data: {
        code,
        branchId: partF.branchId,
        method,
        note: note || null,
        createdBy: session.user.id,
      },
    });
    const item = await tx.partSaleItem.create({
      data: { saleId: sale.id, partId, quantity, price, cost },
    });
    for (const a of allocations) {
      await tx.partBatchUsage.create({
        data: {
          movementId: a.movementId,
          saleItemId: item.id,
          quantity: a.quantity,
        },
      });
    }
    const movJual = await tx.stockMovement.create({
      data: {
        partId,
        type: "OUT",
        quantity,
        note: `Dijual ${sale.code}`,
        userId: session.user.id,
      },
    });
    // Kas masuk hanya bila ada nilai — penjualan gratis cukup stok + audit.
    if (total > 0) {
      await tx.payment.create({
        data: {
          saleId: sale.id,
          branchId: partF.branchId,
          amount: total,
          kind: "PELUNASAN",
          method,
          note: `Penjualan ${sale.code}${note ? ` · ${note}` : ""}`,
          receivedById: session.user.id,
        },
      });
      const cf = await tx.cashflow.create({
        data: {
          type: "INCOME",
          category: "Penjualan Part",
          amount: total,
          account: accountFromMethod(method),
          branchId: partF.branchId,
          description: `${quantity} ${partF.unit} ${partF.name} · ${sale.code}`,
          createdBy: session.user.id,
        },
      });
      // Gerakan stok keluar menunjuk kas masuknya.
      await tx.stockMovement.update({
        where: { id: movJual.id },
        data: { cashflowId: cf.id },
      });
    }
    await logAudit(tx, session.user, {
      action: "PART_SALE",
      entityType: "PartSale",
      entityId: sale.id,
      branchId: partF.branchId,
      summary: `${sale.code} · jual ${quantity} ${partF.unit} ${partF.name} @${price.toLocaleString("id-ID")} = ${total.toLocaleString("id-ID")} (${accountFromMethod(method)}) — HPP/unit ${cost.toLocaleString("id-ID")}`,
      after: { quantity, price, cost, total, method },
    });
  });

  revalidatePath("/dashboard/stok");
  revalidatePath("/dashboard/kas");
  revalidatePath("/dashboard/laporan");
  return {
    success: `Penjualan ${quantity} ${part.unit} ${part.name} tercatat — stok berkurang, kas masuk ${totalAkhir.toLocaleString("id-ID")}.`,
  };
}

// ─── Penyesuaian ──────────────────────────────────────────────────────

export async function adjustStock(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  const session = await requireStokRole();
  const partId = String(formData.get("partId") ?? "").trim();
  const delta = Number(formData.get("delta") ?? 0);
  const reason = String(formData.get("reason") ?? "").trim();

  if (
    !partId ||
    !Number.isFinite(delta) ||
    delta === 0 ||
    Math.abs(delta) > MAX_RUPIAH
  ) {
    return { error: "Part dan selisih tidak valid." };
  }
  if (!reason) return { error: "Alasan penyesuaian wajib diisi." };

  const part = await prisma.part.findUnique({ where: { id: partId } });
  if (!part) return { error: "Part tidak ditemukan." };
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && part.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
  }
  if (part.quantity + delta < 0) {
    return { error: `Stok tidak boleh negatif (tersisa ${part.quantity}).` };
  }

  const type = delta > 0 ? "IN" : "OUT";
  const absDelta = Math.abs(delta);

  const ok = await prisma.$transaction(async (tx) => {
    // Guard atomik anti-race: decrement hanya bila stok masih mencukupi di DB.
    const updated = await tx.part.updateMany({
      where: {
        id: partId,
        ...(delta < 0 ? { quantity: { gte: -delta } } : {}),
      },
      data: { quantity: { increment: delta } },
    });
    if (updated.count === 0) return false;
    // Baca ulang buyPrice SETELAH baris terkunci — snapshot cost gerakan harus
    // memakai rata-rata terbaru (bisa berubah oleh stok masuk paralel).
    const fresh = await tx.part.findUnique({
      where: { id: partId },
      select: { buyPrice: true },
    });
    await tx.stockMovement.create({
      data: {
        partId,
        type,
        quantity: absDelta,
        cost: fresh?.buyPrice ?? part.buyPrice,
        note: `Penyesuaian: ${reason}`,
        userId: session.user.id,
      },
    });
    await logAudit(tx, session.user, {
      action: "STOCK_ADJUST",
      entityType: "Part",
      entityId: partId,
      branchId: part.branchId,
      summary: `${part.name}: ${delta > 0 ? "+" : ""}${delta} → ${part.quantity + delta} — ${reason}`,
      before: { quantity: part.quantity },
      after: { quantity: part.quantity + delta, reason },
    });
    return true;
  });
  if (!ok) {
    return { error: `Stok tidak boleh negatif (tersisa ${part.quantity}).` };
  }

  revalidatePath("/dashboard/stok");
  return {
    success: `Stok ${part.name} disesuaikan ${delta > 0 ? "+" : ""}${delta} → ${part.quantity + delta}.`,
  };
}

// ─── Koreksi Harga Beli per Batch ─────────────────────────────────────

/**
 * Koreksi harga beli satu batch (typo input stok masuk) — otomatis 4 langkah:
 * 1. riwayat batch (StockMovement.cost), 2. rata-rata buyPrice part,
 * 3. HPP servis yang unitnya diambil dari batch ini (TERBATAS jumlah unit terpakai, dari jejak PartBatchUsage),
 * 4. kas koreksi senilai selisih penuh batch, bertanggal pembelian asli —
 *    HANYA bila pembelian aslinya tercatat di kas; stok awal kini ikut tercatat
 *    kas sejak v1.4, sedangkan penyesuaian/opname tidak memindahkan uang,
 *    jadi kas tidak diutak-atik (tidak membuat kas fiktif).
 * Harga jual (sellPrice) tidak pernah disentuh.
 */
export async function correctStockCost(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  const session = await requireStokRole();
  const movementId = String(formData.get("movementId") ?? "").trim();
  const newCost = Number(formData.get("cost") ?? 0);

  if (
    !movementId ||
    !Number.isFinite(newCost) ||
    newCost < 0 ||
    newCost > MAX_RUPIAH
  ) {
    return { error: "Harga beli tidak valid." };
  }

  const movement = await prisma.stockMovement.findUnique({
    where: { id: movementId },
    include: { part: true },
  });
  if (!movement || movement.type !== "IN") {
    return { error: "Batch pembelian tidak ditemukan." };
  }
  const part = movement.part;
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && part.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
  }

  if (movement.cost === null) {
    return {
      error: "Batch ini bukan pembelian (tanpa harga tercatat) — tidak bisa dikoreksi.",
    };
  }
  if (movement.cost === newCost) {
    return { error: "Harga sama dengan harga batch saat ini." };
  }

  // Diisi di dalam transaksi (setelah baris part dikunci, baca ulang data terkini).
  let costLama = movement.cost;
  let x = 0;
  let avgBaru = part.buyPrice;
  let kasDelta = 0;
  let kasTercatat = false;
  let serviceCount = 0;
  let saleCount = 0;

  // Kunci baris part (pola FOR UPDATE sama dengan addPayment) — serialisasi
  // dengan stok masul/servis/koreksi paralel; semua baca ulang dilakukan SETELAH
  // kunci supaya tidak ada pembacaan basi yang menimpa angka orang lain.
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Part" WHERE id = ${part.id} FOR UPDATE`;
    const partF = await tx.part.findUnique({
      where: { id: part.id },
      select: { quantity: true, buyPrice: true },
    });
    const mvF = await tx.stockMovement.findUnique({
      where: { id: movementId },
      select: { quantity: true, cost: true, createdAt: true },
    });
    if (!partF || !mvF || mvF.cost === null) {
      throw new Error("Batch pembelian tidak ditemukan.");
    }
    costLama = mvF.cost;

    // Jejak unit terpakai dari batch ini → x: batas koreksi HPP, tidak melebar.
    // Unit bisa terikat servis (servicePart) atau penjualan part (saleItem).
    const usages = await tx.partBatchUsage.findMany({
      where: { movementId },
      include: { servicePart: true, saleItem: true },
    });
    x = usages.reduce((s, u) => s + u.quantity, 0);
    const perSp = new Map<
      string,
      { qty: number; sp: NonNullable<(typeof usages)[number]["servicePart"]> }
    >();
    const perItem = new Map<
      string,
      { qty: number; item: NonNullable<(typeof usages)[number]["saleItem"]> }
    >();
    for (const u of usages) {
      if (u.servicePartId && u.servicePart) {
        const cur = perSp.get(u.servicePartId);
        if (cur) cur.qty += u.quantity;
        else perSp.set(u.servicePartId, { qty: u.quantity, sp: u.servicePart });
      } else if (u.saleItemId && u.saleItem) {
        const cur = perItem.get(u.saleItemId);
        if (cur) cur.qty += u.quantity;
        else perItem.set(u.saleItemId, { qty: u.quantity, item: u.saleItem });
      }
    }
    serviceCount = perSp.size;
    saleCount = perItem.size;

    // 1. Riwayat batch
    await tx.stockMovement.update({
      where: { id: movementId },
      data: { cost: newCost },
    });
    // 2. Rata-rata harga beli part — dampak hanya sisa batch yang masih di stok
    avgBaru = estimateAvgAfterCostCorrection(
      mvF.quantity,
      x,
      costLama,
      newCost,
      partF.buyPrice,
      partF.quantity,
    );
    await tx.part.update({
      where: { id: part.id },
      data: { buyPrice: avgBaru },
    });
    // 3. HPP servis terdampak — hanya porsi unit dari batch ini (total x)
    for (const [, { qty, sp }] of perSp) {
      const newSpCost = correctedServiceCost(
        sp.cost,
        sp.quantity,
        qty,
        costLama,
        newCost,
      );
      if (newSpCost !== sp.cost) {
        await tx.servicePart.update({
          where: { id: sp.id },
          data: { cost: newSpCost },
        });
      }
    }
    // 3b. HPP penjualan part terdampak — formula sama, unit terbatas jejak batch.
    for (const [, { qty, item }] of perItem) {
      const newCostItem = correctedServiceCost(
        item.cost,
        item.quantity,
        qty,
        costLama,
        newCost,
      );
      if (newCostItem !== item.cost) {
        await tx.partSaleItem.update({
          where: { id: item.id },
          data: { cost: newCostItem },
        });
      }
    }
    // 4. Kas koreksi bertanggal pembelian asli — hanya bila pembeliannya
    //    memang tercatat di kas (stok awal ikut tercatat; penyesuaian tidak).
    kasDelta = mvF.quantity * (newCost - costLama);
    const origCash = await tx.cashflow.findFirst({
      where: {
        type: "EXPENSE",
        category: "Pembelian Part",
        amount: mvF.quantity * costLama,
        branchId: part.branchId,
        createdAt: {
          gte: new Date(mvF.createdAt.getTime() - 86_400_000),
          lte: new Date(mvF.createdAt.getTime() + 86_400_000),
        },
      },
      orderBy: { createdAt: "asc" },
    });
    kasTercatat = Boolean(origCash);
    if (kasDelta !== 0 && origCash) {
      await tx.cashflow.create({
        data: {
          type: kasDelta > 0 ? "EXPENSE" : "INCOME",
          category: "Koreksi Pembelian Part",
          amount: Math.abs(kasDelta),
          account: origCash.account,
          branchId: part.branchId,
          description: `Koreksi harga beli ${part.name} @${costLama} → @${newCost} (${mvF.quantity} ${part.unit})`,
          createdBy: session.user.id,
          createdAt: mvF.createdAt,
        },
      });
    }
    await logAudit(tx, session.user, {
      action: "STOCK_COST_CORRECT",
      entityType: "StockMovement",
      entityId: movementId,
      branchId: part.branchId,
      summary: `${part.name}: batch ${mvF.quantity} @${costLama} → @${newCost} · ${perSp.size} servis / ${perItem.size} penjualan / ${x} unit terdampak · kas ${kasDelta === 0 ? "±0" : kasTercatat ? `${kasDelta > 0 ? "+" : "−"}${Math.abs(kasDelta)}` : "dilewati (bukan pembelian)"} · rata-rata → ${avgBaru}`,
      before: { cost: costLama, buyPrice: partF.buyPrice },
      after: {
        cost: newCost,
        buyPrice: avgBaru,
        affectedServices: perSp.size,
        affectedSales: perItem.size,
        affectedUnits: x,
      },
    });
  });

  revalidatePath("/dashboard/stok");
  revalidatePath("/dashboard/laporan");

  const efek = [
    `Harga batch ${part.name} @${costLama} → @${newCost}`,
    `rata-rata → ${avgBaru}`,
  ];
  if (serviceCount > 0) efek.push(`${serviceCount} servis (${x} unit) ikut dikoreksi`);
  if (saleCount > 0) efek.push(`${saleCount} penjualan part ikut dikoreksi`);
  if (kasDelta !== 0) {
    efek.push(
      kasTercatat
        ? `kas ${kasDelta > 0 ? "+" : "−"}${Math.abs(kasDelta).toLocaleString("id-ID")}`
        : "kas tidak dikoreksi (bukan pembelian tercatat)",
    );
  }
  return { success: efek.join(" · ") + "." };
}
