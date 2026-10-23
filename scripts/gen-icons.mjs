import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

const BG = [15, 23, 42, 255];
const FG = [255, 255, 255, 255];

const LETTER_R = [
  "11110",
  "10001",
  "10001",
  "11110",
  "10100",
  "10010",
  "10001",
];
const LETTER_L = [
  "10000",
  "10000",
  "10000",
  "10000",
  "10000",
  "10000",
  "11111",
];

function createCanvas(size) {
  return Buffer.alloc(size * size * 4);
}

function fillRect(px, size, x, y, w, h, color) {
  for (let row = Math.max(0, y); row < Math.min(size, y + h); row++) {
    for (let col = Math.max(0, x); col < Math.min(size, x + w); col++) {
      const i = (row * size + col) * 4;
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = color[3];
    }
  }
}

function drawRL(size, scale, offsetX = 0, offsetY = 0) {
  const px = createCanvas(size);
  fillRect(px, size, 0, 0, size, size, BG);

  const letters = [LETTER_R, LETTER_L];
  const letterWidth = 5 * scale;
  const gap = scale;
  const totalWidth = letterWidth * 2 + gap;
  const totalHeight = 7 * scale;
  const startX = Math.floor((size - totalWidth) / 2) + offsetX;
  const startY = Math.floor((size - totalHeight) / 2) + offsetY;

  let x = startX;
  for (const letter of letters) {
    for (let row = 0; row < letter.length; row++) {
      for (let col = 0; col < letter[row].length; col++) {
        if (letter[row][col] === "1") {
          fillRect(
            px,
            size,
            x + col * scale,
            startY + row * scale,
            scale,
            scale,
            FG,
          );
        }
      }
    }
    x += letterWidth + gap;
  }
  return px;
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, px) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rowSize = size * 4;
  const raw = Buffer.alloc((rowSize + 1) * size);
  for (let row = 0; row < size; row++) {
    raw[row * (rowSize + 1)] = 0;
    px.copy(raw, row * (rowSize + 1) + 1, row * rowSize, (row + 1) * rowSize);
  }
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  { name: "icon-192.png", size: 192, scale: 14 },
  { name: "icon-512.png", size: 512, scale: 40 },
  { name: "icon-maskable-512.png", size: 512, scale: 32 },
  { name: "apple-touch-icon.png", size: 180, scale: 14 },
  { name: "favicon.png", size: 48, scale: 4 },
];

for (const t of targets) {
  const px = drawRL(t.size, t.scale);
  writeFileSync(join(outDir, t.name), encodePng(t.size, px));
  console.log(`icon: ${t.name} (${t.size}x${t.size})`);
}
