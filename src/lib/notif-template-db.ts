import { prisma } from "@/lib/prisma";
import {
  NOTIF_TEMPLATES_KEY,
  sanitasiTemplateOverrides,
  type TemplateOverrides,
} from "@/lib/notif-template";

/** Baca override template dari SystemSetting — gagal = pakai default. */
export async function muatTemplateNotif(): Promise<TemplateOverrides> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: NOTIF_TEMPLATES_KEY },
    });
    if (!row) return {};
    return sanitasiTemplateOverrides(row.value);
  } catch {
    return {};
  }
}
