import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processLogoImage } from "./logo-image";

/** Kanvas transparan berisi persegi padat di tengah (logo ber-margin). */
async function paddedRect(
  canvasW: number,
  canvasH: number,
  rectW: number,
  rectH: number,
): Promise<Buffer> {
  const rect = await sharp({
    create: {
      width: rectW,
      height: rectH,
      channels: 4,
      background: { r: 211, g: 47, b: 47, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: rect, left: Math.round((canvasW - rectW) / 2), top: Math.round((canvasH - rectH) / 2) }])
    .png()
    .toBuffer();
}

async function ratio(buf: Buffer): Promise<number> {
  const m = await sharp(buf).metadata();
  return (m.width ?? 0) / (m.height ?? 1);
}

describe("processLogoImage", () => {
  it("membuang margin tepi agar isi logo padat di semua slot tampilan", async () => {
    const input = await paddedRect(160, 100, 50, 40);
    const out = await processLogoImage(input, 80);
    const m = await sharp(out).metadata();
    expect(m.format).toBe("webp");
    // Margin transparan terhapus → rasio = rasio kotak isi (50/40 = 1.25),
    // bukan rasio kanvas (160/100 = 1.6).
    expect(await ratio(out)).toBeCloseTo(1.25, 1);
    expect(m.width).toBeLessThanOrEqual(512);
    expect(m.height).toBeLessThanOrEqual(512);
  });

  it("logo solid tanpa margin dibiarkan utuh (tidak terkikis)", async () => {
    const input = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const out = await processLogoImage(input, 80);
    expect(await ratio(out)).toBeCloseTo(2, 2);
  });

  it("membatasi maks 512px tanpa memotong rasio", async () => {
    const input = await sharp({
      create: {
        width: 1000,
        height: 400,
        channels: 4,
        background: { r: 30, g: 41, b: 59, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const out = await processLogoImage(input, 80);
    const m = await sharp(out).metadata();
    expect(m.width).toBe(512);
    expect(await ratio(out)).toBeCloseTo(2.5, 2);
  });

  it("input rusak → reject", async () => {
    await expect(
      processLogoImage(Buffer.from("bukan-gambar"), 80),
    ).rejects.toThrow();
  });
});
