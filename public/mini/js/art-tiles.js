// Light Gray Mini: terrain. Every tile is painted in code from a region theme,
// so one set of painters draws every region by changing the palette roles.
//
// A room is a 16x12 grid of characters (see TILES). bakeRoom() paints it once
// into two canvases: `bg` under everything, `fg` for the bits that hang over
// whoever walks behind them (treetops).

import { Buf, rng, TILE, COLS, ROWS } from './gfx.js';

// ------------------------------------------------------------------ tiles

export const TILES = {
  '.': { kind: 'ground' },
  ',': { kind: 'flowers' },
  '"': { kind: 'tallgrass' },
  ':': { kind: 'path' },
  _: { kind: 'floor' },
  s: { kind: 'sand' },
  '=': { kind: 'bridge' },
  T: { kind: 'tree', solid: true },
  b: { kind: 'bush', solid: true, cut: true },
  o: { kind: 'rock', solid: true },
  '#': { kind: 'wall', solid: true },
  '~': { kind: 'water', solid: true, water: true },
  f: { kind: 'fence', solid: true },
  u: { kind: 'stump', solid: true },
  O: { kind: 'cavemouth' },
  v: { kind: 'stairsdown' },
  '^': { kind: 'stairsup' },
  ' ': { kind: 'void', solid: true },
};

export function tileAt(room, cx, cy) {
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
  return TILES[room.map[cy][cx]] || TILES['.'];
}

// ----------------------------------------------------------------- themes
// Each value is a palette key from gfx.js.

const BASE = {
  ground: 'G', groundDark: 'g', groundLight: 'h',
  path: 'd', pathDark: 'D', pathLight: 't',
  leaf: 'g', leafDark: 'f', leafLight: 'h', leafHi: 'H', leafEdge: 'x',
  trunk: 'B', trunkDark: 'b',
  rock: '5', rockDark: '3', rockLight: '7', rockEdge: '2',
  water: 'w', waterDark: 'U', waterLight: 'W', foam: 'i',
  wallTop: '5', wallTopDark: '4', wallRim: '7', wallFace: '3', wallFaceDark: '2',
  floor: '5', floorDark: '4', floorLight: '6',
  sand: 'T', sandDark: 't', sandLight: '8',
  wood: 'N', woodDark: 'n', woodEdge: 'B',
  void: '0',
};

export const THEMES = {
  field: { ...BASE },
  // Room Zero: a gray square. Nothing but gray.
  zero: {
    ...BASE,
    ground: '5', groundDark: '4', groundLight: '6',
    floor: '6', floorDark: '5', floorLight: '7',
    wallTop: '3', wallTopDark: '2', wallRim: '5', wallFace: '4', wallFaceDark: '3',
  },
  cave: {
    ...BASE,
    ground: 'B', groundDark: 'b', groundLight: 'n',
    path: 'n', pathDark: 'B', pathLight: 'N',
    rock: '4', rockDark: '2', rockLight: '6', rockEdge: '1',
    water: 'U', waterDark: 'u', waterLight: 'w', foam: 'W',
    wallTop: '2', wallTopDark: '1', wallRim: '4', wallFace: '3', wallFaceDark: '2',
    floor: '4', floorDark: '3', floorLight: '5',
  },
  // The Plane of Rebirth: pale and empty.
  rebirth: {
    ...BASE,
    ground: '7', groundDark: '6', groundLight: '8',
    floor: '7', floorDark: '6', floorLight: '8',
    wallTop: '6', wallTopDark: '5', wallRim: '8', wallFace: '5', wallFaceDark: '4',
    void: '8',
  },
};
THEMES.beach = { ...BASE, ground: 'T', groundDark: 't', groundLight: '8' };
THEMES.marsh = {
  ...BASE, ground: 'g', groundDark: 'f', groundLight: 'G',
  leaf: 'f', leafDark: 'x', leafLight: 'g', leafHi: 'G',
  water: 'c', waterDark: 'x', waterLight: 'C', foam: 'e',
};
THEMES.forest = {
  ...BASE, ground: 'g', groundDark: 'f', groundLight: 'G',
  leaf: 'f', leafDark: 'x', leafLight: 'g', leafHi: 'G',
  path: 'D', pathDark: 'n', pathLight: 'd',
};
THEMES.town = {
  ...BASE, floor: '6', floorDark: '5', floorLight: '7',
  wallTop: 'R', wallTopDark: 'r', wallRim: 'o', wallFace: 'r', wallFaceDark: 'z',
};
THEMES.underwater = {
  ...BASE, ground: 'U', groundDark: 'u', groundLight: 'w',
  rock: 'c', rockDark: 'x', rockLight: 'C', rockEdge: 'x',
  wallTop: 'c', wallTopDark: 'x', wallRim: 'C', wallFace: 'X', wallFaceDark: 'x',
  leaf: 'c', leafDark: 'x', leafLight: 'C', leafHi: 'e', leafEdge: 'x', trunk: 'c', trunkDark: 'x',
  void: 'u',
};
THEMES.darkforest = {
  ...BASE, ground: 'f', groundDark: 'x', groundLight: 'g',
  leaf: 'X', leafDark: 'x', leafLight: 'c', leafHi: 'C', leafEdge: '0',
  path: 'B', pathDark: 'b', pathLight: 'n', trunk: 'b', trunkDark: '0',
  water: 'c', waterDark: 'x', waterLight: 'C', foam: 'e',
  rock: '3', rockDark: '2', rockLight: '5',
};
THEMES.mountain = {
  ...BASE, ground: '7', groundDark: '6', groundLight: '8',
  leaf: 'c', leafDark: 'x', leafLight: '8', leafHi: '8', leafEdge: 'X',
  path: '5', pathDark: '4', pathLight: '6',
  wallTop: '6', wallTopDark: '5', wallRim: '8', wallFace: '4', wallFaceDark: '3',
  water: 'W', waterDark: 'w', waterLight: 'i', foam: '8',
};
THEMES.camp = { ...BASE, floor: 't', floorDark: 'd', floorLight: 'T' };
THEMES.ogrelair = { ...THEMES.cave, ground: '3', groundDark: '2', groundLight: '4', wallFace: 'B', wallFaceDark: 'b', wallRim: 'n' };
THEMES.koboldlair = { ...THEMES.cave, ground: 'p', groundDark: 'z', groundLight: 'P', wallFace: 'P', wallFaceDark: 'p', wallRim: 'v' };
THEMES.spidercave = { ...THEMES.cave, ground: 'Z', groundDark: 'z', groundLight: 'P', wallFace: 'p', wallFaceDark: 'z', wallRim: 'P' };
THEMES.batcave = { ...THEMES.cave, ground: 'X', groundDark: 'x', groundLight: 'U', wallFace: 'X', wallFaceDark: 'x', wallRim: 'U' };
THEMES.scorpionpit = { ...THEMES.cave, ground: 'n', groundDark: 'B', groundLight: 'N', wallFace: 'B', wallFaceDark: 'b', wallRim: 'n' };

// --------------------------------------------------------------- painters

const GROUNDISH = new Set(['ground', 'flowers', 'tallgrass', 'tree', 'bush', 'rock', 'fence', 'stump', 'stairsdown']);
const PATHISH = new Set(['path', 'bridge', 'floor', 'stairsup', 'stairsdown', 'cavemouth', null]);
const WATERISH = new Set(['water', 'bridge', null]);
const WALLISH = new Set(['wall', 'cavemouth', 'void', null]);
const SANDISH = new Set(['sand', 'water', 'bridge', 'path', null]);

const SIDES = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };

function ground(b, ox, oy, c) {
  const { th, r } = c;
  b.rect(ox, oy, 16, 16, th.ground);
  for (let i = 0; i < 2; i++) {
    const x = 1 + ((r() * 12) | 0);
    const y = 1 + ((r() * 13) | 0);
    b.px(ox + x, oy + y, th.groundDark);
    b.px(ox + x + 1, oy + y + 1, th.groundDark);
    b.px(ox + x + 2, oy + y, th.groundDark);
  }
  for (let i = 0; i < 3; i++) b.px(ox + ((r() * 16) | 0), oy + ((r() * 16) | 0), th.groundLight);
}

function flowers(b, ox, oy, c) {
  ground(b, ox, oy, c);
  const petals = ['8', 'Y', 'M', 'W'];
  for (let i = 0; i < 3; i++) {
    const x = ox + 2 + ((c.r() * 12) | 0);
    const y = oy + 2 + ((c.r() * 12) | 0);
    const p = petals[(c.r() * petals.length) | 0];
    b.px(x, y - 1, p); b.px(x - 1, y, p); b.px(x + 1, y, p); b.px(x, y + 1, p);
    b.px(x, y, p === 'Y' ? 'O' : 'Y');
  }
}

function tallgrass(b, ox, oy, c) {
  ground(b, ox, oy, c);
  for (let i = 0; i < 9; i++) {
    const x = ox + ((c.r() * 16) | 0);
    const y = oy + 2 + ((c.r() * 12) | 0);
    b.px(x, y, c.th.groundLight);
    b.px(x, y + 1, c.th.groundLight);
    b.px(x, y + 2, c.th.groundDark);
  }
}

/** Let the neighboring ground creep over the edges of a path or beach tile. */
function fringe(b, ox, oy, c, sameSet, creep, border) {
  const open = {};
  for (const side of Object.keys(SIDES)) open[side] = !sameSet.has(c.kind(side));
  for (let i = 0; i < 16; i++) {
    const depth = 1 + (c.r() < 0.4 ? 1 : 0);
    if (open.N) { for (let d = 0; d < depth; d++) b.px(ox + i, oy + d, creep); b.px(ox + i, oy + depth, border); }
    if (open.S) { for (let d = 0; d < depth; d++) b.px(ox + i, oy + 15 - d, creep); b.px(ox + i, oy + 15 - depth, border); }
    if (open.W) { for (let d = 0; d < depth; d++) b.px(ox + d, oy + i, creep); b.px(ox + depth, oy + i, border); }
    if (open.E) { for (let d = 0; d < depth; d++) b.px(ox + 15 - d, oy + i, creep); b.px(ox + 15 - depth, oy + i, border); }
  }
  // Round the corners where two open sides meet.
  const corner = (cx, cy, sx, sy) => {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3 - j; i++) b.px(ox + cx + i * sx, oy + cy + j * sy, creep);
  };
  if (open.N && open.W) corner(0, 0, 1, 1);
  if (open.N && open.E) corner(15, 0, -1, 1);
  if (open.S && open.W) corner(0, 15, 1, -1);
  if (open.S && open.E) corner(15, 15, -1, -1);
}

function path(b, ox, oy, c) {
  const { th, r } = c;
  b.rect(ox, oy, 16, 16, th.path);
  for (let i = 0; i < 5; i++) b.px(ox + ((r() * 16) | 0), oy + ((r() * 16) | 0), th.pathDark);
  for (let i = 0; i < 3; i++) b.px(ox + ((r() * 16) | 0), oy + ((r() * 16) | 0), th.pathLight);
  fringe(b, ox, oy, c, PATHISH, th.ground, th.pathDark);
}

function sand(b, ox, oy, c) {
  const { th, r } = c;
  b.rect(ox, oy, 16, 16, th.sand);
  for (let i = 0; i < 6; i++) b.px(ox + ((r() * 16) | 0), oy + ((r() * 16) | 0), th.sandDark);
  for (let i = 0; i < 3; i++) b.px(ox + ((r() * 16) | 0), oy + ((r() * 16) | 0), th.sandLight);
  fringe(b, ox, oy, c, SANDISH, th.ground, th.sandDark);
}

function floor(b, ox, oy, c) {
  const { th, r } = c;
  b.rect(ox, oy, 16, 16, th.floor);
  b.hline(ox, oy, 16, th.floorLight);
  b.vline(ox, oy, 16, th.floorLight);
  b.hline(ox, oy + 15, 16, th.floorDark);
  b.vline(ox + 15, oy, 16, th.floorDark);
  for (let i = 0; i < 2; i++) b.px(ox + 2 + ((r() * 12) | 0), oy + 2 + ((r() * 12) | 0), th.floorDark);
}

/** A lit, lumpy blob: canopies, bushes and boulders all use it. */
function blob(b, f, ox, oy, c, shape, cols) {
  const { cx, cy, rx, ry, wobble = 0 } = shape;
  const phase = c.r() * 6.28;
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      if (x < 0 || x > 15) continue;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const lim = 1 + wobble * Math.sin(Math.atan2(dy, dx) * 7 + phase);
      const d2 = dx * dx + dy * dy;
      if (d2 > lim * lim) continue;
      let ch;
      if (d2 > lim * lim * 0.72) ch = cols.edge;
      else {
        const s = dx * 0.6 + dy * 0.8;
        ch = s < -0.4 ? cols.light : s > 0.36 ? cols.dark : cols.mid;
      }
      b.px(ox + x, oy + y, ch);
      if (f && y < 0) f.px(ox + x, oy + y, ch);
    }
  }
  // A little texture so it is not three flat bands.
  for (let i = 0; i < (shape.specks ?? 5); i++) {
    const a = c.r() * 6.28;
    const m = c.r() * 0.6;
    const x = Math.round(cx + Math.cos(a) * rx * m);
    const y = Math.round(cy + Math.sin(a) * ry * m);
    const s = ((x - cx) / rx) * 0.6 + ((y - cy) / ry) * 0.8;
    const ch = s < -0.4 ? cols.hi : s > 0.36 ? cols.mid : cols.dark;
    b.px(ox + x, oy + y, ch);
    if (f && y < 0) f.px(ox + x, oy + y, ch);
  }
}

function tree(b, f, ox, oy, c) {
  const { th } = c;
  ground(b, ox, oy, c);
  b.ellipse(ox + 7.5, oy + 14, 6, 1.6, th.groundDark);
  b.rect(ox + 6, oy + 10, 4, 5, th.trunk);
  b.vline(ox + 5, oy + 11, 4, th.leafEdge);
  b.vline(ox + 9, oy + 10, 5, th.trunkDark);
  b.vline(ox + 10, oy + 11, 4, th.leafEdge);
  b.hline(ox + 6, oy + 15, 4, th.leafEdge);
  blob(b, f, ox, oy, c, { cx: 7.5, cy: 4, rx: 7.7, ry: 7.3, wobble: 0.07, specks: 7 },
    { edge: th.leafEdge, light: th.leafLight, mid: th.leaf, dark: th.leafDark, hi: th.leafHi });
}

function bush(b, f, ox, oy, c) {
  const { th } = c;
  ground(b, ox, oy, c);
  b.ellipse(ox + 7.5, oy + 14, 5.5, 1.3, th.groundDark);
  blob(b, null, ox, oy, c, { cx: 7.5, cy: 8.5, rx: 6.6, ry: 5.6, wobble: 0.08, specks: 4 },
    { edge: th.leafEdge, light: th.leafHi, mid: th.leafLight, dark: th.leaf, hi: th.leafHi });
}

function rock(b, f, ox, oy, c) {
  const { th } = c;
  ground(b, ox, oy, c);
  b.ellipse(ox + 8, oy + 14, 6, 1.4, th.groundDark);
  blob(b, null, ox, oy, c, { cx: 7.5, cy: 8.5, rx: 6.7, ry: 5.6, wobble: 0.04, specks: 3 },
    { edge: th.rockEdge, light: th.rockLight, mid: th.rock, dark: th.rockDark, hi: th.rockLight });
  b.px(ox + 9, oy + 7, th.rockDark);
  b.px(ox + 10, oy + 8, th.rockDark);
  b.px(ox + 10, oy + 9, th.rockDark);
}

function stump(b, f, ox, oy, c) {
  const { th } = c;
  ground(b, ox, oy, c);
  b.ellipse(ox + 8, oy + 13.5, 6, 1.6, th.groundDark);
  b.rect(ox + 3, oy + 7, 10, 6, th.woodEdge);
  b.rect(ox + 4, oy + 7, 8, 5, th.woodDark);
  b.ellipse(ox + 7.5, oy + 6.5, 5, 2.6, th.woodEdge);
  b.ellipse(ox + 7.5, oy + 6.5, 4, 1.8, th.wood);
  b.px(ox + 7, oy + 6, th.woodDark);
  b.px(ox + 8, oy + 7, th.woodDark);
}

function fence(b, f, ox, oy, c) {
  const { th } = c;
  ground(b, ox, oy, c);
  const vertical = (c.kind('N') === 'fence' || c.kind('S') === 'fence') &&
    c.kind('W') !== 'fence' && c.kind('E') !== 'fence';
  if (vertical) {
    b.rect(ox + 6, oy, 4, 16, th.woodEdge);
    b.rect(ox + 7, oy, 2, 16, th.wood);
    b.rect(ox + 5, oy + 3, 6, 3, th.woodEdge);
    b.rect(ox + 6, oy + 3, 4, 2, th.woodDark);
    b.rect(ox + 5, oy + 11, 6, 3, th.woodEdge);
    b.rect(ox + 6, oy + 11, 4, 2, th.woodDark);
    return;
  }
  for (const y of [5, 10]) {
    b.rect(ox, oy + y, 16, 3, th.woodEdge);
    b.rect(ox, oy + y, 16, 2, th.wood);
  }
  for (const x of [2, 11]) {
    b.rect(ox + x, oy + 2, 4, 13, th.woodEdge);
    b.rect(ox + x + 1, oy + 2, 2, 12, th.woodDark);
    b.px(ox + x + 1, oy + 2, th.wood);
  }
}

function water(b, f, ox, oy, c) {
  const { th, r } = c;
  b.rect(ox, oy, 16, 16, th.water);
  for (let i = 0; i < 2; i++) b.hline(ox + ((r() * 12) | 0), oy + 3 + ((r() * 11) | 0), 3, th.waterDark);
  const open = {};
  for (const side of Object.keys(SIDES)) open[side] = !WATERISH.has(c.kind(side));
  for (let i = 0; i < 16; i++) {
    const d = c.r() < 0.5 ? 1 : 2;
    if (open.N) { b.vline(ox + i, oy, d, th.foam); b.px(ox + i, oy + d, th.waterLight); b.px(ox + i, oy + d + 1, th.waterDark); }
    if (open.W) { b.px(ox, oy + i, th.foam); if (d === 2) b.px(ox + 1, oy + i, th.waterLight); }
    if (open.E) { b.px(ox + 15, oy + i, th.foam); if (d === 2) b.px(ox + 14, oy + i, th.waterLight); }
    if (open.S) { b.px(ox + i, oy + 15, th.foam); }
  }
}

function bridge(b, f, ox, oy, c) {
  const { th } = c;
  const eastWest = WATERISH.has(c.kind('N')) && c.kind('N') !== null || WATERISH.has(c.kind('S')) && c.kind('S') !== null;
  b.rect(ox, oy, 16, 16, th.wood);
  if (eastWest) {
    for (let x = 3; x < 16; x += 4) b.vline(ox + x, oy, 16, th.woodDark);
    b.rect(ox, oy, 16, 2, th.woodEdge);
    b.rect(ox, oy + 14, 16, 2, th.woodEdge);
    b.hline(ox, oy + 2, 16, th.woodDark);
  } else {
    for (let y = 3; y < 16; y += 4) b.hline(ox, oy + y, 16, th.woodDark);
    b.rect(ox, oy, 2, 16, th.woodEdge);
    b.rect(ox + 14, oy, 2, 16, th.woodEdge);
  }
}

function wall(b, f, ox, oy, c) {
  const { th, r } = c;
  const front = !WALLISH.has(c.kind('S'));
  const faceH = front ? 7 : 0;
  const topH = 16 - faceH;
  b.rect(ox, oy, 16, topH, th.wallTop);
  for (let i = 0; i < 4; i++) {
    const x = ox + ((r() * 14) | 0);
    const y = oy + ((r() * Math.max(1, topH - 2)) | 0);
    b.px(x, y, th.wallTopDark);
    b.px(x + 1, y, th.wallTopDark);
  }
  if (!WALLISH.has(c.kind('N'))) b.hline(ox, oy, 16, th.wallRim);
  if (!WALLISH.has(c.kind('W'))) b.vline(ox, oy, topH, th.wallRim);
  if (!WALLISH.has(c.kind('E'))) b.vline(ox + 15, oy, topH, th.wallTopDark);
  if (front) {
    b.hline(ox, oy + topH - 1, 16, th.wallRim);
    b.rect(ox, oy + topH, 16, faceH, th.wallFace);
    for (let i = 0; i < 4; i++) {
      const x = ox + 1 + ((r() * 14) | 0);
      b.vline(x, oy + topH + ((r() * 3) | 0), 2 + ((r() * 3) | 0), th.wallFaceDark);
    }
    b.hline(ox, oy + 15, 16, th.wallFaceDark);
  }
}

function cavemouth(b, f, ox, oy, c) {
  const { th } = c;
  b.rect(ox, oy, 16, 16, th.wallFace);
  b.hline(ox, oy, 16, th.wallRim);
  for (let y = 2; y < 16; y++) {
    const inset = y < 4 ? 5 - y : y < 6 ? 2 : 1;
    b.hline(ox + inset + 1, oy + y, 14 - inset * 2, '0');
  }
  b.hline(ox + 4, oy + 15, 8, '1');
  b.hline(ox + 5, oy + 14, 6, '1');
}

function stairsdown(b, f, ox, oy, c) {
  const { th } = c;
  ground(b, ox, oy, c);
  b.rect(ox + 1, oy + 1, 14, 14, th.rockEdge);
  b.rect(ox + 2, oy + 2, 12, 12, '0');
  const steps = ['5', '4', '3', '2'];
  steps.forEach((ch, i) => b.rect(ox + 2, oy + 11 - i * 3, 12, 2, ch));
}

function stairsup(b, f, ox, oy, c) {
  const { th } = c;
  b.rect(ox, oy, 16, 16, th.ground);
  b.rect(ox + 1, oy, 14, 15, th.rockEdge);
  const steps = ['3', '4', '5', '6', '7'];
  steps.forEach((ch, i) => { b.rect(ox + 2, oy + 12 - i * 3, 12, 2, ch); b.hline(ox + 2, oy + 14 - i * 3, 12, '1'); });
}

function voidTile(b, f, ox, oy, c) {
  b.rect(ox, oy, 16, 16, c.th.void);
}

const PAINT = {
  ground: (b, f, ox, oy, c) => ground(b, ox, oy, c),
  flowers: (b, f, ox, oy, c) => flowers(b, ox, oy, c),
  tallgrass: (b, f, ox, oy, c) => tallgrass(b, ox, oy, c),
  path: (b, f, ox, oy, c) => path(b, ox, oy, c),
  sand: (b, f, ox, oy, c) => sand(b, ox, oy, c),
  floor: (b, f, ox, oy, c) => floor(b, ox, oy, c),
  tree, bush, rock, stump, fence, water, bridge, wall, cavemouth, stairsdown, stairsup,
  void: voidTile,
};

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Paint a whole room. Returns { bg, fg } canvases, 256x192. */
export function bakeRoom(room) {
  const th = THEMES[room.theme] || THEMES.field;
  const bg = new Buf(COLS * TILE, ROWS * TILE, th.void);
  const fg = new Buf(COLS * TILE, ROWS * TILE, '.');
  const base = hashStr(String(room.id));
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const t = tileAt(room, cx, cy);
      const c = {
        th,
        r: rng(base + cx * 7919 + cy * 104729),
        kind(side) {
          const [dx, dy] = SIDES[side];
          const n = tileAt(room, cx + dx, cy + dy);
          return n ? n.kind : null;
        },
      };
      (PAINT[t.kind] || PAINT.ground)(bg, fg, cx * TILE, cy * TILE, c);
    }
  }
  return { bg: bg.toCanvas(`room ${room.id}`), fg: fg.toCanvas(`room ${room.id} fg`) };
}

/** Animated glints for water cells; drawn over the baked room each frame. */
export function waterGlints() {
  const frames = [];
  for (let i = 0; i < 4; i++) {
    const b = new Buf(16, 16);
    b.hline(2 + i, 4, 3, 'W');
    b.hline(9 - i, 10, 3, 'W');
    b.px((5 + i * 3) % 16, 13, 'i');
    frames.push(b.toCanvas('glint'));
  }
  return frames;
}

export { GROUNDISH };
