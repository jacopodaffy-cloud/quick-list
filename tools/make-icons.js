/* Generates icon-192.png and icon-512.png (the 4-dot QuickList mark) with a
   hand-rolled PNG encoder — no native deps, so it runs on plain Node.
   Run from the quicklist folder:  node tools/make-icons.js  */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
function png(size, draw) {
  const W = size, H = size, stride = W * 4 + 1;
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0; // no filter
    for (let x = 0; x < W; x++) {
      const [r, g, b] = draw(x, y); const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; // RGBA 8-bit
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
// design in a 192-unit space (matches icon-maskable.svg): bg + 4 palette dots
const BG = [0x14, 0x16, 0x1B];
const DOTS = [[68, 68, 17, [0xF2, 0x55, 0x5A]], [124, 68, 17, [0xE8, 0xA9, 0x17]], [68, 124, 17, [0x2E, 0x97, 0xE8]], [124, 124, 17, [0x21, 0xA9, 0x71]]];
function icon(size) {
  const s = size / 192;
  return png(size, (x, y) => {
    const px = (x + 0.5) / s, py = (y + 0.5) / s;
    for (const [cx, cy, r, col] of DOTS) { const dx = px - cx, dy = py - cy; if (dx * dx + dy * dy <= r * r) return col; }
    return BG;
  });
}
const dir = path.join(__dirname, '..');
fs.writeFileSync(path.join(dir, 'icon-192.png'), icon(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), icon(512));
console.log('Wrote icon-192.png and icon-512.png');
