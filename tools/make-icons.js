/* Generates icon-192.png and icon-512.png (the QuickList "Q" mark) with a
   hand-rolled PNG encoder — no native deps, so it runs on plain Node.
   Run from the quicklist folder:  node tools/make-icons.js

   The artwork uses the SAME coordinates as icon.svg / icon-maskable.svg (a
   1024-unit space, authored around the artwork centre 506.5,547.2), so the
   raster PNGs and the vector icons stay identical. Shapes are rendered from
   signed-distance functions, which gives clean anti-aliasing at every size.

   These PNGs are full-bleed and use the MASKABLE scale (0.78), matching
   icon-maskable.svg: they are tagged maskable in the manifest and are the
   source that tools/gen_icons.py resizes into the Android launcher icons. */
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
const RED = [0xF4, 0x51, 0x5E], ORANGE = [0xFB, 0xA0, 0x1C], BLUE = [0x2F, 0x6B, 0xF6], PURPLE = [0x7A, 0x4C, 0xF0];
const TILE_TOP = [0xFF, 0xFF, 0xFF], TILE_BOT = [0xF1, 0xF4, 0xF8];
// mix(a, b, t) = a·t + b·(1−t)  → returns `a` at t=1, `b` at t=0
const mix = (a, b, t) => [Math.round(a[0] * t + b[0] * (1 - t)), Math.round(a[1] * t + b[1] * (1 - t)), Math.round(a[2] * t + b[2] * (1 - t))];
const lerp = (a, b, t) => mix(b, a, t);   // plain a→b interpolation

/* ---- geometry, in artwork space (identical to the SVG) ---- */
const ART_CX = 506.5, ART_CY = 547.2;      // artwork bounding-box centre
const SCALE = 0.78;                         // maskable scale, as icon-maskable.svg
const RING = { cx: 470, cy: 526, r: 332, hw: 53.5, a0: 222.8, sweep: 271.9 };
const TAIL = { ax: 585.2, ay: 703.5, bx: 776.5, by: 894.8, hw: 59 };
const ROWS = [
  { cy: 408.5, col: RED }, { cy: 515.4, col: ORANGE }, { cy: 624.6, col: BLUE },
];
const BULLET = { cx: 191, r: 34 };
const BAR = { x: 270, w: 276, h: 54, rx: 27 };
/* The Q's colour sweeps around the arc, which a single linear gradient cannot
   do (it would go muddy where red and blue meet on the right). Both the SVG and
   this renderer therefore use TWO linear gradients over the same arc, split at
   ~42.5° and overlapping, so the join lands on orange in both and is invisible.
   Keep these in step with the <linearGradient> pairs in icon.svg. */
const GRAD_A = { ax: 226.4, ay: 300.4, bx: 693.1, by: 771.9, from: RED, to: ORANGE, hold: 0.75 };
const GRAD_B = { ax: 713.6, ay: 751.6, bx: 430, by: 790, from: ORANGE, to: BLUE };
const SPLIT = 182.5;   // degrees along the sweep where segment B takes over

/* Signed distances (negative = inside). */
function sdRoundRect(px, py, x, y, w, h, r) {
  const hx = w / 2, hy = h / 2, cx = x + hx, cy = y + hy;
  const qx = Math.abs(px - cx) - (hx - r), qy = Math.abs(py - cy) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
const sdCircle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;
/* Capsule: the tail, and the round caps of the arc. */
function sdSegment(px, py, ax, ay, bx, by, hw) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t)) - hw;
}
/* Arc with round caps: inside the angular sweep it is the distance to the
   circle band; outside it, the distance to whichever end cap is nearer. */
function sdArc(px, py, a) {
  const dx = px - a.cx, dy = py - a.cy;
  let ang = Math.atan2(dy, dx) * 180 / Math.PI; if (ang < 0) ang += 360;
  let rel = (ang - a.a0) % 360; if (rel < 0) rel += 360;
  if (rel <= a.sweep) return Math.abs(Math.hypot(dx, dy) - a.r) - a.hw;
  const rad = d => d * Math.PI / 180;
  const p0x = a.cx + a.r * Math.cos(rad(a.a0)), p0y = a.cy + a.r * Math.sin(rad(a.a0));
  const p1x = a.cx + a.r * Math.cos(rad(a.a0 + a.sweep)), p1y = a.cy + a.r * Math.sin(rad(a.a0 + a.sweep));
  return Math.min(Math.hypot(px - p0x, py - p0y), Math.hypot(px - p1x, py - p1y)) - a.hw;
}
/* Project a point onto a gradient axis and read off its colour. */
function gradAt(px, py, g) {
  const vx = g.bx - g.ax, vy = g.by - g.ay;
  let t = ((px - g.ax) * vx + (py - g.ay) * vy) / (vx * vx + vy * vy);
  t = Math.max(0, Math.min(1, t));
  if (g.hold) t = Math.min(1, t / g.hold);   // reach `to` early, then hold it
  return lerp(g.from, g.to, t);
}
/* Which of the two gradients applies depends on how far round the sweep the
   point sits — that is what makes the result read as a conic sweep. */
function ringColour(px, py) {
  let ang = Math.atan2(py - RING.cy, px - RING.cx) * 180 / Math.PI; if (ang < 0) ang += 360;
  let rel = (ang - RING.a0) % 360; if (rel < 0) rel += 360;
  // Round caps bulge PAST the sweep, so a cap pixel can land in the gap and
  // read as rel≈359 — which would flip the start cap to the blue segment.
  // Snap anything outside the sweep to whichever end it actually belongs to.
  if (rel > RING.sweep) rel = (rel - RING.sweep) < (360 - rel) ? RING.sweep : 0;
  return gradAt(px, py, rel <= SPLIT ? GRAD_A : GRAD_B);
}

function icon(size) {
  const s = size / 1024;                       // device px per design unit
  const aaDesign = 0.6 / s;                    // ~1.2px feather, in design units
  const aa = aaDesign / SCALE;                 // …expressed in artwork units
  const cover = d => Math.min(1, Math.max(0, 0.5 - d / (2 * aa)));
  return png(size, (x, y) => {
    const px = (x + 0.5) / s, py = (y + 0.5) / s;          // design space
    const qx = (px - 512) / SCALE + ART_CX;                 // artwork space
    const qy = (py - 512) / SCALE + ART_CY;

    let col = lerp(TILE_TOP, TILE_BOT, py / 1024);          // full-bleed tile
    let cv = cover(sdArc(qx, qy, RING));
    if (cv > 0) col = mix(ringColour(qx, qy), col, cv);
    for (const r of ROWS) {
      cv = cover(sdCircle(qx, qy, BULLET.cx, r.cy, BULLET.r));
      if (cv > 0) col = mix(r.col, col, cv);
      cv = cover(sdRoundRect(qx, qy, BAR.x, r.cy - BAR.h / 2, BAR.w, BAR.h, BAR.rx));
      if (cv > 0) col = mix(r.col, col, cv);
    }
    cv = cover(sdSegment(qx, qy, TAIL.ax, TAIL.ay, TAIL.bx, TAIL.by, TAIL.hw));
    if (cv > 0) col = mix(PURPLE, col, cv);                 // the tail sits on top
    return col;
  });
}

const dir = path.join(__dirname, '..');
fs.writeFileSync(path.join(dir, 'icon-192.png'), icon(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), icon(512));
console.log('Wrote icon-192.png and icon-512.png');
