import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const [part, sp, sm, svc, usage] = await Promise.all([
  prisma.part.count(),
  prisma.servicePart.count(),
  prisma.stockMovement.count(),
  prisma.service.count(),
  prisma.partBatchUsage.count(),
]);
console.log({ part, sp, sm, svc, usage });
console.log(
  "DB host:",
  (process.env.DATABASE_URL ?? "").split("@")[1]?.split("/")[0],
);
await prisma.$disconnect();
