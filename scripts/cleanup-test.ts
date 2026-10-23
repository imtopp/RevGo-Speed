import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const svcs = await p.service.findMany({ where: { code: { startsWith: "SV-TEST-" } } });
for (const s of svcs) {
  await p.servicePart.deleteMany({ where: { serviceId: s.id } });
  await p.payment.deleteMany({ where: { serviceId: s.id } });
  await p.service.delete({ where: { id: s.id } });
}
// Hapus stock movement milik part tes dulu (FK restrict)
const testParts = await p.part.findMany({ where: { sku: { startsWith: "TP-" } } });
for (const part of testParts) {
  await p.stockMovement.deleteMany({ where: { partId: part.id } });
}
await p.part.deleteMany({ where: { sku: { startsWith: "TP-" } } });
await p.serviceCatalog.deleteMany({ where: { nama: "Servis Tes" } });
await p.vehicle.deleteMany({ where: { plateNumber: { startsWith: "T" } } });
await p.user.deleteMany({ where: { email: { contains: "flow-" } } });
await p.user.deleteMany({ where: { email: { contains: "mek-" } } });
console.log("cleanup done");
await p.$disconnect();
