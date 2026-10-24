import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const p = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const go = process.argv.includes("--go");

// ── Kumpulkan target data test ─────────────────────────────
const testUsers = await p.user.findMany({
  where: {
    OR: [
      { email: { contains: "bayar" } },
      { email: { contains: "flow-" } },
      { email: { contains: "mek-" } },
    ],
  },
  select: { id: true, name: true, email: true, role: true },
});
const userIds = testUsers.map((u) => u.id);

const vehicles = await p.vehicle.findMany({
  where: {
    OR: [{ plateNumber: "BLT7005" }, { ownerId: { in: userIds } }],
  },
  select: { id: true, plateNumber: true, brand: true, model: true, ownerId: true },
});
const vehicleIds = vehicles.map((v) => v.id);

const services = await p.service.findMany({
  where: {
    OR: [
      { vehicleId: { in: vehicleIds } },
      { customerId: { in: userIds } },
      { code: { startsWith: "SV-TEST-" } },
    ],
  },
  select: { id: true, code: true, status: true, laborCost: true, customerId: true, vehicleId: true },
});
const serviceIds = services.map((s) => s.id);
const codes = services.map((s) => s.code);

const payments = await p.payment.findMany({
  where: { serviceId: { in: serviceIds } },
  select: { id: true, amount: true, method: true, voidedAt: true },
});
const cashflows = await p.cashflow.findMany({
  where: {
    OR: [
      { description: { contains: "SV-TEST-" } },
      ...codes.map((c) => ({ description: { contains: c } })),
      { createdBy: { in: userIds } },
    ],
  },
  select: { id: true, type: true, amount: true, description: true },
});
const testParts = await p.part.findMany({
  where: { sku: { startsWith: "TP-" } },
  select: { id: true, sku: true, name: true, quantity: true },
});

console.log("=== TARGET HAPUS ===");
console.log("Users   :", testUsers);
console.log("Vehicles:", vehicles);
console.log("Services:", services);
console.log("Payments:", payments.length, "total", payments.reduce((s, x) => s + x.amount, 0));
console.log("Cashflow:", cashflows);
console.log("TP parts:", testParts);
console.log("mode    :", go ? "GO (eksekusi)" : "DRY-RUN");

if (!go) {
  await p.$disconnect();
  process.exit(0);
}

// ── Eksekusi urut (FK restrict) dalam transaksi ────────────
await p.$transaction(async (tx) => {
  await tx.servicePart.deleteMany({ where: { serviceId: { in: serviceIds } } });
  await tx.payment.deleteMany({ where: { serviceId: { in: serviceIds } } });
  await tx.cashflow.deleteMany({ where: { id: { in: cashflows.map((c) => c.id) } } });
  await tx.service.deleteMany({ where: { id: { in: serviceIds } } });
  await tx.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
  await tx.stockMovement.deleteMany({ where: { partId: { in: testParts.map((x) => x.id) } } });
  await tx.part.deleteMany({ where: { id: { in: testParts.map((x) => x.id) } } });
  await tx.user.deleteMany({ where: { id: { in: userIds } } });
});

console.log("cleanup done");
await p.$disconnect();
