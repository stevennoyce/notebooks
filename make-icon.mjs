// Draws apple-touch-icon.png (180x180): rose-to-teal gradient with a white heart.
// No dependencies; run once with `node make-icon.mjs` if the look ever changes.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
const S = 180, rows = [];
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
for (let y = 0; y < S; y++) {
  const row = [0];
  for (let x = 0; x < S; x++) {
    const t = (x + y) / (2 * S);
    let [r, g, b] = [lerp(0xd6, 0x2f, t), lerp(0x47, 0x7a, t), lerp(0x7a, 0x68, t)];
    const hx = (x - S / 2) / 48, hy = -(y - S / 2 - 6) / 48; // heart centred, a touch low
    const f = (hx * hx + hy * hy - 1) ** 3 - hx * hx * hy ** 3;
    if (f <= 0) [r, g, b] = [255, 255, 255];
    row.push(r, g, b);
  }
  rows.push(Buffer.from(row));
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync('apple-touch-icon.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]));
