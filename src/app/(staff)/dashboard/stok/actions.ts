"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStaffBranchId } from "@/lib/guard";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
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
  const category = String(formData.get("category") ?? "").trim();
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

  await prisma.part.create({
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
  revalidatePath("/dashboard/stok");
  return { success: `Part "${name}" ditambahkan.` };
}

export async function updatePart(
  _prev: StokState,
  formData: FormData,
): Promise<StokState> {
  await requireStokRole();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const unit = String(formData.get("unit") ?? "pcs").trim();
  const minStock = Number(formData.get("minStock") ?? 0);
  const buyPrice = Number(formData.get("buyPrice") ?? 0);
  const sellPrice = Number(formData.get("sellPrice") ?? 0);
  const supplierId = String(formData.get("supplierId") ?? "").trim();

  if (!id || !name) return { error: "Data tidak lengkap." };
  if (minStock < 0 || buyPrice < 0 || sellPrice < 0) {
    return { error: "Nilai tidak boleh negatif." };
  }

  const prev = await prisma.part.findUnique({ where: { id } });
  if (!prev) return { error: "Part tidak ditemukan." };
  const branchIdStaff = await getStaffBranchId();
  if (branchIdStaff && prev.branchId !== branchIdStaff) {
    return { error: "Part bukan di cabang Anda." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.part.update({
      where: { id },
      data: {
        name,
        category: category || null,
        unit,
        minStock,
        buyPrice,
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
        summary: `${name} · harga beli ${prev.buyPrice.toLocaleString("id-ID")} → ${buyPrice.toLocaleString("id-ID")}, harga jual ${prev.sellPrice.toLocaleString("id-ID")} → ${sellPrice.toLocaleString("id-ID")}`,
        before: { buyPrice: prev.buyPrice, sellPrice: prev.sellPrice, name: prev.name, minStock: prev.minStock },
        after: { buyPrice, sellPrice, name, minStock },
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

  // Transaksi atomik: qty naik + update harga beli + movement + auto kas keluar
  await prisma.$transaction(async (tx) => {
    await tx.part.update({
      where: { id: partId },
      data: { quantity: { increment: quantity }, buyPrice },
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
      before: { buyPrice: part.buyPrice, quantity: part.quantity },
      after: { buyPrice, quantity: part.quantity + quantity },
    });
  });

  revalidatePath("/dashboard/stok");
  return {
    success: `Stok masuk ${quantity} ${part.unit} ${part.name}. Kas keluar ${total.toLocaleString("id-ID")} (${accountFromMethod(method)}).`,
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
    await tx.stockMovement.create({
      data: {
        partId,
        type,
        quantity: absDelta,
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
