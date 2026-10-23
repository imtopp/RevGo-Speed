import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const users = await prisma.user.findMany({ select: { email: true, role: true } });
console.log("NEON QUERY OK:", JSON.stringify(users));
await prisma.$disconnect();
