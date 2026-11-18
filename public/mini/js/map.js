// Light Gray Mini: the map.
//
// Every room you enter is already kept in the save (player.seen). The map is
// that list, drawn: each visited room as a one-pixel-per-tile miniature of
// itself, each room an open exit leads to as a dark "?", and nothing else.
// Caves and other places off the overworld have small sheets of their own.
//
// The same screen is how the gold pillars work: at a pillar the cursor moves
// between the pillars you have stood beside, and A takes you there.

import { W, H, HUD_H, Buf, drawText, textWidth, panel, fillRect } from './gfx.js';
import { ROOMS } from './data/rooms.js';
import { TILES, THEMES } from './art-tiles.js';
import { PEOPLE, QUESTS, currentQuest, questProgress } from './data/quests.js';
import { pressed, label } from './input.js';
import { sfx } from './audio.js';

const COLS = 16;
const ROWS = 12;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const SHEET_NAME = {
  field: 'Vega', zero: 'Room Zero', rebirth: 'Plane of Rebirth', basement: 'Under the Cabin',
  spidercave: 'Spider Cave', batcave: 'Bat Cave', ogrelair: 'Ogre Lair', koboldlair: 'Kobold Lair',
  underwater: 'Under the Ocean',
};

// The reward for finding every room. DRAFT name, for Anthony to replace.
export const EVERYWHERE = { flag: 'everywhere', name: 'Been Everywhere', gold: 1000 };

const sheets = new Map();
const cellOf = new Map();
for (const [id, room] of Object.entries(ROOMS)) {
  if (!sheets.has(room.sheet)) sheets.set(room.sheet, []);
  sheets.get(room.sheet).push(id);
  cellOf.set(`${room.sheet}:${room.at[0]},${room.at[1]}`, id);
}

// ------------------------------------------------------- what the map knows

/** The rooms of a sheet and the box they fit in. */
export function sheetLayout(sheet) {
  const ids = sheets.get(sheet) || [];
  const xs = ids.map((id) => ROOMS[id].at[0]);
  const ys = ids.map((id) => ROOMS[id].at[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { ids, minX, minY, cols: Math.max(...xs) - minX + 1, rows: Math.max(...ys) - minY + 1 };
}

function openCell(room, cx, cy) {
  const t = TILES[room.map[cy][cx]];
  return !!t && (!t.solid || (!!room.sea && !!t.water));
}

/** Do two side-by-side rooms share at least one open pair of edge cells? */
function joined(a, b, dx, dy) {
  if (dx) {
    for (let y = 0; y < ROWS; y++) if (openCell(a, dx > 0 ? COLS - 1 : 0, y) && openCell(b, dx > 0 ? 0 : COLS - 1, y)) return true;
    return false;
  }
  for (let x = 0; x < COLS; x++) if (openCell(a, x, dy > 0 ? ROWS - 1 : 0) && openCell(b, x, dy > 0 ? 0 : ROWS - 1)) return true;
  return false;
}

/** Rooms not yet entered that an open exit of a visited room leads to. A locked gate still counts: you can see the road. */
export function knownRooms(player) {
  const out = new Set();
  for (const id of Object.keys(player.seen)) {
    const room = ROOMS[id];
    if (!room) continue;
    for (const [dx, dy] of DIRS) {
      const other = cellOf.get(`${room.sheet}:${room.at[0] + dx},${room.at[1] + dy}`);
      if (!other || player.seen[other] || out.has(other)) continue;
      if (joined(room, ROOMS[other], dx, dy)) out.add(other);
    }
  }
  return out;
}

/** The room a stair, whirlpool or pillar in this room leads to on another sheet, or null. */
export function stairsLink(id) {
  const room = ROOMS[id];
  for (const w of room.warps || []) if (ROOMS[w.to] && ROOMS[w.to].sheet !== room.sheet) return w.to;
  for (const t of room.things || []) if (t.to && ROOMS[t.to] && ROOMS[t.to].sheet !== room.sheet) return t.to;
  return null;
}

/**
 * Is someone in this room waiting on you? 'ready' when a quest of theirs can be
 * turned in, 'offer' when they have a new one for you, null otherwise.
 */
export function questMark(player, id) {
  let offer = null;
  for (const t of ROOMS[id].things || []) {
    if (t.t !== 'npc' || !t.who) continue;
    const person = PEOPLE[t.who];
    if (!person || !person.quests) continue;
    if (person.needsMet && !player.met[person.needsMet]) continue;
    if (person.needsFlag && !player.flags[person.needsFlag]) continue;
    const quest = currentQuest(player, t.who);
    if (!quest) continue;
    if (player.quests[quest] !== 'active') offer = offer || { kind: 'offer', who: t.who, quest };
    else if (questProgress(player, quest).met) return { kind: 'ready', who: t.who, quest };
  }
  return offer;
}

/** A few words on what a room holds, for the line under its name. */
export function roomNotes(id) {
  const room = ROOMS[id];
  const notes = [];
  const kinds = new Set((room.things || []).map((t) => t.t));
  if (kinds.has('hub')) notes.push('Gold pillar');
  if (kinds.has('shop')) notes.push('Shop');
  if (kinds.has('rest')) notes.push('Rest');
  if (kinds.has('craft')) notes.push('Workbench');
  if (kinds.has('chop')) notes.push('Wood');
  if (room.boss) notes.push('Boss');
  const to = stairsLink(id);
  if (to) notes.push(room.sheet === 'zero' ? 'Way out' : ROOMS[to].sheet === 'field' ? 'Way up' : 'Way down');
  return notes;
}

export function roomsFound(player) {
  return Object.keys(player.seen).filter((id) => ROOMS[id]).length;
}

/** Every room there is, except the ones you can't walk to (the Plane of Rebirth). */
export function foundEverything(player) {
  return Object.keys(ROOMS).every((id) => ROOMS[id].offMap || player.seen[id]);
}

/**
 * The next room from `from` in a direction, among the ones `can` allows.
 * Straight ahead first, then a wider look. `far` lets it jump to anything on
 * that side, which the pillars need: there are only seven of them.
 */
export function stepCursor(from, dx, dy, can, far = false) {
  const [fx, fy] = ROOMS[from].at;
  const pick = (spread) => {
    let best = null;
    let bestScore = Infinity;
    for (const id of sheets.get(ROOMS[from].sheet)) {
      if (id === from || !can(id)) continue;
      const [x, y] = ROOMS[id].at;
      const along = (x - fx) * dx + (y - fy) * dy;
      const across = Math.abs((x - fx) * dy) + Math.abs((y - fy) * dx);
      if (along <= 0 || across > along * spread) continue;
      const score = along + across * 1.5;
      if (score < bestScore) { best = id; bestScore = score; }
    }
    return best;
  };
  return pick(1) || pick(2) || (far ? pick(Infinity) : null);
}

// ------------------------------------------------------------- the screen

export function newMapState(here, opts = {}) {
  return {
    type: 'map', cur: here, note: '',
    sheet: opts.travel ? 'field' : ROOMS[here].sheet,
    travel: !!opts.travel, onTravel: opts.onTravel || null,
  };
}

export function updateMap(ui, m) {
  const p = ui.game.p;
  const here = ui.game.roomId;
  if (pressed.b || pressed.start || pressed.map) { sfx.select(); ui.modal = null; return; }

  const known = m.travel ? new Set() : knownRooms(p);
  const can = (id) => (m.travel ? !!ROOMS[id].hub && !!p.seen[id] : !!p.seen[id] || known.has(id));
  for (const [btn, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
    if (!pressed[btn]) continue;
    const next = stepCursor(m.cur, dx, dy, can, m.travel);
    if (next) { m.cur = next; m.note = ''; sfx.select(); }
  }
  if (!pressed.a) return;

  if (m.travel) {
    if (m.cur === here) { sfx.deny(); return; }
    if (p.mp < 1) { sfx.deny(); m.note = 'Not enough MP.'; return; }
    ui.modal = null;
    m.onTravel(m.cur);
    return;
  }
  // A follows a stair to the sheet it leads to, if you have been there.
  const to = stairsLink(m.cur);
  if (to && p.seen[m.cur] && p.seen[to]) { m.sheet = ROOMS[to].sheet; m.cur = to; sfx.confirm(); }
}

function miniKey(th, kind) {
  switch (kind) {
    case 'path': return th.path;
    case 'floor': return th.floor;
    case 'sand': return th.sand;
    case 'bridge': return th.wood;
    case 'tree': return th.leaf;
    case 'bush': return th.leafLight;
    case 'rock': return th.rock;
    // Cave walls are nearly the color of cave floors; their lit rim reads better this small.
    case 'wall': return ['1', '2', '3'].includes(th.wallTop) ? th.wallRim : th.wallTop;
    case 'water': return th.water;
    case 'fence': case 'stump': return th.woodDark;
    case 'cavemouth': case 'stairsdown': return '0';
    case 'stairsup': return '8';
    case 'void': return th.void;
    default: return th.ground;
  }
}

const thumbs = new Map();

/** A room at one pixel per tile. */
function thumb(id) {
  if (!thumbs.has(id)) {
    const room = ROOMS[id];
    const th = THEMES[room.theme] || THEMES.field;
    const b = new Buf(COLS, ROWS);
    room.map.forEach((row, cy) => [...row].forEach((ch, cx) => b.px(cx, cy, miniKey(th, (TILES[ch] || TILES['.']).kind))));
    thumbs.set(id, b.toCanvas(`map ${id}`));
  }
  return thumbs.get(id);
}

function outline(g, x, y, w, h, color) {
  fillRect(g, x, y, w, 1, color);
  fillRect(g, x, y + h - 1, w, 1, color);
  fillRect(g, x, y, 1, h, color);
  fillRect(g, x + w - 1, y, 1, h, color);
}

export function drawMap(g, ui, m) {
  const p = ui.game.p;
  const here = ui.game.roomId;
  const top = HUD_H + 4;
  panel(g, 4, top, W - 8, H - HUD_H - 8, 'Q', 'a');

  const title = m.travel ? 'TRAVEL' : 'MAP';
  drawText(g, title, 12, top + 7, 'J');
  fillRect(g, 12, top + 16, textWidth(title), 1, 'J');
  drawText(g, SHEET_NAME[m.sheet] || '', 12 + textWidth(title) + 10, top + 7, 'a');
  const star = !!p.flags[EVERYWHERE.flag];
  const count = `${star ? '★ ' : ''}${roomsFound(p)} rooms`;
  drawText(g, count, W - 12 - textWidth(count), top + 7, star ? 'J' : 'a');

  // The overworld is drawn at one pixel per tile; the small sheets three times that.
  const lay = sheetLayout(m.sheet);
  const s = m.sheet === 'field' ? 1 : 3;
  const k = s === 1 ? 1 : 2;                 // how big the marks are drawn
  const cw = COLS * s;
  const ch = ROWS * s;
  const x0 = Math.round((W - (lay.cols * (cw + 1) - 1)) / 2);
  const y0 = top + 20 + Math.round((117 - (lay.rows * (ch + 1) - 1)) / 2);
  const known = m.travel ? new Set() : knownRooms(p);
  const blink = (ui.t >> 4) % 2 === 0;

  for (const id of lay.ids) {
    const room = ROOMS[id];
    const x = x0 + (room.at[0] - lay.minX) * (cw + 1);
    const y = y0 + (room.at[1] - lay.minY) * (ch + 1);
    if (p.seen[id]) {
      g.drawImage(thumb(id), x, y, cw, ch);
      if (m.travel && !room.hub) { g.globalAlpha = 0.6; fillRect(g, x, y, cw, ch, 'q'); g.globalAlpha = 1; }
      if ((room.things || []).some((t) => t.t === 'hub')) {
        fillRect(g, x + cw / 2 - 2 * k, y + ch / 2 - 2 * k, 4 * k, 4 * k, '0');
        fillRect(g, x + cw / 2 - k, y + ch / 2 - k, 2 * k, 2 * k, 'Y');
      }
      if (!m.travel) {
        if (stairsLink(id)) {
          fillRect(g, x, y + ch - 4 * k, 5 * k, 4 * k, '0');
          fillRect(g, x + k, y + ch - 3 * k, 3 * k, k, '8');
          fillRect(g, x + 2 * k, y + ch - 2 * k, k, k, '8');
        }
        const mark = questMark(p, id);
        if (mark) {
          const color = mark.kind === 'ready' ? 'I' : 'J';
          fillRect(g, x + cw - 3 * k, y, 3 * k, 7 * k, '0');
          fillRect(g, x + cw - 2 * k, y + k, k, 3 * k, color);
          fillRect(g, x + cw - 2 * k, y + 5 * k, k, k, color);
        }
      }
    } else if (known.has(id)) {
      fillRect(g, x, y, cw, ch, 'j');
      fillRect(g, x + 1, y + 1, cw - 2, ch - 2, 'q');
      drawText(g, '?', x + Math.floor(cw / 2) - 2, y + Math.floor(ch / 2) - 4, 'j');
    } else {
      continue;
    }
    if (id === here && blink) outline(g, x - 1, y - 1, cw + 2, ch + 2, '8');
    if (id === m.cur && (id !== here || !blink)) outline(g, x - 1, y - 1, cw + 2, ch + 2, 'J');
  }

  // Under the map: the room the cursor is on.
  const c = ROOMS[m.cur];
  if (p.seen[m.cur]) {
    drawText(g, `${m.cur}  ${c.name}`, 12, top + 141, m.cur === here ? '9' : 'J');
    if (c.sub && c.sub !== String(m.cur)) drawText(g, c.sub, 12, top + 151, 'a');
    const mark = m.travel ? null : questMark(p, m.cur);
    if (mark && mark.kind === 'ready') drawText(g, `Turn in: ${QUESTS[mark.quest].title}`, 12, top + 161, 'I');
    else if (mark) drawText(g, `${PEOPLE[mark.who].name} has work.`, 12, top + 161, 'J');
    else drawText(g, roomNotes(m.cur).join('  '), 12, top + 161, '9');
  } else {
    drawText(g, '???', 12, top + 141, 'a');
    drawText(g, 'You have not been here.', 12, top + 151, 'a');
  }

  let hint = '';
  if (m.travel) hint = m.note || (m.cur === here ? 'Pick another gold pillar.' : `${label('a')} travels: 1 MP of ${p.mp}`);
  else if (p.seen[m.cur] && stairsLink(m.cur) && p.seen[stairsLink(m.cur)]) hint = `${label('a')} looks at ${SHEET_NAME[ROOMS[stairsLink(m.cur)].sheet]}`;
  drawText(g, hint, 12, top + 172, m.note ? '@' : '%');
  const closes = `${label('back')} closes`;
  drawText(g, closes, W - 12 - textWidth(closes), top + 172, '%');
}
