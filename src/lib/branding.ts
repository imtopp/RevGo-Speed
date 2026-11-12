import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isSafeLogoValue } from "@/lib/logo";
import { normalizeWa } from "@/lib/wa";

export const PLATFORM_NAME = "RevGo Speed";

export type Branding = {
  appName: string;
  logoUrl: string | null;
  /** No. WA bengkel (SystemSetting.wa_bengkel) — null bila belum diisi/tidak valid. */
  waNumber: string | null;
};

export const getBranding = cache(async (): Promise<Branding> => {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: ["app_name", "logo_url", "wa_bengkel"] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const name = map.get("app_name")?.trim();
    const logo = map.get("logo_url")?.trim();
    // Sanitasi: https://, path relatif, atau data URL image hasil upload —
    // blok skema aneh (http:, javascript:, data:text/html).
    const logoSafe = logo && isSafeLogoValue(logo) ? logo : null;
    const waRaw = map.get("wa_bengkel")?.trim();
    return {
      appName: name && name.length > 0 ? name : PLATFORM_NAME,
      logoUrl: logoSafe,
      waNumber: waRaw ? normalizeWa(waRaw) : null,
    };
  } catch {
    return { appName: PLATFORM_NAME, logoUrl: null, waNumber: null };
  }
});

export const getAppName = cache(async (): Promise<string> => {
  const branding = await getBranding();
  return branding.appName;
});
