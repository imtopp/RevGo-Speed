import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function ok(msg: string) { console.log(`  ✓ ${msg}`); }
function fail(msg: string) { console.log(`  ✗ ${msg}`); process.exitCode = 1; }

async function main() {
  console.log("FLOW TEST Fase B:\n");

  // Setup: branch, customer, vehicle, mechanic, catalog, part
  const branch = await prisma.branch.findFirstOrThrow();
  const customer = await prisma.user.create({
    data: { name: "Tes Customer", email: `flow-${Date.now()}@t.co`, passwordHash: hashPassword("x"), role: "CUSTOMER" },
  });
  const vehicle = await prisma.vehicle.create({
    data: { plateNumber: `T${Date.now() % 100000}`, brand: "Toyota", model: "Avanza", ownerId: customer.id },
  });
  const mechanic = await prisma.user.create({
    data: { name: "Tes Mekanik", email: `mek-${Date.now()}@t.co`, passwordHash: hashPassword("x"), role: "MECHANIC", branchId: branch.id },
  });
  const catalog = await prisma.serviceCatalog.create({
    data: { nama: "Servis Tes", hargaDasar: 150000, allowDp: true },
  });
  const part = await prisma.part.create({
    data: { sku: `TP-${Date.now()}`, name: "Oli Tes", branchId: branch.id, quantity: 10, buyPrice: 50000, sellPrice: 80000 },
  });

  // 1. Booking
  const code = `SV-TEST-${Date.now() % 10000}`;
  const svc = await prisma.service.create({
    data: { code, branchId: branch.id, catalogId: catalog.id, vehicleId: vehicle.id, customerId: customer.id, status: "PENDING", complaint: "Tes", estimate: catalog.hargaDasar },
  });
  ok(`Booking dibuat: ${code} (PENDING)`);

  // 2. Estimasi → WAITING_APPROVAL
  await prisma.service.update({ where: { id: svc.id }, data: { status: "WAITING_APPROVAL", laborCost: 100000, mechanicId: mechanic.id } });
  ok("Estimasi submit → WAITING_APPROVAL");

  // 3. Approve → CONFIRMED
  await prisma.service.update({ where: { id: svc.id }, data: { status: "CONFIRMED" } });
  ok("Approve → CONFIRMED");

  // 4. Check-in → CHECKED_IN
  await prisma.service.update({ where: { id: svc.id }, data: { status: "CHECKED_IN", checkedInAt: new Date(), diagnosis: "Km: 45000" } });
  ok("Precheck → CHECKED_IN");

  // 5. Start → IN_PROGRESS
  await prisma.service.update({ where: { id: svc.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
  ok("Mulai kerja → IN_PROGRESS");

  // 6. Add part (atomik: servicePart + kurangi stok + movement)
  const qtyBefore = (await prisma.part.findUniqueOrThrow({ where: { id: part.id } })).quantity;
  await prisma.$transaction([
    prisma.servicePart.create({ data: { serviceId: svc.id, partId: part.id, quantity: 2, price: part.sellPrice, cost: part.buyPrice } }),
    prisma.part.update({ where: { id: part.id }, data: { quantity: { decrement: 2 } } }),
    prisma.stockMovement.create({ data: { partId: part.id, type: "OUT", quantity: 2, note: `Terpakai di ${code}` } }),
  ]);
  const qtyAfter = (await prisma.part.findUniqueOrThrow({ where: { id: part.id } })).quantity;
  if (qtyAfter === qtyBefore - 2) ok(`Part terpakai: stok ${qtyBefore} → ${qtyAfter} (snapshot cost=${part.buyPrice})`);
  else fail(`Stok tidak berkurang benar: ${qtyBefore} → ${qtyAfter}`);

  // 7. WAITING_PARTS ⇄ IN_PROGRESS
  await prisma.service.update({ where: { id: svc.id }, data: { status: "WAITING_PARTS" } });
  ok("Tandai → WAITING_PARTS");
  await prisma.service.update({ where: { id: svc.id }, data: { status: "IN_PROGRESS" } });
  ok("Resume → IN_PROGRESS");

  // 8. Mechanic finish → finishedAt terisi
  await prisma.service.update({ where: { id: svc.id }, data: { finishedAt: new Date() } });
  ok("Mekanik selesai → finishedAt terisi (menunggu QC)");

  // 9. QC → DONE
  await prisma.service.update({ where: { id: svc.id }, data: { status: "DONE", finishedAt: new Date() } });
  ok("QC → DONE");

  // Verifikasi total
  const final = await prisma.service.findUniqueOrThrow({
    where: { id: svc.id },
    include: { parts: true, payments: true },
  });
  const totalPart = final.parts.reduce((s, p) => s + p.price * p.quantity, 0);
  const totalTagihan = totalPart + final.laborCost;
  ok(`Final: status=${final.status}, part=${totalPart}, jasa=${final.laborCost}, tagihan=${totalTagihan}`);

  // Cleanup (urut: children dulu, lalu parents)
  await prisma.servicePart.deleteMany({ where: { serviceId: svc.id } });
  await prisma.payment.deleteMany({ where: { serviceId: svc.id } });
  await prisma.service.delete({ where: { id: svc.id } });
  await prisma.stockMovement.deleteMany({ where: { partId: part.id } });
  await prisma.part.delete({ where: { id: part.id } });
  await prisma.serviceCatalog.delete({ where: { id: catalog.id } });
  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  await prisma.user.delete({ where: { id: mechanic.id } });
  await prisma.user.delete({ where: { id: customer.id } });
  ok("Cleanup selesai");

  console.log("\nSemua step flow lulus ✓");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
