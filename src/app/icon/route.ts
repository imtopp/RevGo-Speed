import { getBranding } from "@/lib/branding";
import {
  fallbackIconFor,
  parseIconRequest,
  resolveIconSource,
  type IconRequest,
} from "@/lib/app-icon";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, max-age=300, s-maxage=600";
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
/** Latar maskable senada background_color manifest (#f8fafc). */
const MASKABLE_BG = { r: 248, g: 250, b: 252, alpha: 1 };

/**
 * Ikon dinamis dari logo pengaturan (SystemSetting.logo_url): favicon tab,
 * apple-touch-icon, dan ikon PWA selalu mengikuti logo terbaru.
 * Logo kosong/rusak → redirect ke ikon statis bawaan.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const icon = parseIconRequest(searchParams);
  if (!icon) return new Response("Ukuran ikon tidak valid.", { status: 400 });

  const { logoUrl } = await getBranding();
  const source = resolveIconSource(logoUrl);

  if (source.kind !== "process") {
    const target = source.kind === "redirect" ? source.url : fallbackIconFor(icon);
    return Response.redirect(new URL(target, request.url), 302);
  }

  const input = Buffer.from(
    source.dataUrl.slice(source.dataUrl.indexOf(",") + 1),
    "base64",
  );
  try {
    const png = await renderIconPng(input, icon);
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": CACHE_CONTROL },
    });
  } catch {
    return Response.redirect(new URL(fallbackIconFor(icon), request.url), 302);
  }
}

/** Render PNG bujur sangkar — logo diskalakan menyesuaikan, tidak dipaksa. */
export async function renderIconPng(
  input: Buffer,
  { size, maskable }: IconRequest,
): Promise<Buffer> {
  if (!maskable) {
    return sharp(input)
      .resize(size, size, { fit: "contain", background: TRANSPARENT })
      .png()
      .toBuffer();
  }
  // Maskable: logo dipusatkan di zona aman (~68% sisi), sisanya latar penuh.
  const inner = Math.round(size * 0.68);
  const padded = await sharp(input)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();
  const top = Math.floor((size - inner) / 2);
  return sharp(padded)
    .extend({
      top,
      left: top,
      bottom: size - inner - top,
      right: size - inner - top,
      background: MASKABLE_BG,
    })
    .png()
    .toBuffer();
}
