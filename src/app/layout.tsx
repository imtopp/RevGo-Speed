import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RevLedger",
    template: "%s · RevLedger",
  },
  description: "Manajemen bengkel: stok, cashflow, booking & proses servis",
  applicationName: "RevLedger",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "RevLedger",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-dvh bg-slate-50 text-slate-900 antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
