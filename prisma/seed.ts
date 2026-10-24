import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../src/lib/password";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const DEFAULT_SETTINGS: Record<string, string> = {
  app_name: "RevGo Speed",
  logo_url: "/icons/icon-192.png",
  dp_policy: "TANPA_REFUND",
  service_code_prefix: "SV-",
};

async function main() {
  // 1. Branch default (wajib ada sebelum Part/Service/Cashflow bisa diisi)
  let branch = await prisma.branch.findFirst({ where: { name: "Pusat" } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { name: "Pusat", address: "Jl. Contoh No. 1", phone: "021-0000000" },
    });
    console.log(`Branch default dibuat: ${branch.name} (${branch.id})`);
  } else {
    console.log(`Branch default sudah ada: ${branch.name}`);
  }

  // 2. SystemSetting defaults (idempoten)
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log("SystemSetting defaults siap.");

  // 3. Akun owner (lintas cabang, branchId null)
  const ownerEmail = "owner@revgo-speed.id";
  const ownerExists = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!ownerExists) {
    await prisma.user.create({
      data: {
        name: "Owner Bengkel",
        email: ownerEmail,
        phone: "081234567890",
        passwordHash: hashPassword("owner123"),
        role: "OWNER",
      },
    });
    console.log(`Akun owner dibuat: ${ownerEmail} / owner123`);
    console.log("Segera ganti password setelah login pertama.");
  } else {
    console.log("Akun owner sudah ada.");
  }

  // 4. Akun SYS_ADMIN (lintas cabang, branchId null)
  const sysAdminEmail = "sysadmin@revgo-speed.id";
  const sysAdminExists = await prisma.user.findUnique({ where: { email: sysAdminEmail } });
  if (!sysAdminExists) {
    await prisma.user.create({
      data: {
        name: "System Admin",
        email: sysAdminEmail,
        phone: "081234567891",
        passwordHash: hashPassword("sysadmin123"),
        role: "SYS_ADMIN",
      },
    });
    console.log(`Akun SYS_ADMIN dibuat: ${sysAdminEmail} / sysadmin123`);
  } else {
    console.log("Akun SYS_ADMIN sudah ada.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
