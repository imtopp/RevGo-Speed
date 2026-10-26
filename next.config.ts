import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  devIndicators: false,
  poweredByHeader: false,
  experimental: {
    // Upload logo (pengaturan) mengirim file asli sampai 5 MB — default 1 MB terlalu kecil.
    serverActions: { bodySizeLimit: "6mb" },
  },
  // Next 16 memblokir dev asset & HMR dari origin di luar localhost ("cross-origin
  // dev protection"). Tanpa ini, akses via IP LAN (mis. hp customer/staf di
  // jaringan bengkel) memuat halaman tapi React tidak pernah hidrasi —
  // tombol/form mati total. Hanya berlaku saat `next dev` (produksi tidak membaca ini).
  allowedDevOrigins: ["192.168.1.*", "192.168.1.15", "192.168.1.8"],
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  async headers() {
    const headers: { source: string; headers: { key: string; value: string }[] }[] = [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
    // Selama development, chunk /_next/static jangan boleh di-cache browser —
    // mencegah client memakai chunk basi setelah rebuild (wayout: selalu ikut update).
    if (process.env.NODE_ENV === "development") {
      headers.push({
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      });
    }
    return headers;
  },
};

export default nextConfig;
