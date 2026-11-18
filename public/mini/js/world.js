// Light Gray Mini: how rooms join, what a gate asks for, and a validator that
// keeps the map honest (every open edge leads somewhere, every exit has a way
// back, every id in the data exists). No drawing here; it runs under tests.

import { ROOMS } from './data/rooms.js';
import { ENEMIES } from './data/enemies.js';
import { ITEMS } from './data/items.js';
import { QUESTS, PEOPLE, SHOPS } from './data/quests.js';
import { TILES } from './art-tiles.js';

export const COLS = 16;
export const ROWS = 12;

export const EDGES = {
  N: { dx: 0, dy: -1, opposite: 'S' },
  S: { dx: 0, dy: 1, opposite: 'N' },
  W: { dx: -1, dy: 0, opposite: 'E' },
  E: { dx: 1, dy: 0, opposite: 'W' },
};

const bySheet = new Map();
const sharedCells = [];       // two rooms on one square of a sheet: one would vanish
for (const [id, room] of Object.entries(ROOMS)) {
  const key = `${room.sheet}:${room.at[0]},${room.at[1]}`;
  if (bySheet.has(key)) sharedCells.push(`rooms ${bySheet.get(key)} and ${id} share ${key} on the map`);
  bySheet.set(key, id);
}

/** The room on the other side of an edge, or null. */
export function neighbor(roomId, edge) {
  const room = ROOMS[roomId];
  const e = EDGES[edge];
  return bySheet.get(`${room.sheet}:${room.at[0] + e.dx},${room.at[1] + e.dy}`) || null;
}

/** Does the player meet a condition? */
export function check(player, need) {
  if (!need) return true;
  if (need.never) return false;
  if (need.all) return need.all.every((n) => check(player, n));
  if (need.any) return need.any.some((n) => check(player, n));
  if (need.has) return (player.bag[need.has] || 0) > 0;
  if (need.kills) return (player.kills[need.kills[0]] || 0) >= need.kills[1];
  if (need.quest) return player.quests[need.quest] === 'done';
  if (need.flag) return !!player.flags[need.flag];
  if (need.sword) return !!player.gear.sword;
  return true;
}

/** The message of the first gate on this edge the player fails, or null. */
export function edgeGate(player, roomId, edge) {
  for (const gate of ROOMS[roomId].gates || []) {
    if (gate.edge === edge && !check(player, gate.need)) return gate.msg;
  }
  return null;
}

/** Text marked DRAFT| is a placeholder written for Anthony to replace. */
export function plain(text) {
  return String(text).startsWith('DRAFT|') ? String(text).slice(6) : String(text);
}

export function isDraft(text) {
  return String(text).startsWith('DRAFT|');
}

function walkable(room, cx, cy) {
  const t = TILES[room.map[cy][cx]];
  if (!t) return false;
  // Open water counts as a way through on a sea room: you sail it.
  return !t.solid || (!!room.sea && !!t.water);
}

/** Every cell you can get to from a starting cell, things in the way included. */
function reach(room, start) {
  const blocked = new Set();
  for (const t of room.things || []) {
    if (t.solid === false || (t.solid === undefined && t.t === 'read') || t.gone) continue;
    for (let y = t.y; y < t.y + (t.h || 1); y++) for (let x = t.x; x < t.x + (t.w || 1); x++) blocked.add(y * COLS + x);
  }
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const [x, y] = stack.pop();
    const k = y * COLS + x;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS || seen.has(k) || blocked.has(k) || !walkable(room, x, y)) continue;
    seen.add(k);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

/** The cells along one edge of a room, in order. */
function edgeCells(edge) {
  const out = [];
  if (edge === 'N' || edge === 'S') for (let x = 0; x < COLS; x++) out.push([x, edge === 'N' ? 0 : ROWS - 1]);
  else for (let y = 0; y < ROWS; y++) out.push([edge === 'W' ? 0 : COLS - 1, y]);
  return out;
}

/** Every problem in the world data, as a list of sentences. Empty is good. */
export function validateWorld() {
  const errors = [...sharedCells];
  for (const [id, room] of Object.entries(ROOMS)) {
    const at = `room ${id}`;
    if (!Array.isArray(room.map) || room.map.length !== ROWS) { errors.push(`${at}: needs ${ROWS} rows`); continue; }
    let badShape = false;
    room.map.forEach((r, y) => {
      if (r.length !== COLS) { errors.push(`${at}: row ${y} is ${r.length} wide, expected ${COLS}`); badShape = true; }
      for (const ch of r) if (!TILES[ch]) { errors.push(`${at}: unknown tile '${ch}' on row ${y}`); badShape = true; }
    });
    if (badShape) continue;

    for (const edge of Object.keys(EDGES)) {
      const nbId = neighbor(id, edge);
      const gated = (room.gates || []).some((g) => g.edge === edge);
      for (const [cx, cy] of edgeCells(edge)) {
        if (!walkable(room, cx, cy)) continue;
        if (!nbId) {
          if (!gated) errors.push(`${at}: open ${edge} edge at ${cx},${cy} leads nowhere`);
          continue;
        }
        const nb = ROOMS[nbId];
        const ox = edge === 'W' ? COLS - 1 : edge === 'E' ? 0 : cx;
        const oy = edge === 'N' ? ROWS - 1 : edge === 'S' ? 0 : cy;
        if (!walkable(nb, ox, oy)) errors.push(`${at}: ${edge} edge at ${cx},${cy} is open but room ${nbId} is closed there`);
      }
    }

    for (const w of room.warps || []) {
      const to = ROOMS[w.to];
      if (!to) { errors.push(`${at}: warp to unknown room ${w.to}`); continue; }
      if (!walkable(to, w.cx, w.cy)) errors.push(`${at}: warp lands in a wall in room ${w.to} at ${w.cx},${w.cy}`);
      if ((to.warps || []).some((b) => b.x === w.cx && b.y === w.cy)) errors.push(`${at}: warp lands on another warp in room ${w.to}`);
      if (!walkable(room, w.x, w.y)) errors.push(`${at}: warp at ${w.x},${w.y} is inside a wall`);
    }

    for (const t of room.things || []) {
      const w = t.w || 1;
      const h = t.h || 1;
      for (let y = t.y; y < t.y + h; y++) {
        for (let x = t.x; x < t.x + w; x++) {
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) errors.push(`${at}: ${t.t} at ${x},${y} is off the map`);
          else if (!walkable(room, x, y)) errors.push(`${at}: ${t.t} at ${x},${y} sits on a solid tile`);
        }
      }
      if (t.item && !ITEMS[t.item]) errors.push(`${at}: unknown item ${t.item}`);
      if (t.t === 'chop' && !(t.gives > 0 && t.upTo > 0 && t.noTool && t.full)) errors.push(`${at}: the tree at ${t.x},${t.y} needs gives, upTo, noTool and full`);
      if (t.who && !PEOPLE[t.who]) errors.push(`${at}: unknown person ${t.who}`);
      if (t.shop && !SHOPS[t.shop]) errors.push(`${at}: unknown shop ${t.shop}`);
      if (t.to && t.to !== 'hub' && !ROOMS[t.to]) errors.push(`${at}: ${t.t} leads to unknown room ${t.to}`);
      if (t.need && t.need.has && !ITEMS[t.need.has]) errors.push(`${at}: ${t.t} asks for unknown item ${t.need.has}`);
      for (const [slug] of (t.loot && t.loot.items) || []) if (!ITEMS[slug]) errors.push(`${at}: chest holds unknown item ${slug}`);
    }

    // Everything in a room has to be reachable from every way into it.
    const entries = [];
    for (const edge of Object.keys(EDGES)) {
      if (!neighbor(id, edge)) continue;
      for (const [cx, cy] of edgeCells(edge)) if (walkable(room, cx, cy)) entries.push([cx, cy, `${edge} edge`]);
    }
    for (const other of Object.values(ROOMS)) {
      for (const w of other.warps || []) if (w.to === id) entries.push([w.cx, w.cy, 'a warp landing']);
      for (const t of other.things || []) if (t.to === id && t.cx !== undefined) entries.push([t.cx, t.cy, 'a door landing']);
    }
    if (entries.length) {
      const seen = reach(room, entries[0]);
      const near = (x, y, w = 1, h = 1) => {
        for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (seen.has(yy * COLS + xx)) return true;
        return false;
      };
      for (const [cx, cy, what] of entries) if (!seen.has(cy * COLS + cx)) errors.push(`${at}: ${what} at ${cx},${cy} is cut off from the rest of the room`);
      for (const w of room.warps || []) if (!seen.has(w.y * COLS + w.x)) errors.push(`${at}: the warp at ${w.x},${w.y} can't be reached`);
      for (const t of room.things || []) if (!t.silent && !near(t.x, t.y, t.w || 1, t.h || 1)) errors.push(`${at}: the ${t.t} at ${t.x},${t.y} can't be reached`);
      if (room.boss && !seen.has(room.boss.cy * COLS + room.boss.cx)) errors.push(`${at}: the boss stands somewhere unreachable`);
    }

    for (const [slug] of room.spawns || []) if (!ENEMIES[slug]) errors.push(`${at}: unknown enemy ${slug}`);
    if (room.boss && !ENEMIES[room.boss.slug]) errors.push(`${at}: unknown boss ${room.boss.slug}`);
  }

  for (const [slug, e] of Object.entries(ENEMIES)) {
    for (const [item] of e.drops || []) if (!ITEMS[item]) errors.push(`enemy ${slug}: drops unknown item ${item}`);
    if (e.first && !ITEMS[e.first]) errors.push(`enemy ${slug}: first-kill item ${e.first} is unknown`);
  }
  for (const [id, q] of Object.entries(QUESTS)) {
    if (!PEOPLE[q.giver]) errors.push(`quest ${id}: unknown giver ${q.giver}`);
    for (const a of q.after || []) if (!QUESTS[a]) errors.push(`quest ${id}: comes after unknown quest ${a}`);
    if (q.need.item && !ITEMS[q.need.item[0]]) errors.push(`quest ${id}: needs unknown item ${q.need.item[0]}`);
    if (q.need.kills && !ENEMIES[q.need.kills[0]]) errors.push(`quest ${id}: needs kills of unknown enemy ${q.need.kills[0]}`);
    for (const slug of q.need.killsAll || []) if (!ENEMIES[slug]) errors.push(`quest ${id}: needs a kill of unknown enemy ${slug}`);
    for (const other of q.need.quests || []) if (!QUESTS[other]) errors.push(`quest ${id}: counts unknown quest ${other}`);
    for (const [slug] of (q.reward && q.reward.items) || []) if (!ITEMS[slug]) errors.push(`quest ${id}: rewards unknown item ${slug}`);
  }
  for (const [id, person] of Object.entries(PEOPLE)) {
    for (const q of person.quests || []) if (!QUESTS[q]) errors.push(`person ${id}: lists unknown quest ${q}`);
    for (const sale of (person.teaches && person.teaches.sells) || []) {
      if (sale.item && !ITEMS[sale.item]) errors.push(`person ${id}: teaches unknown item ${sale.item}`);
    }
  }
  for (const [slug, e] of Object.entries(ENEMIES)) {
    if (!e.sprite && !e.look) errors.push(`enemy ${slug}: has nothing to be drawn with`);
  }
  // Every gold pillar room needs its pillar, and somewhere to stand beside it.
  for (const [id, room] of Object.entries(ROOMS)) {
    if (!room.hub) continue;
    const pillar = (room.things || []).find((t) => t.t === 'hub');
    if (!pillar) errors.push(`room ${id}: marked as a hub but has no gold pillar`);
    else if (!walkable(room, pillar.x, pillar.y + 1)) errors.push(`room ${id}: nowhere to land beside the gold pillar`);
  }
  for (const [id, shop] of Object.entries(SHOPS)) {
    for (const slug of shop.stock) if (!ITEMS[slug]) errors.push(`shop ${id}: stocks unknown item ${slug}`);
  }
  return errors;
}
