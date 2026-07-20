/* Generates icon-192.png and icon-512.png (the QuickList list mark) with a
   hand-rolled PNG encoder — no native deps, so it runs on plain Node.
   Run from the quicklist folder:  node tools/make-icons.js

   The artwork is kept in the SAME 1024-unit coordinate space as icon.svg /
   icon-maskable.svg, so the raster PNGs and the vector icons stay identical.
   These PNGs are full-bleed (blue to every edge) to serve as maskable icons and
   as the source that tools/gen_icons.py resizes into the Android launcher. */
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

/* ---- palette (matches icon.svg) ---- */
const BLUE = [0x2F, 0x6B, 0xF6], GREEN = [0x17, 0xB9, 0x81], ORANGE = [0xF8, 0xA8, 0x1B], WHITE = [255, 255, 255];
// mix(a, b, t) = a·t + b·(1−t)  → returns `a` at t=1, `b` at t=0
const mix = (a, b, t) => [Math.round(a[0] * t + b[0] * (1 - t)), Math.round(a[1] * t + b[1] * (1 - t)), Math.round(a[2] * t + b[2] * (1 - t))];

/* Signed distance to a rounded rectangle (negative = inside). */
function sdRoundRect(px, py, x, y, w, h, r) {
  const hx = w / 2, hy = h / 2, cx = x + hx, cy = y + hy;
  const qx = Math.abs(px - cx) - (hx - r), qy = Math.abs(py - cy) - (hy - r);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - r;
}
const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;

// White silhouette: three list-tabs stepping off the left edge + the card body.
const WHITE_RECTS = [
  [252, 340, 220, 96, 48], [268, 464, 204, 96, 48], [288, 588, 184, 96, 48],
  [410, 268, 390, 520, 74],
];
// Coloured rows: [cx, cy, r, colour] bullets and [x, y, w, h, r, colour] bars.
const DOTS = [[498, 388, 30, BLUE], [498, 512, 30, GREEN], [498, 636, 30, ORANGE]];
const BARS = [
  [560, 371, 160, 34, 17, BLUE], [560, 495, 188, 34, 17, GREEN], [560, 619, 152, 34, 17, ORANGE],
];

function icon(size) {
  const s = size / 1024;                 // device px per design unit
  const aa = 0.6 / s;                    // ~1.2px feather, expressed in design units
  const cover = d => Math.min(1, Math.max(0, 0.5 - d / (2 * aa)));  // 1 inside → 0 outside
  return png(size, (x, y) => {
    const px = (x + 0.5) / s, py = (y + 0.5) / s;
    let col = BLUE;                       // full-bleed background
    let cw = 0;                           // union coverage of the white shapes
    for (const [rx, ry, rw, rh, rr] of WHITE_RECTS) { cw = Math.max(cw, cover(sdRoundRect(px, py, rx, ry, rw, rh, rr))); if (cw >= 1) break; }
    if (cw > 0) col = mix(WHITE, col, cw);
    for (const [cx, cy, r, c] of DOTS) { const cv = cover(sdCircle(px, py, cx, cy, r)); if (cv > 0) col = mix(c, col, cv); }
    for (const [bx, by, bw, bh, br, c] of BARS) { const cv = cover(sdRoundRect(px, py, bx, by, bw, bh, br)); if (cv > 0) col = mix(c, col, cv); }
    return col;
  });
}

const dir = path.join(__dirname, '..');
fs.writeFileSync(path.join(dir, 'icon-192.png'), icon(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), icon(512));
console.log('Wrote icon-192.png and icon-512.png');
