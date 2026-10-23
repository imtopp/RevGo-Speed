import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
};

export default nextConfig;
