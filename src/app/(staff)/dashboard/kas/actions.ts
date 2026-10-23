"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getStaffBranchId } from "@/lib/guard";
import { revalidatePath } from "next/cache";
import type { PaymentKind, PaymentMethod, CashflowType, CashflowAccount } from "@db/prisma/client";

export type BayarState = { error?: string; success?: string };

async function requireKasRole() {
  const session = await auth();
  if (!session?.user) throw new Error("Belum login.");
  if (!["OWNER", "SYS_ADMIN", "ADMIN"].includes(session.user.role)) {
    throw new Error("Tidak punya akses.");
  }
  return session;
}

function accountFromMethod(method: PaymentMethod): CashflowAccount {
  return method === "CASH" ? "KAS" : "BANK";
}

/** Total tagihan servis = biaya jasa + Σ(part.hargaJual × qty). */
function totalTagihan(
  laborCost: number,
  parts: { price: number; quantity: number }[],
): number {
  return laborCost + parts.reduce((s, p) => s + p.price * p.quantity, 0);
}

// ─── Bayar Servis (DP / Pelunasan) ────────────────────────────────────

export async function addPayment(
  _prev: BayarState,
  formData: FormData,
): Promise<BayarState> {
  const session = await requireKasRole();
  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const kind = String(formData.get("kind") ?? "PELUNASAN") as PaymentKind;
  const method = String(formData.get("method") ?? "CASH") as PaymentMethod;
  const note = String(formData.get("note") ?? "").trim();

  if (!serviceId || amount <= 0) return { error: "Jumlah bayar tidak valid." };
  if (!["DP", "PELUNASAN"].includes(kind)) return { error: "Jenis bayar tidak valid." };
  if (!["CASH", "QRIS", "TRANSFER"].includes(method)) return { error: "Metode tidak valid." };

  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: {
      parts: { select: { price: true, quantity: true } },
      payments: { select: { amount: true } },
      customer: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  if (!service) return { error: "Servis tidak ditemukan." };
  if (service.status === "CANCELLED") return { error: "Servis dibatalkan, tidak bisa dibayar." };

  const total = totalTagihan(service.laborCost, service.parts);
  const paid = service.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - paid;

  if (amount > remaining) {
    return { error: `Melebihi sisa tagihan (${remaining.toLocaleString("id-ID")}).` };
  }

  const category = kind === "DP" ? "DP Servis" : "Pembayaran Servis";

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        serviceId,
        amount,
        kind,
        method,
        note: note || null,
        receivedById: session.user.id,
      },
    }),
    prisma.cashflow.create({
      data: {
        type: "INCOME",
        category,
        amount,
        account: accountFromMethod(method),
        branchId: service.branchId,
        description: `${service.code} · ${service.customer.name}`,
        createdBy: session.user.id,
      },
    }),
  ]);

  revalidatePath(`/dashboard/servis/${serviceId}`);
  revalidatePath("/dashboard/kas");
  revalidatePath("/dashboard/piutang");

  const sisa = remaining - amount;
  return {
    success:
      sisa === 0
        ? `Lunas! ${amount.toLocaleString("id-ID")} diterima (${accountFromMethod(method)}).`
        : `Terima ${amount.toLocaleString("id-ID")}. Sisa tagihan ${sisa.toLocaleString("id-ID")}.`,
  };
}

// ─── Kas Manual (pendapatan / pengeluaran operasional) ────────────────

export async function addManualCashflow(
  _prev: BayarState,
  formData: FormData,
): Promise<BayarState> {
  await requireKasRole();
  const branchIdStaff = await getStaffBranchId();

  const type = String(formData.get("type") ?? "INCOME") as CashflowType;
  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const account = String(formData.get("account") ?? "KAS") as CashflowAccount;
  const description = String(formData.get("description") ?? "").trim();
  const branchId = String(formData.get("branchId") ?? "").trim() || branchIdStaff || "";

  if (!["INCOME", "EXPENSE"].includes(type)) return { error: "Tipe kas tidak valid." };
  if (!category || amount <= 0 || !branchId) return { error: "Kategori, jumlah, dan cabang wajib diisi." };
  if (!["KAS", "BANK"].includes(account)) return { error: "Kantong tidak valid." };

  const session = await auth();

  await prisma.cashflow.create({
    data: {
      type,
      category,
      amount,
      account,
      branchId,
      description: description || null,
      createdBy: session?.user?.id ?? null,
    },
  });

  revalidatePath("/dashboard/kas");
  return { success: `Kas ${type === "INCOME" ? "masuk" : "keluar"} ${amount.toLocaleString("id-ID")} (${account}) dicatat.` };
}
