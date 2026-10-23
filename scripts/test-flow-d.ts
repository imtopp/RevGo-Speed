import { PrismaClient } from "@db/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function totalTagihan(laborCost: number, parts: { price: number; quantity: number }[]) {
  return laborCost + parts.reduce((s, p) => s + p.price * p.quantity, 0);
}

async function main() {
  const branch = await prisma.branch.findFirst({ where: { name: "Pusat" } });
  const owner = await prisma.user.findFirst({ where: { email: "owner@revledger.id" } });
  if (!branch || !owner) throw new Error("Seed data kurang");

  // Buat customer + vehicle + part + servis tes
  const part = await prisma.part.create({
    data: { branchId: branch.id, sku: `BD-${Date.now().toString().slice(-5)}`, name: "Part Tes D", unit: "pcs", quantity: 50, buyPrice: 50000, sellPrice: 80000 },
  });
  const cust = await prisma.user.create({
    data: { name: "Tes Bayar", email: `bayar${Date.now()}@t.co`, role: "CUSTOMER", passwordHash: "x" },
  });
  const veh = await prisma.vehicle.create({
    data: { ownerId: cust.id, brand: "Honda", model: "Brio", plateNumber: `BLT${Date.now().toString().slice(-4)}` },
  });
  const serv = await prisma.service.create({
    data: {
      code: `TES-${Date.now().toString().slice(-5)}`, branchId: branch.id, vehicleId: veh.id,
      customerId: cust.id, status: "DONE", laborCost: 100000,
      parts: { create: [{ partId: part.id, quantity: 2, price: 80000, cost: 50000 }] },
    },
  });

  const total = totalTagihan(100000, [{ price: 80000, quantity: 2 }]);
  console.log("1. Total tagihan:", total, "(expect 260000)");
  if (total !== 260000) throw new Error("Total salah");

  // Helper mirror addPayment
  async function bayar(amount: number, kind: "DP" | "PELUNASAN", method: "CASH" | "TRANSFER" | "QRIS") {
    const s = await prisma.service.findUnique({
      where: { id: serv.id },
      include: { parts: { select: { price: true, quantity: true } }, payments: { select: { amount: true } } },
    });
    const tot = totalTagihan(s!.laborCost, s!.parts);
    const paid = s!.payments.reduce((x, p) => x + p.amount, 0);
    const remaining = tot - paid;
    if (amount > remaining) throw new Error(`OVERPAY: ${amount} > ${remaining}`);
    const account = method === "CASH" ? "KAS" : "BANK";
    await prisma.$transaction([
      prisma.payment.create({ data: { serviceId: serv.id, amount, kind, method, receivedById: owner.id } }),
      prisma.cashflow.create({
        data: { type: "INCOME", category: kind === "DP" ? "DP Servis" : "Pembayaran Servis",
          amount, account: account as any, branchId: branch.id, description: serv.code, createdBy: owner.id },
      }),
    ]);
    return { paid: paid + amount, remaining: remaining - amount };
  }

  console.log("2. DP 100rb CASH...");
  let r = await bayar(100000, "DP", "CASH");
  console.log("   paid:", r.paid, "sisa:", r.remaining);
  if (r.remaining !== 160000) throw new Error("Sisa DP salah");

  console.log("3. Pelunasan 160rb TRANSFER...");
  r = await bayar(160000, "PELUNASAN", "TRANSFER");
  console.log("   paid:", r.paid, "sisa:", r.remaining, "(lunas!)");
  if (r.remaining !== 0) throw new Error("Seharusnya lunas");

  console.log("4. Cek overpay ditolak...");
  let overpayRejected = false;
  try { await bayar(1, "PELUNASAN", "CASH"); } catch { overpayRejected = true; }
  console.log("   overpay rejected?", overpayRejected, "(expect true)");
  if (!overpayRejected) throw new Error("Overpay seharusnya ditolak");

  console.log("5. Cek kas masuk tercatat...");
  const flows = await prisma.cashflow.findMany({ where: { description: serv.code } });
  const totalMasuk = flows.reduce((s, f) => s + f.amount, 0);
  console.log("   kas masuk:", totalMasuk, "dari", flows.length, "entri", flows.map(f => `${f.account}:${f.amount}`).join(", "));
  if (totalMasuk !== 260000) throw new Error("Total kas masuk salah");
  if (flows.some(f => f.type !== "INCOME")) throw new Error("Harus INCOME");

  console.log("6. Cek piutang filter (servis ini lunas → tidak muncul)...");
  const allActive = await prisma.service.findMany({
    where: { id: serv.id, status: { not: "CANCELLED" } },
    include: { parts: { select: { price: true, quantity: true } }, payments: { select: { amount: true } } },
  });
  const out = allActive.map(s => {
    const tot = totalTagihan(s.laborCost, s.parts);
    const paid = s.payments.reduce((x, p) => x + p.amount, 0);
    return { ...s, remaining: tot - paid };
  }).filter(s => s.remaining > 0);
  console.log("   outstanding count untuk servis ini:", out.length, "(expect 0)");
  if (out.length !== 0) throw new Error("Seharusnya lunas, tidak ada piutang");

  console.log("7. Kas manual (pengeluaran operasional)...");
  const cf = await prisma.cashflow.create({
    data: { type: "EXPENSE", category: "Operasional", amount: 50000, account: "KAS",
      branchId: branch.id, description: "Listrik", createdBy: owner.id },
  });
  console.log("   OK expense:", cf.category, cf.amount, cf.account);

  console.log("8. Bersihkan...");
  await prisma.cashflow.deleteMany({ where: { description: serv.code } });
  await prisma.cashflow.delete({ where: { id: cf.id } });
  await prisma.payment.deleteMany({ where: { serviceId: serv.id } });
  await prisma.servicePart.deleteMany({ where: { serviceId: serv.id } });
  await prisma.service.delete({ where: { id: serv.id } });
  await prisma.vehicle.delete({ where: { id: veh.id } });
  await prisma.part.delete({ where: { id: part.id } });
  await prisma.user.delete({ where: { id: cust.id } });
  console.log("   OK dibersihkan");

  console.log("\n=== FASE D DATA FLOW: SEMUA LULUS ✅ ===");
}

main().finally(() => prisma.$disconnect());
