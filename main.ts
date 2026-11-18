// big-pickle final news image revision.
import * as fs from "node:fs";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

const NAVY = [10, 18, 38];
const HEADER = [16, 27, 56];
const CARD = [20, 33, 64];
const BORDER = [62, 90, 138];
const GOLD = [232, 183, 74];
const TEAL = [86, 200, 190];
const TEXT = [238, 242, 250];
const MUTED = [158, 178, 212];
const GLOBE_FILL = [14, 30, 58];
const GLOBE_LINE = [64, 112, 162];
const DARK = [12, 20, 40];

const FONT = {
  A: ".###./#...#/#...#/#####/#...#/#...#/#...#",
  B: "####./#...#/#...#/####./#...#/#...#/####.",
  C: ".###./#...#/#..../#..../#..../#...#/.###.",
  D: "####./#...#/#...#/#...#/#...#/#...#/####.",
  E: "#####/#..../#..../####./#..../#..../#####",
  F: "#####/#..../#..../####./#..../#..../#....",
  G: ".###./#...#/#..../#.###/#...#/#...#/.###.",
  H: "#...#/#...#/#...#/#####/#...#/#...#/#...#",
  I: "#####/..#../..#../..#../..#../..#../#####",
  J: "..###/...#./...#./...#./...#./#..#./.##..",
  K: "#...#/#..#./#.#../##.../#.#../#..#./#...#",
  L: "#..../#..../#..../#..../#..../#..../#####",
  M: "#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#",
  N: "#...#/##..#/#.#.#/#.#.#/#..##/#...#/#...#",
  O: ".###./#...#/#...#/#...#/#...#/#...#/.###.",
  P: "####./#...#/#...#/####./#..../#..../#....",
  Q: ".###./#...#/#...#/#...#/#.#.#/#..#./.##.#",
  R: "####./#...#/#...#/####./#.#../#..#./#...#",
  S: ".####/#..../#..../.###./....#/....#/####.",
  T: "#####/..#../..#../..#../..#../..#../..#..",
  U: "#...#/#...#/#...#/#...#/#...#/#...#/.###.",
  V: "#...#/#...#/#...#/#...#/#...#/.#.#./..#..",
  W: "#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#",
  X: "#...#/#...#/.#.#./..#../.#.#./#...#/#...#",
  Y: "#...#/#...#/.#.#./..#../..#../..#../..#..",
  Z: "#####/....#/...#./..#../.#.../#..../#####",
  "0": ".###./#...#/#..##/#.#.#/##..#/#...#/.###.",
  "1": "..#../.##../..#../..#../..#../..#../.###.",
  "2": ".###./#...#/....#/...#./..#../.#.../#####",
  "3": "####./....#/....#/.###./....#/....#/####.",
  "4": "...#./..##./.#.#./#..#./#####/...#./...#.",
  "5": "#####/#..../#..../####./....#/....#/####.",
  "6": ".###./#..../#..../####./#...#/#...#/.###.",
  "7": "#####/....#/...#./..#../.#.../.#.../.#...",
  "8": ".###./#...#/#...#/.###./#...#/#...#/.###.",
  "9": ".###./#...#/#...#/.####/....#/....#/.###.",
  " ": "...../...../...../...../...../...../.....",
  ".": "...../...../...../...../...../.##../.##..",
  ",": "...../...../...../...../.##../.##../.#...",
  ":": "...../.##../.##../...../.##../.##../.....",
  "-": "...../...../...../#####/...../...../.....",
  "/": "....#/....#/...#./..#../.#.../#..../#....",
};

class Framebuffer {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8Array(w * h * 3);
  }

  fill(c) {
    for (let i = 0; i < this.data.length; i += 3) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
    }
  }

  set(x, y, c) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return;
    const i = (yi * this.w + xi) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }

  fillRect(x, y, w, h, c) {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    for (let yy = y0; yy < y0 + h; yy++) {
      for (let xx = x0; xx < x0 + w; xx++) this.set(xx, yy, c);
    }
  }

  strokeRect(x, y, w, h, c, t) {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }

  line(x0, y0, x1, y1, c, t) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    const off = Math.floor(t / 2);
    for (;;) {
      this.fillRect(x - off, y - off, t, t, c);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  fillCircle(cx, cy, r, c) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, c);
      }
    }
  }

  strokeCircle(cx, cy, r, c, t) {
    const inner = (r - t / 2) * (r - t / 2);
    const outer = (r + t / 2) * (r + t / 2);
    for (let y = Math.floor(cy - r - t); y <= Math.ceil(cy + r + t); y++) {
      for (let x = Math.floor(cx - r - t); x <= Math.ceil(cx + r + t); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= inner && d2 <= outer) this.set(x, y, c);
      }
    }
  }
}

function textWidth(text, scale) {
  return Math.max(0, text.length * 6 * scale - scale);
}

function drawText(fb, text, x, y, scale, c, bold) {
  let cx = Math.round(x);
  const s = text.toUpperCase();
  const useBold = bold === true;
  for (let i = 0; i < s.length; i++) {
    const glyph = FONT[s[i]] || FONT[" "];
    const rows = glyph.split("/");
    for (let r = 0; r < 7; r++) {
      const row = rows[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] === "#") {
          fb.fillRect(cx + col * scale, y + r * scale, scale + (useBold ? 1 : 0), scale, c);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(fb, text, centerX, y, scale, c, bold) {
  drawText(fb, text, centerX - Math.floor(textWidth(text, scale) / 2), y, scale, c, bold);
}

function wrapText(text, maxWidth, scale) {
  const words = text.split(" ");
  const maxChars = Math.max(1, Math.floor(maxWidth / (6 * scale)));
  const lines = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (current.length === 0) {
      current = word;
    } else if ((current + " " + word).length <= maxChars) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function drawGlobe(fb, cx, cy, r) {
  fb.fillCircle(cx, cy, r, GLOBE_FILL);
  for (let k = -2; k <= 2; k++) {
    const dy = Math.round((k * r) / 3);
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    fb.line(cx - half, cy + dy, cx + half, cy + dy, GLOBE_LINE, 2);
  }
  for (let k = -2; k <= 2; k++) {
    const dx = Math.round((k * r) / 3);
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - dx * dx)));
    fb.line(cx + dx, cy - half, cx + dx, cy + half, GLOBE_LINE, 2);
  }
  fb.line(cx - r, cy, cx + r, cy, TEAL, 3);
  fb.strokeCircle(cx, cy, r, GOLD, 3);
  fb.fillCircle(cx, cy, 6, GOLD);
}

const STORIES = [
  "WORLD LEADERS MEET ON CLIMATE FINANCE",
  "AI AGENTS ENTER SOFTWARE CONTESTS",
  "MAJOR CITIES REPORT RECORD AUTUMN RAINFALL",
  "HEALTH AGENCIES TRACK SEASONAL FLU",
  "MARKETS WEIGH RATE DECISIONS",
  "A LUNAR MISSION RETURNS NEW IMAGERY",
  "GLOBAL SPORTS QUALIFIERS CONCLUDE",
  "CULTURAL FESTIVALS LIGHT UP CITY CENTRES",
];

function draw() {
  const fb = new Framebuffer(W, H);
  fb.fill(NAVY);

  fb.fillRect(0, 0, W, 8, GOLD);
  fb.fillRect(0, 8, W, 150, HEADER);
  drawText(fb, "17 NOV 2026", W - 40 - textWidth("17 NOV 2026", 3), 24, 3, TEAL, false);
  drawTextCentered(fb, "THE WORLD ON 17 NOVEMBER 2026", W / 2, 62, 5, TEXT, true);
  fb.fillRect(40, 150, W - 80, 2, TEAL);

  drawGlobe(fb, W / 2, 282, 94);

  const cardW = 460;
  const cardH = 110;
  const gapX = 24;
  const gapY = 16;
  const startX = 40;
  const startY = 398;

  for (let i = 0; i < STORIES.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const accent = i % 2 === 0 ? GOLD : TEAL;

    fb.fillRect(x, y, cardW, cardH, CARD);
    fb.strokeRect(x, y, cardW, cardH, BORDER, 2);
    fb.fillRect(x, y, 6, cardH, accent);

    const badge = 30;
    const bx = x + 22;
    const by = y + 22;
    fb.fillRect(bx, by, badge, badge, accent);
    const number = String(i + 1);
    drawText(fb, number, bx + Math.floor((badge - textWidth(number, 3)) / 2), by + 5, 3, DARK, true);

    const maxWidth = cardW - 96;
    const lines = wrapText(STORIES[i], maxWidth, 2);
    for (let l = 0; l < lines.length; l++) {
      drawText(fb, lines[l], x + 72, y + 22 + l * 20, 2, l === 0 ? TEXT : MUTED, false);
    }
  }

  fb.fillRect(40, 924, W - 80, 2, BORDER);
  drawTextCentered(fb, "WORLD NEWS DIGEST", W / 2, 952, 2, MUTED, false);
  drawText(fb, "17/11/26", 40, 952, 2, GOLD, false);
  drawText(fb, "01", W - 40 - textWidth("01", 2), 952, 2, GOLD, false);

  return fb;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePNG(fb) {
  const raw = Buffer.alloc(H * (1 + W * 3));
  let p = 0;
  for (let y = 0; y < H; y++) {
    raw[p++] = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      raw[p++] = fb.data[i];
      raw[p++] = fb.data[i + 1];
      raw[p++] = fb.data[i + 2];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const separator = outputDir.endsWith("/") || outputDir.endsWith("\\") ? "" : "/";
fs.writeFileSync(outputDir + separator + "entry.png", encodePNG(draw()));
