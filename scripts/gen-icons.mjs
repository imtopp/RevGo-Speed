import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "logo", "logo_only.png");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

async function dominantColor() {
  const { data } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) continue;
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = null;
  let bestN = -1;
  for (const [key, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = key;
    }
  }
  const [r, g, b] = best.split(",").map(Number);
  return { r, g, b };
}

async function plain(size, file) {
  await sharp(source).resize(size, size, { fit: "cover" }).png().toFile(join(outDir, file));
  console.log(`icon: ${file} (${size}x${size})`);
}

async function padded(size, scale, file, bg) {
  const inner = Math.round(size * scale);
  const logo = await sharp(source).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: logo, gravity: "centre" }])
    .png()
    .toFile(join(outDir, file));
  console.log(`icon: ${file} (${size}x${size}, logo ${Math.round(scale * 100)}% + bg rgb(${bg.r},${bg.g},${bg.b}))`);
}

const bg = await dominantColor();
console.log(`source: logo/logo_only.png · bg dominan: rgb(${bg.r},${bg.g},${bg.b})`);

await plain(48, "favicon.png");
await plain(192, "icon-192.png");
await plain(512, "icon-512.png");
await padded(180, 0.9, "apple-touch-icon.png", bg);
await padded(512, 0.8, "icon-maskable-512.png", bg);
