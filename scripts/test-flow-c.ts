import { PrismaClient } from "@db/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const branch = await prisma.branch.findFirst({ where: { name: "Pusat" } });
  if (!branch) throw new Error("Branch Pusat tidak ada");
  const owner = await prisma.user.findFirst({ where: { email: "owner@revledger.id" } });
  if (!owner) throw new Error("Owner tidak ada");

  const sku = "TEST-" + Date.now().toString().slice(-5);
  console.log("1. Buat part...");
  const part = await prisma.part.create({
    data: {
      branchId: branch.id, sku, name: "Part Tes Fase C", unit: "pcs",
      quantity: 10, minStock: 3, buyPrice: 10000, sellPrice: 15000,
    },
  });
  console.log("   OK part:", part.sku, "qty", part.quantity);

  console.log("2. Stok masuk 5 @12000 via TRANSFER (auto kas keluar BANK)...");
  const qtyIn = 5, buyPrice = 12000, total = qtyIn * buyPrice;
  const [pAfter, movement, cashflow] = await prisma.$transaction([
    prisma.part.update({
      where: { id: part.id },
      data: { quantity: { increment: qtyIn }, buyPrice },
    }),
    prisma.stockMovement.create({
      data: { partId: part.id, type: "IN", quantity: qtyIn, cost: buyPrice,
        note: "Pembelian stok", userId: owner.id },
    }),
    prisma.cashflow.create({
      data: { type: "EXPENSE", category: "Pembelian Part", amount: total,
        account: "BANK", branchId: branch.id,
        description: `${qtyIn} pcs Part Tes Fase C`, createdBy: owner.id },
    }),
  ]);
  console.log("   OK qty:", pAfter.quantity, "| buyPrice:", pAfter.buyPrice,
    "| movement:", movement.type, movement.quantity, "cost", movement.cost,
    "| kas keluar:", cashflow.amount, cashflow.account);
  if (pAfter.quantity !== 15) throw new Error("Qty salah, expect 15");
  if (pAfter.buyPrice !== 12000) throw new Error("buyPrice tidak ter-update");
  if (cashflow.account !== "BANK") throw new Error("Kantong salah, expect BANK");

  console.log("3. Stok keluar via servis (snapshot HPP)...");
  const [pAfterOut, outMov] = await prisma.$transaction([
    prisma.part.update({ where: { id: part.id }, data: { quantity: { decrement: 2 } } }),
    prisma.stockMovement.create({
      data: { partId: part.id, type: "OUT", quantity: 2, cost: pAfter.buyPrice,
        note: "Dipakai servis", userId: owner.id },
    }),
  ]);
  console.log("   OK qty:", pAfterOut.quantity, "| snapshot HPP/out:", outMov.cost);
  if (pAfterOut.quantity !== 13) throw new Error("Qty OUT salah, expect 13");

  console.log("4. Penyesuaian −5 (wajib alasan)...");
  const [pAfterAdj, adjMov] = await prisma.$transaction([
    prisma.part.update({ where: { id: part.id }, data: { quantity: { decrement: 5 } } }),
    prisma.stockMovement.create({
      data: { partId: part.id, type: "OUT", quantity: 5,
        note: "Penyesuaian: Opname fisik", userId: owner.id },
    }),
  ]);
  console.log("   OK qty:", pAfterAdj.quantity, "|", adjMov.note);
  if (pAfterAdj.quantity !== 8) throw new Error("Qty adj salah, expect 8");

  console.log("5. Alert menipis (qty 8 > min 3 = tidak menipis)...");
  const low = pAfterAdj.quantity <= pAfterAdj.minStock;
  console.log("   low?", low, "(expect false)");
  if (low) throw new Error("Seharusnya tidak menipis");

  console.log("6. Nilai persediaan...");
  const nilai = pAfterAdj.quantity * pAfterAdj.buyPrice;
  console.log("   OK nilai:", nilai, "(8 × 12000)");

  console.log("7. Cek unik SKU per cabang...");
  let dupErr = false;
  try {
    await prisma.part.create({
      data: { branchId: branch.id, sku, name: "Dup", quantity: 0 },
    });
  } catch { dupErr = true; }
  console.log("   dup rejected?", dupErr, "(expect true)");
  if (!dupErr) throw new Error("Duplikat SKU seharusnya ditolak");

  console.log("8. Bersihkan data tes...");
  await prisma.cashflow.deleteMany({ where: { description: { contains: "Part Tes Fase C" } } });
  await prisma.stockMovement.deleteMany({ where: { partId: part.id } });
  await prisma.part.delete({ where: { id: part.id } });
  console.log("   OK dibersihkan");

  console.log("\n=== FASE C DATA FLOW: SEMUA LULUS ✅ ===");
}

main().finally(() => prisma.$disconnect());
