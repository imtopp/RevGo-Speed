import type { MetadataRoute } from "next";
import { getAppName } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const appName = await getAppName();
  return {
    name: `${appName} - Manajemen Bengkel`,
    short_name: appName,
    description: "Stok, cashflow, booking & proses servis bengkel",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#1e293b",
    lang: "id",
    icons: [
      { src: "/icon?size=192", sizes: "192x192", type: "image/png" },
      { src: "/icon?size=512", sizes: "512x512", type: "image/png" },
      {
        src: "/icon?size=512&maskable=1",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
