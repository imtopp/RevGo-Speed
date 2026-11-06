import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ServiceWorkerRegister } from "@/components/sw-register";
import { VersionCheck } from "@/components/version-check";
import { getAppName } from "@/lib/branding";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const appName = await getAppName();
  return {
    title: {
      default: appName,
      template: `%s · ${appName}`,
    },
    description: "Booking, pantau, dan bayar servis kendaraan — praktis dari HP",
    applicationName: appName,
    icons: {
      icon: [
        { url: "/icon?size=32", sizes: "32x32", type: "image/png" },
        { url: "/icon?size=48", sizes: "48x48", type: "image/png" },
        { url: "/icon?size=192", sizes: "192x192", type: "image/png" },
      ],
      apple: "/icon?size=180",
    },
    appleWebApp: {
      capable: true,
      title: appName,
      statusBarStyle: "default",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1e293b",
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
    <html lang="id" className={inter.variable}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
        <ServiceWorkerRegister />
        <VersionCheck />
      </body>
    </html>
  );
}
