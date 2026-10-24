import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const PLATFORM_NAME = "RevGo Speed";

export type Branding = { appName: string; logoUrl: string | null };

export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["app_name", "logo_url"] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const name = map.get("app_name")?.trim();
    const logo = map.get("logo_url")?.trim();
    // Sanitasi: hanya https:// atau path relatif — blok skema aneh (http:, data:, javascript:).
    const logoSafe =
      logo && (logo.startsWith("https://") || logo.startsWith("/"))
        ? logo
        : null;
    return {
      appName: name && name.length > 0 ? name : PLATFORM_NAME,
      logoUrl: logoSafe,
    };
  } catch {
    return { appName: PLATFORM_NAME, logoUrl: null };
  }
});

export const getAppName = cache(async (): Promise<string> => {
  const branding = await getBranding();
  return branding.appName;
});
