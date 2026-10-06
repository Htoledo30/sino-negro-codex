// Rasterização dos ícones originais sem dependências de execução.
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
await mkdir(dir, { recursive: true });
function crc32(data) {
  let n = 0xffffffff;
  for (const b of data) {
    n ^= b;
    for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0);
  }
  return (n ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type),
    size = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([size, name, data, crc]);
}
function within(px, py, poly) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i],
      [bx, by] = poly[j];
    if (ay > py !== by > py && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) yes = !yes;
  }
  return yes;
}
function segment(x, y, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}
function png(n, maskable = false) {
  const bytes = Buffer.alloc((n * 4 + 1) * n),
    scale = maskable ? 0.78 : 1,
    poly = [
      [139, 342],
      [182, 285],
      [182, 163],
      [188, 118],
      [214, 90],
      [256, 80],
      [298, 90],
      [324, 118],
      [330, 163],
      [330, 285],
      [373, 342],
    ],
    gold = [192, 173, 130, 255],
    red = [168, 68, 57, 255];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const p = y * (n * 4 + 1) + 1 + x * 4;
      let color = [16, 18, 17, 255];
      const xx = ((x / n) * 512 - 256) / scale + 256,
        yy = ((y / n) * 512 - 256) / scale + 256;
      if (within(xx, yy, poly)) color = [38, 43, 36, 255];
      if (poly.some((v, i) => segment(xx, yy, v, poly[(i + 1) % poly.length]) < 6)) color = gold;
      if (segment(xx, yy, [256, 62], [256, 96]) < 6) color = gold;
      if (
        segment(xx, yy, [256, 147], [256, 298]) < 5 ||
        segment(xx, yy, [220, 213], [292, 213]) < 5 ||
        (xx >= 243 && xx <= 269 && yy >= 363 && yy <= 420)
      )
        color = red;
      if (
        segment(xx, yy, [164, 381], [192, 402]) < 2.5 ||
        segment(xx, yy, [320, 402], [348, 381]) < 2.5
      )
        color = gold;
      bytes.set(color, p);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(n, 0);
  header.writeUInt32BE(n, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(bytes)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const [name, size, mask] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable.png', 512, true],
  ['apple-touch-icon.png', 180, false],
])
  await writeFile(path.join(dir, name), png(size, mask));
console.log('Ícones PNG gerados.');
