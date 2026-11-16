// Light Gray Mini: canvas, the one master palette, sprite baking, pixel text.
// Everything drawn in the game is a grid of palette keys; nothing is loaded
// from an image file, so any sprite can be swapped by editing its grid.

import { GLYPHS, GLYPH_W, GLYPH_H } from './font.js';

export const TILE = 16;
export const COLS = 16;
export const ROWS = 12;
export const HUD_H = 32;
export const W = COLS * TILE;            // 256
export const H = HUD_H + ROWS * TILE;    // 224

// One palette for the whole game, one character per color. Ramps run dark to
// light. The grays carry the Light Gray look; everything else is color-coding.
export const PAL = {
  // grays (cool)
  '0': '#0b0b10', '1': '#1c1c24', '2': '#33333d', '3': '#4e4e5a', '4': '#6e6e7a',
  '5': '#9494a0', '6': '#b8b8c2', '7': '#d9d9e0', '8': '#f4f4f6',
  // greens
  f: '#1f4a2a', g: '#2f7030', G: '#4c9a3c', h: '#6fbf4a', H: '#a6dd6a',
  // browns and tans
  b: '#3b2618', B: '#5c3c22', n: '#86592f', N: '#b98a4e',
  D: '#a8844f', d: '#c9a66b', t: '#dcc48a', T: '#efe2b0',
  // blues
  u: '#1b2b5e', U: '#2a4a9a', w: '#3f78d0', W: '#7db8f0', i: '#c9e8fb',
  // reds and oranges
  r: '#6b1420', R: '#b02a2e', o: '#e0563a', O: '#f29a4a',
  // yellows
  y: '#b8860b', Y: '#f2cf3e', l: '#fbf0a0',
  // purples
  p: '#32204e', P: '#5a3a8a', v: '#8e5fc4', V: '#c3a0ec',
  // skin and pinks
  S: '#c88a64', s: '#e8b890', k: '#f6d6b8', m: '#d85a8a', M: '#f4a0c0',
  // teals
  c: '#1f6d6d', C: '#3fb0a0', e: '#9ee6cf',
  // extra darks for night regions
  x: '#14202e', X: '#22344a', z: '#2a1a2e', Z: '#442a48',
  // The UI speaks Light Gray RPG's Classic theme, value for value.
  q: '#07141d', Q: '#20303f', j: '#344456', a: '#8c97ab', 9: '#ebeef3',  // canvas, panel, raised, muted, text
  A: '#d66976', E: '#569acf', I: '#6ebc75', J: '#efb045',                 // HP / STR, MP, XP / DEX, gold
  K: '#b18e40', L: '#6695d4', F: '#bda0ef',                                // DEF, MAG, talk
  $: '#ffff00', '%': '#6d7b90', '@': '#ea4659',                            // crit, miss, error
};

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Turn a grid of palette keys into a canvas.
 * rows: array of equal-length strings. '.' and ' ' are transparent.
 * swap: optional map from a grid character to a palette key (or '.' to hide),
 *       which is how one template becomes many characters.
 */
export function bake(rows, swap = null, name = 'sprite') {
  const h = rows.length;
  const w = rows[0].length;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    if (row.length !== w) {
      throw new Error(`${name}: row ${y} is ${row.length} wide, expected ${w}`);
    }
    for (let x = 0; x < w; x++) {
      let ch = row[x];
      if (swap && swap[ch] !== undefined) ch = swap[ch];
      if (ch === '.' || ch === ' ') continue;
      const col = PAL[ch];
      if (!col) throw new Error(`${name}: no palette color '${ch}' at ${x},${y}`);
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

export function flipH(src) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/** Turn a sprite clockwise by quarter turns, pixel for pixel. */
export function rotate(src, quarter) {
  const q = ((quarter % 4) + 4) % 4;
  if (q === 0) return src;
  const w = src.width;
  const h = src.height;
  const from = src.getContext('2d').getImageData(0, 0, w, h);
  const c = makeCanvas(q % 2 ? h : w, q % 2 ? w : h);
  const g = c.getContext('2d');
  const to = g.createImageData(c.width, c.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx, ny;
      if (q === 1) { nx = h - 1 - y; ny = x; }
      else if (q === 2) { nx = w - 1 - x; ny = h - 1 - y; }
      else { nx = y; ny = w - 1 - x; }
      const si = (y * w + x) * 4;
      const di = (ny * c.width + nx) * 4;
      to.data[di] = from.data[si];
      to.data[di + 1] = from.data[si + 1];
      to.data[di + 2] = from.data[si + 2];
      to.data[di + 3] = from.data[si + 3];
    }
  }
  g.putImageData(to, 0, 0);
  return c;
}

/** Double a sprite's size with hard pixels, for the big ones. */
export function scale2(src) {
  const c = makeCanvas(src.width * 2, src.height * 2);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** A solid-color silhouette of a sprite, for hit flashes. */
export function tint(src, colorKey) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = PAL[colorKey] || colorKey;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * A small pixel buffer for painting tiles in code. Painters write palette keys;
 * toCanvas() bakes them. Out-of-range writes are ignored so shapes can overhang.
 */
export class Buf {
  constructor(w, h, fill = '.') {
    this.w = w;
    this.h = h;
    this.d = new Array(w * h).fill(fill);
  }
  px(x, y, ch) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = ch;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.d[y * this.w + x];
  }
  rect(x, y, w, h, ch) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, ch);
  }
  hline(x, y, w, ch) { this.rect(x, y, w, 1, ch); }
  vline(x, y, h, ch) { this.rect(x, y, 1, h, ch); }
  /** Filled ellipse. Pass a function for ch to shade by position. */
  ellipse(cx, cy, rx, ry, ch) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, typeof ch === 'function' ? ch(x, y, dx, dy) : ch);
      }
    }
  }
  /** Draw another grid of keys on top; '.' leaves what is there. */
  stamp(rows, ox, oy, swap = null) {
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        let ch = rows[y][x];
        if (swap && swap[ch] !== undefined) ch = swap[ch];
        if (ch !== '.' && ch !== ' ') this.px(ox + x, oy + y, ch);
      }
    }
  }
  /** Ring every opaque shape with a dark edge, the 16-bit sprite look. */
  outline(ch = '0') {
    const edge = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== '.') continue;
        if (this.get(x - 1, y) !== '.' || this.get(x + 1, y) !== '.' ||
            this.get(x, y - 1) !== '.' || this.get(x, y + 1) !== '.') edge.push(y * this.w + x);
      }
    }
    for (const i of edge) this.d[i] = ch;
    return this;
  }
  rows() {
    const out = [];
    for (let y = 0; y < this.h; y++) out.push(this.d.slice(y * this.w, (y + 1) * this.w).join(''));
    return out;
  }
  /** Bake through ImageData: fast enough to repaint a whole room. */
  toCanvas(name = 'buf') {
    const c = makeCanvas(this.w, this.h);
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    const out = img.data;
    for (let i = 0; i < this.d.length; i++) {
      const ch = this.d[i];
      if (ch === '.' || ch === ' ') continue;
      const rgb = rgbOf(ch);
      if (!rgb) throw new Error(`${name}: no palette color '${ch}'`);
      out[i * 4] = rgb[0];
      out[i * 4 + 1] = rgb[1];
      out[i * 4 + 2] = rgb[2];
      out[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }
}

const RGB = new Map();
function rgbOf(ch) {
  let v = RGB.get(ch);
  if (v) return v;
  const hex = PAL[ch];
  if (!hex) return null;
  v = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  RGB.set(ch, v);
  return v;
}

/** Small deterministic random source, so painted textures never change. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- pixel text

const ADV = GLYPH_W + 1;      // 6 px per character
export const LINE_H = GLYPH_H + 2; // 10 px per line
const ORDER = Object.keys(GLYPHS);
const INDEX = new Map(ORDER.map((ch, i) => [ch, i]));
const atlases = new Map();

function atlas(colorKey) {
  let a = atlases.get(colorKey);
  if (a) return a;
  a = makeCanvas(ORDER.length * ADV, GLYPH_H);
  const g = a.getContext('2d');
  g.fillStyle = PAL[colorKey] || colorKey;
  ORDER.forEach((ch, i) => {
    const rowsOf = GLYPHS[ch].split('/');
    for (let y = 0; y < rowsOf.length; y++) {
      for (let x = 0; x < rowsOf[y].length; x++) {
        if (rowsOf[y][x] === '#') g.fillRect(i * ADV + x, y, 1, 1);
      }
    }
  });
  atlases.set(colorKey, a);
  return a;
}

export function textWidth(str) {
  return str.length * ADV - 1;
}

export function drawText(g, str, x, y, colorKey = '8') {
  const a = atlas(colorKey);
  x |= 0; y |= 0;
  for (let i = 0; i < str.length; i++) {
    const idx = INDEX.get(str[i]);
    if (idx === undefined) continue; // unknown characters read as a space
    g.drawImage(a, idx * ADV, 0, GLYPH_W, GLYPH_H, x + i * ADV, y, GLYPH_W, GLYPH_H);
  }
}

/** Text with a one-pixel dark ring, for numbers floating over the world. */
export function drawTextOutlined(g, str, x, y, colorKey = '8', edgeKey = '0') {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    drawText(g, str, x + dx, y + dy, edgeKey);
  }
  drawText(g, str, x, y, colorKey);
}

export function drawTextCentered(g, str, cx, y, colorKey = '8') {
  drawText(g, str, Math.round(cx - textWidth(str) / 2), y, colorKey);
}

/** Break a paragraph into lines of at most maxChars, on spaces. */
export function wrap(str, maxChars) {
  const out = [];
  for (const para of String(str).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if (!line.length) line = word;
      else if (line.length + 1 + word.length <= maxChars) line += ' ' + word;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

/** A framed panel in the gray UI language: dark fill, light rim, darker inset. */
export function panel(g, x, y, w, h, fill = '1', rim = '5') {
  g.fillStyle = PAL['0'];
  g.fillRect(x, y, w, h);
  g.fillStyle = PAL[rim];
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = PAL[fill];
  g.fillRect(x + 2, y + 2, w - 4, h - 4);
}

export function fillRect(g, x, y, w, h, colorKey) {
  g.fillStyle = PAL[colorKey] || colorKey;
  g.fillRect(x | 0, y | 0, w | 0, h | 0);
}
