import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const PASSWORD = "terserah";

const TEST_USERS = [
  { name: "Owner Test",  email: "owner@email.com",  role: "OWNER" as const,      branchId: null },
  { name: "SysAdmin Test", email: "sysadmin@email.com", role: "SYS_ADMIN" as const, branchId: null },
  { name: "Admin Test",  email: "admin@email.com",  role: "ADMIN" as const,      branchId: "__BRANCH__" },
  { name: "Mekanik Test", email: "mechanic@email.com", role: "MECHANIC" as const, branchId: "__BRANCH__" },
  { name: "Customer Test", email: "customer@email.com", role: "CUSTOMER" as const, branchId: null },
];

async function main() {
  const branch = await prisma.branch.findFirst({ where: { name: "Pusat" } });
  if (!branch) {
    console.error("Branch 'Pusat' tidak ditemukan. Jalankan seed dulu.");
    process.exit(1);
  }

  for (const u of TEST_USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
          data: { passwordHash: hashPassword(PASSWORD), isActive: true },
      });
      console.log(`UPDATE  ${u.role.padEnd(10)} ${u.email} / ${PASSWORD}`);
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          phone: "080000000000",
          passwordHash: hashPassword(PASSWORD),
          role: u.role,
          branchId: u.branchId === "__BRANCH__" ? branch.id : null,
        },
      });
      console.log(`CREATE  ${u.role.padEnd(10)} ${u.email} / ${PASSWORD}`);
    }
  }

  console.log("\nSemua akun test siap.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
