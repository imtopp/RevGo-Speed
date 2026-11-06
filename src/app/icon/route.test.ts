import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { renderIconPng } from "./route";

/** PNG 9×16 (potret, seperti keluhan logo panjang). */
async function portraitPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 90,
      height: 160,
      channels: 4,
      background: { r: 211, g: 47, b: 47, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

describe("renderIconPng", () => {
  it("menghasilkan PNG persis sebesar size, rasio asli dipertahankan", async () => {
    const input = await portraitPng();
    const out = await renderIconPng(input, { size: 192, maskable: false });
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(192);
    expect(meta.height).toBe(192);
  });

  it("maskable: square penuh dengan latar solid (bukan transparan)", async () => {
    const input = await portraitPng();
    const out = await renderIconPng(input, { size: 512, maskable: true });
    const img = sharp(out);
    const meta = await img.metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    // Pojok kanan-atas = area luar zona aman → harus latar #f8fafc.
    const { data } = await img
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([248, 250, 252]);
    expect(data[3]).toBe(255);
  });

  it("non-maskable: pojok tetap transparan", async () => {
    const out = await renderIconPng(await portraitPng(), {
      size: 64,
      maskable: false,
    });
    const { data } = await sharp(out)
      .resize(64, 64, { fit: "contain" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[3]).toBe(0);
  });

  it("input rusak → reject (route jatuh ke ikon statis)", async () => {
    await expect(
      renderIconPng(Buffer.from("bukan-gambar"), { size: 32, maskable: false }),
    ).rejects.toThrow();
  });
});
