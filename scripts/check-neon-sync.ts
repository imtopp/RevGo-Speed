import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ── 1. Tabel di DB vs yang diharapkan schema.prisma ──
const expectedTables = [
  "User", "Branch", "ServiceCatalog", "Supplier", "SystemSetting", "Vehicle",
  "Part", "StockMovement", "Service", "ServicePart", "Payment", "Cashflow",
  "PartBatchUsage",
  // tabel join/enum Prisma (enum jadi tabel di Postgres utk native enums? tidak — enum tipe terpisah)
  "_prisma_migrations",
];

const tables: { table_name: string }[] = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
);
const actual = tables.map((t) => t.table_name);

console.log("=== TABEL ===");
for (const t of expectedTables) {
  console.log(`  ${actual.includes(t) ? "OK " : "MISSING"} ${t}`);
}
const extra = actual.filter((t) => !expectedTables.includes(t) && !t.startsWith("_"));
if (extra.length) console.log("  EXTRA (tidak ada di skema):", extra.join(", "));

// ── 2. Enum types ──
const expectedEnums = ["Role", "ServiceStatus", "ServiceSource", "StockMovementType", "CashflowType", "CashflowAccount", "PaymentMethod", "PaymentKind"];
const enums: { typname: string }[] = await prisma.$queryRawUnsafe(
  `SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e' ORDER BY typname`,
);
const enumNames = enums.map((e) => e.typname);
console.log("\n=== ENUM ===");
for (const e of expectedEnums) {
  console.log(`  ${enumNames.includes(e) ? "OK " : "MISSING"} ${e}`);
}
const extraEnums = enumNames.filter((e) => !expectedEnums.includes(e));
if (extraEnums.length) console.log("  EXTRA:", extraEnums.join(", "));

// ── 3. Kolom kunci per tabel (cek field tambahan Fase A+) ──
async function cols(table: string): Promise<string[]> {
  const rows: { column_name: string }[] = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
    table,
  );
  return rows.map((r) => r.column_name);
}

const keyChecks: [string, string[]][] = [
  ["User", ["branchId", "phone", "role", "isActive"]],
  ["Branch", ["jamBuka", "jamTutup", "hariAktif", "aktif"]],
  ["Service", ["branchId", "source", "catalogId", "cancelReason", "checkedInAt", "complaint", "diagnosis"]],
  ["ServicePart", ["cost"]],
  ["Payment", ["kind", "paidAt", "method"]],
  ["Cashflow", ["account", "branchId", "createdBy"]],
  ["Part", ["branchId", "supplierId", "sku", "minStock"]],
  ["StockMovement", ["supplierId", "cost"]],
  ["PartBatchUsage", ["movementId", "servicePartId", "quantity"]],
  ["ServiceCatalog", ["allowDp", "hargaDasar", "aktif"]],
  ["SystemSetting", ["key", "value", "updatedBy"]],
  ["Supplier", ["nama", "telepon", "aktif"]],
];
console.log("\n=== KOLOM KUNCI ===");
for (const [table, must] of keyChecks) {
  const c = await cols(table);
  const missing = must.filter((m) => !c.includes(m));
  console.log(`  ${missing.length === 0 ? "OK " : "MISSING"} ${table}${missing.length ? " → " + missing.join(", ") : ""}`);
}

// ── 4. Data seed ──
console.log("\n=== DATA SEED ===");
const branch = await prisma.branch.findFirst({ where: { name: "Pusat" } });
console.log(`  ${branch ? "OK " : "MISSING"} Branch "Pusat"${branch ? ` (${branch.id})` : ""}`);

const settings = await prisma.systemSetting.findMany({ select: { key: true } });
const keys = settings.map((s) => s.key);
for (const k of ["app_name", "dp_policy", "service_code_prefix"]) {
  console.log(`  ${keys.includes(k) ? "OK " : "MISSING"} SystemSetting ${k}`);
}

const owner = await prisma.user.findUnique({ where: { email: "owner@revgo-speed.id" } });
console.log(`  ${owner && owner.role === "OWNER" ? "OK " : "MISSING"} Owner ${owner ? `(${owner.name}, active=${owner.isActive})` : ""}`);

const sysadmin = await prisma.user.findUnique({ where: { email: "sysadmin@revgo-speed.id" } });
console.log(`  ${sysadmin && sysadmin.role === "SYS_ADMIN" ? "OK " : "MISSING"} SYS_ADMIN ${sysadmin ? `(${sysadmin.name}, active=${sysadmin.isActive})` : ""}`);

// ── 5. Ringkasan data operasional ──
console.log("\n=== RINGKASAN DATA ===");
const [users, branches, services, parts, payments, cashflows] = await Promise.all([
  prisma.user.count(), prisma.branch.count(), prisma.service.count(),
  prisma.part.count(), prisma.payment.count(), prisma.cashflow.count(),
]);
console.log(`  users=${users} branches=${branches} services=${services} parts=${parts} payments=${payments} cashflows=${cashflows}`);

// status breakdown servis
const byStatus = await prisma.service.groupBy({ by: ["status"], _count: true });
if (byStatus.length) console.log("  servis per status:", byStatus.map((s) => `${s.status}:${s._count}`).join(", "));

// cek stok negatif
const negParts = await prisma.part.findMany({ where: { quantity: { lt: 0 } }, select: { sku: true, quantity: true } });
console.log(`  ${negParts.length === 0 ? "OK " : "MASALAH"} stok negatif: ${negParts.length === 0 ? "tidak ada" : JSON.stringify(negParts)}`);

await prisma.$disconnect();
