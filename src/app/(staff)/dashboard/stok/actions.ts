"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStaffBranchId } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import { samakanKategori } from "@/lib/category";
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
  await requireStokRole();
  const nama = String(formData.get("nama") ?? "").trim();
  const telepon = String(formData.get("telepon") ?? "").trim();
  const catatan = String(formData.get("catatan") ?? "").trim();
  if (!nama) return { error: "Nama supplier wajib diisi." };

  await prisma.supplier.create({
    data: { nama, telepon: telepon || null, catatan: catatan || null },
  });
  revalidatePath("/dashboard/stok");
  return { success: `Supplier "${nama}" ditambahkan.` };
}

export async function updateSupplier(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  await requireStokRole();
  const id = String(formData.get("id") ?? "").trim();
  const nama = String(formData.get("nama") ?? "").trim();
  const telepon = String(formData.get("telepon") ?? "").trim();
  const catatan = String(formData.get("catatan") ?? "").trim();
  const aktif = formData.get("aktif") === "on";
  if (!id || !nama) return { error: "Data tidak lengkap." };

  await prisma.supplier.update({
    where: { id },
    data: { nama, telepon: telepon || null, catatan: catatan || null, aktif },
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
  const sku = String(formData.get("sku") ?? "").trim().toUpperCase();
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

  if (!branchId || !sku || !name) return { error: "Cabang, SKU, dan nama wajib diisi." };
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

  // Cek SKU unik per cabang
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
      },
    });
    // Stok awal = pembelian: modal tertahan di barang, jadi uangnya keluar
    // sekarang juga dalam transaksi yang sama — saldo kas/laporan tetap
    // sama dengan uang fisik (kas tidak "hilang" tanpa baris).
    if (quantity > 0) {
      await tx.stockMovement.create({
        data: {
          partId: p.id,
          type: "IN",
          quantity,
          cost: buyPrice,
          note: "Stok awal",
          userId: session.user.id,
          supplierId: supplierId || null,
        },
      });
      if (total > 0) {
        await tx.cashflow.create({
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
      }
    }
  });
  revalidatePath("/dashboard/stok");
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

  if (!id || !name) return { error: "Data tidak lengkap." };
  if (minStock < 0 || sellPrice < 0) {
    return { error: "Nilai tidak boleh negatif." };
  }

  const prev = await prisma.part.findUnique({ where: { id } });
  if (!prev) return { error: "Part tidak ditemukan." };
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && prev.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
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
    await tx.stockMovement.create({
      data: {
        partId,
        type: "IN",
        quantity,
        cost: buyPrice,
        note: note || "Pembelian stok",
        userId: session.user.id,
        supplierId: supplierId || null,
      },
    });
    await tx.cashflow.create({
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
    await logAudit(tx, session.user, {
      action: "STOCK_IN",
      entityType: "Part",
      entityId: partId,
      branchId: part.branchId,
      summary: `Beli ${quantity} ${part.unit} ${part.name} @${buyPrice.toLocaleString("id-ID")} = ${total.toLocaleString("id-ID")} (${accountFromMethod(method)})`,
      before: { buyPrice: fresh.buyPrice, quantity: fresh.quantity },
      after: { buyPrice: avgBaru, quantity: fresh.quantity + quantity },
    });
  });

  revalidatePath("/dashboard/stok");
  return {
    success: `Stok masuk ${quantity} ${part.unit} ${part.name}. Kas keluar ${total.toLocaleString("id-ID")} (${accountFromMethod(method)}).`,
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
    await tx.stockMovement.create({
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
      await tx.cashflow.create({
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
