import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "owner@revledger.id";
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    await prisma.user.create({
      data: {
        name: "Owner Bengkel",
        email,
        phone: "081234567890",
        passwordHash: hashPassword("owner123"),
        role: "OWNER",
      },
    });
    console.log(`Akun owner dibuat: ${email} / owner123`);
    console.log("Segera ganti password setelah login pertama.");
  } else {
    console.log("Database sudah berisi user, seed dilewati.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
