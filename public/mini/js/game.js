// Light Gray Mini: the world in motion. The hero, the room they are in, what
// lives there, and every roll. Nothing here decides a number on its own; the
// dice are in rules.js and the content is in data/.

import { W, TILE, COLS, ROWS, HUD_H, H, drawText, drawTextOutlined, textWidth, fillRect } from './gfx.js';
import { bakeRoom, TILES, waterGlints } from './art-tiles.js';
import { ROOMS } from './data/rooms.js';
import { ENEMIES } from './data/enemies.js';
import { ITEMS, statLine, countName } from './data/items.js';
import { QUESTS, PEOPLE, currentQuest, questProgress } from './data/quests.js';
import * as R from './rules.js';
import { neighbor, check, edgeGate, EDGES } from './world.js';
import { pressed, axis, clearInput, label } from './input.js';
import { sfx, playSong } from './audio.js';
import { saveGame } from './state.js';
import { foundEverything, roomsFound, EVERYWHERE } from './map.js';

const FIELD_H = ROWS * TILE;
const SPEED = 1.25;
const SWING_T = 16;
const BODY = { x: 3, y: 8, w: 10, h: 8 };   // the hero's feet, for walls
const HURT = { x: 3, y: 3, w: 10, h: 12 };  // the hero's body, for teeth
const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const rnd = (n) => Math.floor(Math.random() * n);
const CLASH_SETTLE = 6;   // frames the dice tumble before they show what was rolled

/** The feed line for one of your own hits: what hit, both rolls, what came of it. */
function rollFeed(verb, verbColor, name, roll, color) {
  if (roll.crit) return [['CRIT', '$'], [name, 'a'], [`${roll.a}`, color], ['-', '%'], [`${roll.d}`, 'K'], ['x2 =', '%'], [`${roll.dmg}`, '$']];
  return [[verb, verbColor], [name, 'a'], [`${roll.a}`, color], ['-', '%'], [`${roll.d}`, 'K'], ['=', '%'], [`${roll.dmg}`, roll.dmg ? '9' : '%']];
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Game {
  constructor({ sprites, ui, player }) {
    this.S = sprites;
    this.ui = ui;
    ui.game = this;
    this.p = player;
    this.maps = new Map();    // room id -> its rows this session (bushes get cut)
    this.bakes = new Map();   // room id -> painted canvases
    this.glints = waterGlints();
    this.hero = { x: 0, y: 0, dir: 'down', step: 0, swing: 0, hits: new Set(), inv: 0, kx: 0, ky: 0, kt: 0, cdY: 0, cdB: 0, boom: false, onWarp: false };
    this.canSail = false;
    this.mobs = [];
    this.shots = [];
    this.floats = [];
    this.parts = [];
    this.clashes = [];        // the two dice of a hit, shown where it landed
    this.shake = 0;
    this.things = [];
    this.mode = 'play';
    this.slide = null;
    this.fade = null;
    this.t = 0;
  }

  // ---------------------------------------------------------------- rooms

  mapOf(id) {
    if (!this.maps.has(id)) this.maps.set(id, [...ROOMS[id].map]);
    return this.maps.get(id);
  }

  bakeOf(id) {
    if (!this.bakes.has(id)) this.bakes.set(id, bakeRoom({ ...ROOMS[id], id, map: this.mapOf(id) }));
    return this.bakes.get(id);
  }

  makeThings(id) {
    return (ROOMS[id].things || []).map((def) => ({
      def, t: def.t, cx: def.x, cy: def.y, w: def.w || 1, h: def.h || 1,
      solid: def.solid !== undefined ? def.solid : def.t !== 'read',
    }));
  }

  thingHidden(th) {
    const d = th.def;
    return !!((d.hideWhenHeld && R.hasItem(this.p, d.item)) || (d.gone && check(this.p, d.gone)));
  }

  setRoom(id, things = null) {
    const room = ROOMS[id];
    this.roomId = id;
    this.room = room;
    this.map = this.mapOf(id);
    this.bake = this.bakeOf(id);
    this.things = things || this.makeThings(id);
    this.mobs = [];
    this.shots = [];
    this.clashes = [];
    this.hero.boom = false;
    this.canSail = R.hasItem(this.p, 'wooden-boat');
    this.rebuildSolid();
    this.waterCells = [];
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) if ((TILES[this.map[cy][cx]] || {}).water) this.waterCells.push([cx, cy]);
    }
    this.p.room = id;
    this.fresh = !this.p.seen[id];     // the first time here: it goes on the map
    this.p.seen[id] = true;
    if (room.hub) this.p.hub = id;
  }

  rebuildSolid() {
    const s = new Uint8Array(COLS * ROWS);
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const t = TILES[this.map[cy][cx]] || {};
        // 1 is a wall. 2 is open water: a wall to feet, a road to a boat.
        if (t.water && this.room.sea) s[cy * COLS + cx] = 2;
        else if (t.solid) s[cy * COLS + cx] = 1;
      }
    }
    for (const th of this.things) {
      if (!th.solid || this.thingHidden(th)) continue;
      for (let y = th.cy; y < th.cy + th.h; y++) for (let x = th.cx; x < th.cx + th.w; x++) s[y * COLS + x] = 1;
    }
    this.solid = s;
  }

  /** Arrive in a room at a cell: the start, stairs, pillars, rebirth. */
  enterRoom(id, cx, cy, dir = 'down') {
    this.setRoom(id);
    const h = this.hero;
    h.x = cx * TILE;
    h.y = cy * TILE - 4;
    h.dir = dir;
    h.swing = 0;
    h.kt = 0;
    h.onWarp = false;
    this.arrive();
  }

  arrive() {
    this.spawnMobs();
    this.hero.inv = Math.max(this.hero.inv, 45);   // a breath before anything bites
    this.ui.showBanner(this.roomId, this.room, this.fresh);
    if (!this.p.flags[EVERYWHERE.flag] && foundEverything(this.p)) {
      this.p.flags[EVERYWHERE.flag] = true;
      this.p.gold += EVERYWHERE.gold;
      sfx.secret();
      this.ui.toast(`\u2605 ACHIEVEMENT: ${EVERYWHERE.name}`, 'J');
      this.ui.toast(`Every room found. +${EVERYWHERE.gold} gold`, '9');
    }
    playSong(this.mobs.some((m) => m.def.boss) ? 'boss' : this.room.music);
    this.p.x = this.hero.x;
    this.p.y = this.hero.y;
    this.p.dir = this.hero.dir;
    saveGame(this.p);
  }

  spawnMobs() {
    const h = this.hero;
    const hcx = Math.floor((h.x + 8) / TILE);
    const hcy = Math.floor((h.y + 12) / TILE);
    const taken = new Set();
    for (const [slug, n] of this.room.spawns || []) {
      const def = ENEMIES[slug];
      const want = def.swim ? 2 : 0;
      for (let i = 0; i < n; i++) {
        for (let tries = 0; tries < 80; tries++) {
          const cx = 1 + rnd(COLS - 2);
          const cy = 1 + rnd(ROWS - 2);
          const v = this.solid[cy * COLS + cx];
          if ((def.flying ? v === 1 : v !== want) || taken.has(cy * COLS + cx)) continue;
          if (Math.abs(cx - hcx) + Math.abs(cy - hcy) < 5) continue;
          const m = this.makeMob(slug, cx, cy);
          if (!this.boxFree(m.x + m.bx, m.y + m.by, m.bw, m.bh, false, m.mode)) continue;
          taken.add(cy * COLS + cx);
          this.mobs.push(m);
          break;
        }
      }
    }
    const boss = this.room.boss;
    if (boss) {
      const rest = (ENEMIES[boss.slug].restMinutes || 5) * 60000;
      const down = this.p.downAt[boss.slug];
      if (!down || Date.now() - down > rest) this.mobs.push(this.makeMob(boss.slug, boss.cx, boss.cy));
    }
  }

  /** An enemy standing in a cell. Big ones are centered on it. */
  makeMob(slug, cx, cy) {
    const def = ENEMIES[slug];
    const spr = this.S.creatureFor(def);
    const f = spr.h / 16;
    const bx = Math.round((spr.w > spr.h ? 3 : 2) * f);
    const calm = def.passive || (def.calmFlag && this.p.flags[def.calmFlag]);
    return {
      slug, def, spr,
      x: cx * TILE - (spr.w - TILE) / 2, y: cy * TILE + TILE - spr.h - 2,
      hp: def.hp, face: Math.random() < 0.5 ? 1 : -1, anim: 0,
      t: 20 + rnd(60), vx: 0, vy: 0, stun: 0, kx: 0, ky: 0, atkCd: 40, flash: 0,
      aggro: !calm, state: 'idle', st: 0, lx: 0, ly: 0, seed: rnd(1000),
      shootT: def.shoot ? Math.round(def.shoot.every * (0.5 + Math.random() * 0.5)) : 0,
      mode: def.flying ? 'fly' : def.swim ? 'swim' : 'walk',
      bx, by: Math.round(6 * f), bw: spr.w - bx * 2, bh: Math.round(9 * f),
    };
  }

  // ------------------------------------------------------------ collision

  /** who: 'hero' | 'walk' | 'swim' | 'fly' | 'shot' */
  solidAt(px, py, clampOut, who = 'walk') {
    let cx = Math.floor(px / TILE);
    let cy = Math.floor(py / TILE);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) {
      if (!clampOut) return true;
      cx = Math.max(0, Math.min(COLS - 1, cx));
      cy = Math.max(0, Math.min(ROWS - 1, cy));
    }
    if (who === 'fly') return false;
    const v = this.solid[cy * COLS + cx];
    if (v === 1) return true;
    if (v === 2) return who === 'walk' || (who === 'hero' && !this.canSail);
    return who === 'swim';     // dry land stops a fish
  }

  boxFree(x, y, w, h, clampOut, who = 'walk') {
    x = Math.floor(x); y = Math.floor(y);
    for (let py = y; ; py = Math.min(py + 8, y + h - 1)) {
      for (let px = x; ; px = Math.min(px + 8, x + w - 1)) {
        if (this.solidAt(px, py, clampOut, who)) return false;
        if (px === x + w - 1) break;
      }
      if (py === y + h - 1) break;
    }
    return true;
  }

  heroFree(x, y) {
    return this.boxFree(x + BODY.x, y + BODY.y, BODY.w, BODY.h, true, 'hero');
  }

  moveHero(dx, dy) {
    const h = this.hero;
    if (dx) {
      if (this.heroFree(h.x + dx, h.y)) h.x += dx;
      else if (!dy) {
        // Round the corner instead of sticking on it.
        for (let k = 1; k <= 5; k++) {
          if (this.heroFree(h.x + dx, h.y - k)) { h.y -= 1; break; }
          if (this.heroFree(h.x + dx, h.y + k)) { h.y += 1; break; }
        }
      }
    }
    if (dy) {
      if (this.heroFree(h.x, h.y + dy)) h.y += dy;
      else if (!dx) {
        for (let k = 1; k <= 5; k++) {
          if (this.heroFree(h.x - k, h.y + dy)) { h.x -= 1; break; }
          if (this.heroFree(h.x + k, h.y + dy)) { h.x += 1; break; }
        }
      }
    }
  }

  moveMob(m, dx, dy) {
    let hit = false;
    if (dx) {
      if (this.boxFree(m.x + m.bx + dx, m.y + m.by, m.bw, m.bh, false, m.mode)) m.x += dx; else hit = true;
    }
    if (dy) {
      if (this.boxFree(m.x + m.bx, m.y + m.by + dy, m.bw, m.bh, false, m.mode)) m.y += dy; else hit = true;
    }
    return hit;
  }

  // ---------------------------------------------------------------- update

  update() {
    this.t += 1;
    if (this.shake > 0) this.shake -= 1;
    if (this.mode === 'slide') return this.updateSlide();
    if (this.mode === 'fade') return this.updateFade();
    if (this.mode === 'dead') return undefined;

    if (pressed.start) { this.ui.openMenu(); return undefined; }
    if (pressed.map) { this.ui.openMap(); return undefined; }
    this.updateHero();
    if (this.mode !== 'play' || this.ui.busy) return undefined;
    for (const m of [...this.mobs]) this.updateMob(m);
    this.updateShots();
    this.updateBits();
    return undefined;
  }

  updateBits() {
    for (const f of this.floats) { f.t += 1; if (f.t > 0) f.y -= 0.45; }
    this.floats = this.floats.filter((f) => f.t < 50);
    for (const c of this.clashes) { c.t += 1; if (c.t > CLASH_SETTLE) c.y -= 0.45; }
    this.clashes = this.clashes.filter((c) => c.t < 42);
    for (const q of this.parts) { q.x += q.vx; q.y += q.vy; q.vy += q.g || 0; q.t += 1; }
    this.parts = this.parts.filter((q) => q.t < q.life);
  }

  updateHero() {
    const h = this.hero;
    const px = h.x;
    const py = h.y;
    this.canSail = R.hasItem(this.p, 'wooden-boat');
    if (h.inv > 0) h.inv -= 1;
    if (h.cdY > 0) h.cdY -= 1;
    if (h.cdB > 0) h.cdB -= 1;
    if (h.kt > 0) {
      h.kt -= 1;
      this.moveHero(h.kx, 0);
      this.moveHero(0, h.ky);
      h.kx *= 0.82;
      h.ky *= 0.82;
    }

    if (h.swing > 0) {
      const f = SWING_T - h.swing;
      if (f >= 2 && f <= 9) this.swingHits();
      h.swing -= 1;
    } else {
      const a = axis();
      if (a.x || a.y) {
        // Face the way you are going; on a diagonal keep the old facing if it fits.
        const fits = (h.dir === 'left' && a.x < 0) || (h.dir === 'right' && a.x > 0) ||
          (h.dir === 'up' && a.y < 0) || (h.dir === 'down' && a.y > 0);
        if (!fits) h.dir = a.x ? (a.x < 0 ? 'left' : 'right') : (a.y < 0 ? 'up' : 'down');
        const s = SPEED * (a.x && a.y ? 0.7071 : 1);
        this.moveHero(a.x * s, 0);
        this.moveHero(0, a.y * s);
        h.step += 1;
      } else {
        h.step = 0;
      }
      if (pressed.a) {
        const th = this.facingThing();
        if (th) this.interact(th);
        else this.startSwing();
      } else if (pressed.b) this.throwBoomerang();
      else if (pressed.y) this.castSpell();
      else if (pressed.x) this.quickItem();
    }
    if (this.ui.busy || this.mode !== 'play') return;

    // Off the edge of the screen: the next room, or a gate.
    const cx = h.x + 8;
    const cy = h.y + 12;
    const edge = cx < 0 ? 'W' : cx >= W ? 'E' : cy < 0 ? 'N' : cy >= FIELD_H ? 'S' : null;
    if (edge) {
      // You leave a room by walking out of it. Being knocked out of one does not count.
      const a = axis();
      const walking = (edge === 'W' && a.x < 0) || (edge === 'E' && a.x > 0) || (edge === 'N' && a.y < 0) || (edge === 'S' && a.y > 0);
      if (walking) { this.tryExit(edge); return; }
      if (edge === 'W') h.x = -7;
      if (edge === 'E') h.x = W - 9;
      if (edge === 'N') h.y = -11;
      if (edge === 'S') h.y = FIELD_H - 13;
      return;
    }

    // Stairs.
    const wcx = Math.floor(cx / TILE);
    const wcy = Math.floor(cy / TILE);
    const warp = (this.room.warps || []).find((w) => w.x === wcx && w.y === wcy);
    if (!warp) { h.onWarp = false; return; }
    if (h.onWarp) return;
    if (!check(this.p, warp.need)) {
      h.x = px; h.y = py;
      this.pushOff(warp);
      clearInput();
      this.ui.say('', warp.msg);
      return;
    }
    sfx.door();
    this.startFade(() => this.enterRoom(warp.to, warp.cx, warp.cy, warp.dir || 'down'));
  }

  /** Step the hero off a stair they may not use. */
  pushOff(warp) {
    const h = this.hero;
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const x = (warp.x + dx) * TILE;
      const y = (warp.y + dy) * TILE - 4;
      if (this.heroFree(x, y)) { h.x = x; h.y = y; return; }
    }
  }

  tryExit(edge) {
    const h = this.hero;
    const msg = edgeGate(this.p, this.roomId, edge);
    const nb = neighbor(this.roomId, edge);
    if (msg || !nb) {
      if (edge === 'W') h.x = -2;
      if (edge === 'E') h.x = W - 14;
      if (edge === 'N') h.y = -6;
      if (edge === 'S') h.y = FIELD_H - 18;
      clearInput();
      if (msg) this.ui.say('', msg);
      return;
    }
    const e = EDGES[edge];
    this.slide = {
      edge, t: 0, T: 26, toId: nb,
      toBake: this.bakeOf(nb), toThings: this.makeThings(nb),
      nx: e.dx < 0 ? W - 14 : e.dx > 0 ? -2 : h.x,
      ny: e.dy < 0 ? FIELD_H - 18 : e.dy > 0 ? -6 : h.y,
    };
    this.mobs = [];
    this.shots = [];
    this.floats = [];
    h.swing = 0;
    this.mode = 'slide';
  }

  updateSlide() {
    const s = this.slide;
    s.t += 1;
    this.hero.step += 1;
    if (s.t < s.T) return;
    this.setRoom(s.toId, s.toThings);
    this.hero.x = s.nx;
    this.hero.y = s.ny;
    this.slide = null;
    this.mode = 'play';
    this.arrive();
  }

  startFade(mid) {
    this.fade = { t: 0, T: 24, mid };
    this.mode = 'fade';
  }

  updateFade() {
    const f = this.fade;
    f.t += 1;
    if (f.t === f.T / 2) { this.mode = 'fade'; f.mid(); this.mode = 'fade'; }
    if (f.t >= f.T) { this.fade = null; this.mode = 'play'; }
  }

  // ----------------------------------------------------------- the sword

  /** tool: what is in the hand for this swing, when it is not the sword. */
  startSwing(tool = null) {
    const h = this.hero;
    h.swing = SWING_T;
    h.tool = tool;
    h.hits = new Set();
    sfx.swing();
  }

  swingRect() {
    const h = this.hero;
    const reach = this.p.gear.sword ? 15 : 8;   // no sword: a punch
    if (h.dir === 'right') return { x: h.x + 11, y: h.y - 1, w: reach, h: 18 };
    if (h.dir === 'left') return { x: h.x + 5 - reach, y: h.y - 1, w: reach, h: 18 };
    if (h.dir === 'up') return { x: h.x - 1, y: h.y + 5 - reach, w: 18, h: reach };
    return { x: h.x - 1, y: h.y + 11, w: 18, h: reach };
  }

  swingHits() {
    const h = this.hero;
    const rect = this.swingRect();
    const stats = R.effectiveStats(this.p);
    const wings = R.hasItem(this.p, 'wings');
    for (const m of [...this.mobs]) {
      if (h.hits.has(m)) continue;
      if (!overlap(rect, { x: m.x + 1, y: m.y + 2, w: m.spr.w - 2, h: m.spr.h - 3 })) continue;
      h.hits.add(m);
      if (m.def.flying && !wings) {
        this.float(m.x + m.spr.w / 2 - 12, m.y - 4, 'MISS', '%');
        this.ui.setFeed([[`The ${m.def.name} is flying.`, '9'], ["A sword can't reach it.", 'a']]);
        continue;
      }
      const roll = R.strike(stats.str, m.def.def);
      this.hurtMob(m, roll.dmg, DIRV[h.dir], rollFeed('You hit', '9', m.def.name, roll, 'A'), roll, 'A');
    }
    // Bushes fall to anything with an edge.
    if (!this.p.gear.sword) return;
    for (const [fx, fy] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8], [0.5, 0.5]]) {
      const cx = Math.floor((rect.x + rect.w * fx) / TILE);
      const cy = Math.floor((rect.y + rect.h * fy) / TILE);
      if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) continue;
      if ((TILES[this.map[cy][cx]] || {}).cut) this.cutBush(cx, cy);
    }
  }

  cutBush(cx, cy) {
    const row = this.map[cy];
    this.map[cy] = row.slice(0, cx) + '.' + row.slice(cx + 1);
    this.bakes.delete(this.roomId);
    this.bake = this.bakeOf(this.roomId);
    this.rebuildSolid();
    sfx.cut();
    for (let i = 0; i < 8; i++) {
      this.parts.push({ x: cx * TILE + 8, y: cy * TILE + 8, vx: (Math.random() - 0.5) * 2.4, vy: -Math.random() * 2, g: 0.12, t: 0, life: 22, color: i % 2 ? 'h' : 'g' });
    }
    if (Math.random() < 0.3) {
      const n = 1 + rnd(3);
      this.p.gold += n;
      this.float(cx * TILE + 4, cy * TILE, `+${n}`, 'J');
      sfx.coin();
    }
  }

  // ------------------------------------------------------- hurting things

  /** delay: frames to wait before it shows, so a number can land after its dice. */
  float(x, y, text, color, delay = 0) {
    this.floats.push({ x, y, text, color, t: -delay });
  }

  /**
   * Show the dice of a hit over whatever it hit: the attack roll on the left,
   * the block on the right (none for a spell nothing blocks). They tumble for a
   * moment, meet, and the damage number comes out underneath.
   */
  clash(cx, y, roll, colorA, colorD = 'K') {
    this.clashes.push({
      x: Math.max(20, Math.min(W - 20, Math.round(cx))), y: Math.max(2, y),
      a: roll.a, d: roll.d === undefined ? null : roll.d,
      aMax: roll.aMax || roll.a, dMax: roll.dMax || roll.d || 0,
      crit: !!roll.crit, ca: colorA, cd: colorD, t: 0, seed: rnd(97),
    });
    if (this.clashes.length > 6) this.clashes.shift();
  }

  /** roll: the dice behind the number, when there are any to show. */
  hurtMob(m, dmg, dir, feed, roll = null, colorA = 'A') {
    m.aggro = true;
    m.flash = 8;
    this.ui.setFeed(feed);
    const fx = m.x + m.spr.w / 2 - 3;
    const wait = roll ? CLASH_SETTLE : 0;
    if (roll) this.clash(m.x + m.spr.w / 2, m.y - 16, roll, colorA);
    if (dmg <= 0) {
      sfx.block();
      this.float(fx, m.y - 4, '0', '%', wait);
      m.stun = 5;
      const nudge = m.def.ai === 'turret' ? 0 : 1.2;
      m.kx = dir[0] * nudge; m.ky = dir[1] * nudge;
      return;
    }
    const crit = !!(roll && roll.crit);
    if (crit) {
      sfx.crit();
      this.shake = 8;
      this.float(fx - 9, m.y - 27, 'CRIT', '$', wait);
    } else sfx.hit();
    this.float(fx - (dmg > 9 ? 3 : 0), m.y - 4, `${dmg}`, crit ? '$' : '8', wait);
    m.hp -= dmg;
    m.stun = m.def.boss ? 6 : 12;
    const push = m.def.ai === 'turret' ? 0 : m.def.boss ? 1 : 2.6;
    m.kx = dir[0] * push; m.ky = dir[1] * push;
    if (m.state === 'windup') m.state = 'stalk';
    if (m.hp <= 0) this.killMob(m);
  }

  killMob(m) {
    const p = this.p;
    const d = m.def;
    this.mobs = this.mobs.filter((o) => o !== m);
    sfx.kill();
    this.parts.push({ poof: true, x: m.x + m.spr.w / 2 - 8, y: m.y + m.spr.h / 2 - 8, vx: 0, vy: 0, t: 0, life: 15 });

    const xp = R.enemyXp(d.level, d.boss);
    const gold = R.rand(d.gold[0], d.gold[1]);
    p.gold += gold;
    p.kills[m.slug] = (p.kills[m.slug] || 0) + 1;
    const got = [];
    for (const [slug, chance] of d.drops || []) {
      if (Math.random() < chance && R.addItem(p, slug, 1)) got.push(slug);
    }
    const feed = [[`${d.name} dies.`, '9'], [`+${xp} XP`, 'I']];
    if (gold) feed.push([`+${gold} gold`, 'J']);
    const names = [...new Set(got)].map((s) => ITEMS[s].name);
    if (names.length) feed.push([names.join(', '), '9']);
    this.ui.setFeed(feed);
    this.float(m.x, m.y - 6, `+${xp} XP`, 'I');

    if (d.first && !p.flags[`first:${m.slug}`]) {
      p.flags[`first:${m.slug}`] = true;
      const worn = R.takeGear(p, d.first);
      const item = ITEMS[d.first];
      this.ui.toast(`First kill: ${item.name}  ${statLine(item)}${worn ? '' : ' (kept)'}`, 'J');
      sfx.item();
    }
    if (d.boss) {
      p.downAt[m.slug] = Date.now();
      if (p.splits[m.slug] === undefined) {
        p.splits[m.slug] = p.frames;
        if (R.KINGS.includes(m.slug)) this.ui.toast(`${d.name}  ${R.clock(p.frames)}`, 'a');
      }
      playSong(this.room.music);
    }
    this.noteProgress(m.slug, got);
    this.gainXp(xp);
    saveGame(p);
  }

  /** Tell the player when a kill or a pickup moved a quest along. */
  noteProgress(killSlug, itemSlugs) {
    const p = this.p;
    for (const [id, q] of Object.entries(QUESTS)) {
      if (p.quests[id] !== 'active') continue;
      const touches = (q.need.kills && q.need.kills[0] === killSlug) ||
        (q.need.killsAll && q.need.killsAll.includes(killSlug) && this.p.kills[killSlug] === 1) ||
        (q.need.item && itemSlugs.includes(q.need.item[0]));
      if (!touches) continue;
      const pr = questProgress(p, id);
      this.ui.toast(`${q.title}  ${pr.have}/${pr.want}`, pr.met ? 'I' : '9');
    }
  }

  gainXp(amount) {
    const ups = R.addXp(this.p, amount);
    for (const up of ups) {
      sfx.level();
      this.ui.toast(`LEVEL ${up.level}`, 'J');
      this.ui.toast(`+${up.hp} HP  +${up.mp} MP  +1 point. ${label('start')} spends it.`, '9');
      this.float(this.hero.x - 8, this.hero.y - 10, 'LEVEL UP', 'J');
    }
  }

  hurtHero(m) {
    m.atkCd = 55;
    this.hurtHeroBy(m.def, m.x + m.spr.w / 2, m.y + m.spr.h / 2);
  }

  /** Something lands on the hero: a body or a shot, from (mx, my). */
  hurtHeroBy(d, mx, my) {
    const h = this.hero;
    const p = this.p;
    const hit = R.enemyHit(d, R.effectiveStats(p));
    let dx = h.x + 8 - mx;
    let dy = h.y + 8 - my;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    // Each kind of attack is blocked by its own stat, and the die wears that stat's color.
    const guard = d.type === 'ranged' ? 'I' : d.type === 'magic' ? 'L' : 'K';
    const feed = [[d.name, 'a'], [hit.special ? `${hit.special}s you` : 'hits you', '9'],
      [`${hit.a}`, '@'], ['-', '%'], [`${hit.d}`, guard], ['=', '%'], [`${hit.dmg}`, hit.dmg ? '@' : '%']];
    this.ui.setFeed(feed);
    this.clash(h.x + 8, h.y - 18, { ...hit, aMax: d.att, dMax: Math.max(0, R.defenseFor(d.type, R.effectiveStats(p))) }, '@', guard);
    if (hit.dmg <= 0) {
      sfx.block();
      this.float(h.x + 5, h.y - 6, '0', '%', CLASH_SETTLE);
      h.inv = 22;
      h.kx = dx * 1.6; h.ky = dy * 1.6; h.kt = 6;
      return;
    }
    sfx.hurt();
    this.float(h.x + 5, h.y - 6, `${hit.dmg}`, '@', CLASH_SETTLE);
    p.hp = Math.max(0, p.hp - hit.dmg);
    h.inv = 50;
    h.kx = dx * 3; h.ky = dy * 3; h.kt = 10;
    h.swing = 0;
    if (p.hp <= 0) this.die(d.name);
  }

  die(byName) {
    this.mode = 'dead';
    this.mobs.forEach((m) => { m.stun = 9999; });
    sfx.dead();
    playSong(null);
    // The main game's words.
    this.ui.deadCard(`The ${byName} overwhelms you. You black out...`, () => this.rise());
  }

  /** Dead is not the end for a Wanderer: wake at 1 HP in the Plane of Rebirth. */
  rise() {
    this.p.deaths += 1;
    this.p.hp = 1;
    this.mode = 'play';
    this.floats = [];
    this.hero.inv = 0;
    this.enterRoom('999', 7, 7, 'up');
  }

  // ------------------------------------------------------------- enemies

  updateMob(m) {
    const h = this.hero;
    const d = m.def;
    if (m.flash > 0) m.flash -= 1;
    if (m.atkCd > 0) m.atkCd -= 1;
    if (m.stun > 0) {
      m.stun -= 1;
      this.moveMob(m, m.kx, 0);
      this.moveMob(m, 0, m.ky);
      m.kx *= 0.8; m.ky *= 0.8;
      return;
    }
    const mx = m.x + m.spr.w / 2;
    const my = m.y + m.spr.h - 6;
    let dx = h.x + 8 - mx;
    let dy = h.y + 10 - my;
    const dist = Math.hypot(dx, dy) || 1;
    dx /= dist; dy /= dist;
    const hunting = m.aggro && (d.boss || dist < 110);
    const waiting = !m.aggro && !d.passive;    // paid off, and keeping his word
    let vx = 0;
    let vy = 0;

    const drift = () => {
      if (--m.t <= 0) {
        m.t = 30 + rnd(70);
        if (Math.random() < 0.35) { m.vx = 0; m.vy = 0; }
        else { const a = Math.random() * 6.283; m.vx = Math.cos(a) * d.speed; m.vy = Math.sin(a) * d.speed; }
      }
      vx = m.vx; vy = m.vy;
    };

    if (waiting || d.ai === 'turret') {
      // stands where it is
    } else if (d.ai === 'flutter') {
      // Bats: at you, but never in a straight line.
      if (hunting) {
        const w = Math.sin((this.t + m.seed) / 9) * 0.9;
        vx = (dx - dy * w) * d.speed; vy = (dy + dx * w) * d.speed;
      } else drift();
    } else if (d.ai === 'shooter') {
      // Keeps its distance and circles.
      if (hunting) {
        const dir = dist < 54 ? -1 : dist > 96 ? 1 : 0;
        const side = Math.sin((this.t + m.seed) / 40) > 0 ? 1 : -1;
        vx = (dx * dir - dy * side * 0.5) * d.speed; vy = (dy * dir + dx * side * 0.5) * d.speed;
      } else drift();
    } else if (d.ai === 'blink') {
      drift();
      if (--m.st <= 0) { m.st = 150; this.blink(m); }
    } else if (d.ai === 'chase' || (d.ai === 'wander' && hunting)) {
      if (hunting) { vx = dx * d.speed; vy = dy * d.speed; } else drift();
    } else if (d.ai === 'wander') {
      drift();
    } else if (d.ai === 'sidle') {
      // Crabs: side to side, closing in when you are near.
      if (--m.t <= 0) { m.t = 40 + rnd(60); m.vx = (Math.random() < 0.5 ? -1 : 1) * d.speed; }
      vx = m.vx;
      if (hunting && dist < 70) { vy = dy * d.speed * 0.6; vx = Math.sign(dx || 1) * d.speed; }
    } else if (d.ai === 'hop') {
      // Spiders: sit, then spring.
      if (m.state === 'spring') {
        vx = m.lx * d.speed * 3.4; vy = m.ly * d.speed * 3.4;
        if (--m.st <= 0) { m.state = 'idle'; m.t = 35 + rnd(45); }
      } else if (--m.t <= 0) {
        m.state = 'spring'; m.st = 13;
        if (hunting) { m.lx = dx; m.ly = dy; } else { const a = Math.random() * 6.283; m.lx = Math.cos(a) * 0.6; m.ly = Math.sin(a) * 0.6; }
      }
    } else if (d.ai === 'lunge') {
      // The Gator: stalk, coil, lunge, recover.
      if (m.state === 'idle') m.state = 'stalk';
      if (m.state === 'stalk') {
        vx = dx * d.speed; vy = dy * d.speed;
        if (m.st > 0) m.st -= 1;
        else if (dist < 78) { m.state = 'windup'; m.st = 28; m.lx = dx; m.ly = dy; }
      } else if (m.state === 'windup') {
        if (--m.st <= 0) { m.state = 'dash'; m.st = 20; }
      } else if (m.state === 'dash') {
        vx = m.lx * 2.9; vy = m.ly * 2.9;
        if (--m.st <= 0) { m.state = 'rest'; m.st = 50; }
      } else if (--m.st <= 0) { m.state = 'stalk'; m.st = 45; }
    }

    if (vx || vy) {
      const hitX = this.moveMob(m, vx, 0);
      const hitY = this.moveMob(m, 0, vy);
      if (hitX) m.vx = -m.vx;
      if (hitY) m.vy = -m.vy;
      if ((hitX || hitY) && m.state === 'dash') { m.state = 'rest'; m.st = 50; }
      if (Math.abs(vx) > 0.05) m.face = vx > 0 ? 1 : -1;
      m.anim += 1;
    }

    if (d.shoot && m.aggro && (d.boss || dist < 150) && this.mode === 'play' && --m.shootT <= 0) {
      m.shootT = d.shoot.every;
      this.mobShoot(m, dx, dy);
    }

    if (m.aggro && m.atkCd <= 0 && h.inv <= 0 && this.mode === 'play') {
      const body = { x: m.x + m.bx, y: m.y + m.by - 2, w: m.bw, h: m.bh + 3 };
      const hurt = { x: h.x + HURT.x, y: h.y + HURT.y, w: HURT.w, h: HURT.h };
      if (overlap(body, hurt)) this.hurtHero(m);
    }
  }

  // --------------------------------------------------- thrown and cast

  /** The Kobold Master's trick: gone, then somewhere else. */
  blink(m) {
    const h = this.hero;
    for (let tries = 0; tries < 60; tries++) {
      const cx = 1 + rnd(COLS - 2);
      const cy = 1 + rnd(ROWS - 2);
      const x = cx * TILE - (m.spr.w - TILE) / 2;
      const y = cy * TILE + TILE - m.spr.h - 2;
      if (Math.abs(cx * TILE - h.x) + Math.abs(cy * TILE - h.y) < 64) continue;
      if (!this.boxFree(x + m.bx, y + m.by, m.bw, m.bh, false, 'walk')) continue;
      this.parts.push({ poof: true, x: m.x + m.spr.w / 2 - 8, y: m.y + m.spr.h / 2 - 8, vx: 0, vy: 0, t: 0, life: 15 });
      m.x = x; m.y = y;
      this.parts.push({ poof: true, x: m.x + m.spr.w / 2 - 8, y: m.y + m.spr.h / 2 - 8, vx: 0, vy: 0, t: 0, life: 15 });
      sfx.cast();
      return;
    }
  }

  mobShoot(m, dx, dy) {
    const sh = m.def.shoot;
    const n = sh.n || 1;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < n; i++) {
      const ang = base + (i - (n - 1) / 2) * (sh.spread || 0);
      this.shots.push({
        foe: true, kind: sh.kind, type: sh.type || m.def.type, att: m.def.att, name: m.def.name,
        x: m.x + m.spr.w / 2 - 3, y: m.y + m.spr.h / 2 - 3,
        vx: Math.cos(ang) * sh.speed, vy: Math.sin(ang) * sh.speed, t: 0,
      });
    }
    sfx.shoot();
  }

  throwBoomerang() {
    const h = this.hero;
    const ranged = ITEMS[this.p.gear.ranged];
    if (!ranged) return;
    const [dx, dy] = DIRV[h.dir];
    if (ranged.arrow) {
      if (h.cdB > 0) return;
      h.cdB = 22;
      sfx.shoot();
      this.shots.push({ kind: 'arrow', dir: h.dir, x: h.x + 5 + dx * 8, y: h.y + 7 + dy * 8, vx: dx * 4.4, vy: dy * 4.4, t: 0 });
      return;
    }
    if (h.boom) return;
    h.boom = true;
    sfx.shoot();
    this.shots.push({ kind: 'boom', x: h.x + 4 + dx * 8, y: h.y + 6 + dy * 8, vx: dx * 3.2, vy: dy * 3.2, t: 0, back: false, hits: new Set() });
  }

  castSpell() {
    const h = this.hero;
    const p = this.p;
    if (!p.spell || h.cdY > 0) return;
    const s = R.SPELLS[p.spell];
    const mag = R.effectiveStats(p).mag;
    if (p.mp < s.mp) { sfx.deny(); this.ui.setFeed([['Not enough MP.', 'E']]); return; }
    if (s.kind === 'heal') {
      if (p.hp >= p.hpMax) { sfx.deny(); this.ui.setFeed([['You are not hurt.', 'a']]); return; }
      p.mp -= s.mp;
      const n = Math.min(s.roll(mag), p.hpMax - p.hp);
      p.hp += n;
      sfx.heal();
      this.float(h.x + 2, h.y - 6, `+${n}`, 'I');
      this.ui.setFeed([[s.name, 'L'], [`+${n} HP`, 'A']]);
      h.cdY = 30;
      return;
    }
    const [dx, dy] = DIRV[h.dir];
    p.mp -= s.mp;
    h.cdY = 22;
    sfx.cast();
    this.shots.push({ kind: 'orb', spell: p.spell, x: h.x + 5 + dx * 8, y: h.y + 6 + dy * 8, vx: dx * 3.4, vy: dy * 3.4, t: 0 });
  }

  quickItem() {
    const p = this.p;
    if (!p.quick || !p.bag[p.quick]) { sfx.deny(); this.ui.setFeed([[`Nothing on ${label('x')}. Pick something in the bag.`, 'a']]); return; }
    const slug = p.quick;
    const res = R.useItem(p, slug);
    if (!res || res.wasted) { sfx.deny(); this.ui.setFeed([["You don't need that right now.", 'a']]); return; }
    sfx.heal();
    this.reportUse(slug, res);
  }

  reportUse(slug, res) {
    const feed = [[`You have a ${ITEMS[slug].name}.`, '9']];
    if (res.hp) feed.push([`+${res.hp} HP`, 'A']);
    if (res.mp) feed.push([`+${res.mp} MP`, 'E']);
    this.ui.setFeed(feed);
    this.float(this.hero.x + 2, this.hero.y - 6, res.hp ? `+${res.hp}` : `+${res.mp}`, res.hp ? 'I' : 'E');
  }

  updateShots() {
    const h = this.hero;
    const stats = R.effectiveStats(this.p);
    for (const s of this.shots) {
      s.t += 1;
      if (s.foe) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.t > 220 || this.solidAt(s.x + 3, s.y + 3, false, 'shot')) { s.dead = true; continue; }
        if (h.inv <= 0 && this.mode === 'play' &&
            overlap({ x: s.x, y: s.y, w: 6, h: 6 }, { x: h.x + HURT.x, y: h.y + HURT.y, w: HURT.w, h: HURT.h })) {
          s.dead = true;
          this.hurtHeroBy({ name: s.name, att: s.att, type: s.type }, s.x - s.vx * 6, s.y - s.vy * 6);
        }
        continue;
      }
      if (s.kind === 'boom') {
        if (!s.back && (s.t > 22 || this.solidAt(s.x + 4, s.y + 4, false, 'shot'))) s.back = true;
        if (s.back) {
          const dx = h.x + 4 - s.x;
          const dy = h.y + 6 - s.y;
          const len = Math.hypot(dx, dy) || 1;
          if (len < 9) { s.dead = true; h.boom = false; continue; }
          s.vx = (dx / len) * 3.8; s.vy = (dy / len) * 3.8;
        }
      } else if (s.t > 70 || this.solidAt(s.x + 3, s.y + 3, false, 'shot')) {
        s.dead = true;
        this.parts.push({ x: s.x + 3, y: s.y + 3, vx: 0, vy: 0, t: 0, life: 8, color: s.kind === 'arrow' ? 'N' : 'i' });
        continue;
      }
      s.x += s.vx;
      s.y += s.vy;
      for (const m of [...this.mobs]) {
        if (s.dead || (s.hits && s.hits.has(m))) continue;
        if (!overlap({ x: s.x, y: s.y, w: 8, h: 8 }, { x: m.x + 1, y: m.y + 2, w: m.spr.w - 2, h: m.spr.h - 3 })) continue;
        const dir = [Math.sign(s.vx), Math.sign(s.vy)];
        if (s.kind === 'boom' || s.kind === 'arrow') {
          if (s.kind === 'boom') { s.hits.add(m); s.back = true; } else s.dead = true;
          const roll = R.strike(stats.dex, m.def.def);
          this.hurtMob(m, roll.dmg, dir, rollFeed(s.kind === 'boom' ? 'Boomerang' : 'Arrow', 'I', m.def.name, roll, 'I'), roll, 'I');
        } else {
          s.dead = true;
          const spell = R.SPELLS[s.spell];
          const dmg = spell.roll(stats.mag);
          this.hurtMob(m, dmg, dir, [[spell.name, 'L'], [m.def.name, 'a'], [`${dmg}`, '9']], { a: dmg, aMax: 2 + Math.max(0, stats.mag) }, 'L');
        }
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  // ------------------------------------------------------ talking, taking

  thingAt(cx, cy, wantSolid) {
    // A stump has nothing more to say, and neither does a tree that already told you no.
    return this.things.find((th) => !th.def.silent && !th.cut && !th.quiet && !this.thingHidden(th) &&
      (wantSolid === undefined || th.solid === wantSolid) &&
      cx >= th.cx && cx < th.cx + th.w && cy >= th.cy && cy < th.cy + th.h) || null;
  }

  facingThing() {
    const h = this.hero;
    const [dx, dy] = DIRV[h.dir];
    const fx = Math.floor((h.x + 8 + dx * 13) / TILE);
    const fy = Math.floor((h.y + 12 + dy * 12) / TILE);
    return this.thingAt(fx, fy) ||
      this.thingAt(Math.floor((h.x + 8) / TILE), Math.floor((h.y + 12) / TILE), false);
  }

  interact(th) {
    const p = this.p;
    const d = th.def;
    const ui = this.ui;
    if (th.t === 'sign' || th.t === 'read' || th.t === 'decor') { if (d.text) ui.say('', d.text); return; }
    if (th.t === 'npc') { this.talk(d.who); return; }
    if (th.t === 'shop') { ui.openShop(d.shop); return; }
    if (th.t === 'rest') {
      p.hp = p.hpMax;
      p.mp = p.mpMax;
      sfx.heal();
      ui.say('', d.text);
      saveGame(p);
      return;
    }
    if (th.t === 'cook') {
      const n = p.bag['raw-meat'] || 0;
      if (!n) { ui.say('', 'DRAFT|A cooking fire. You have nothing to cook.'); return; }
      R.removeItem(p, 'raw-meat', n);
      R.addItem(p, 'cooked-meat', n);
      sfx.item();
      ui.say('', `DRAFT|You cook ${n} meat. Cooked Meat is worth twice as much health.`);
      return;
    }
    if (th.t === 'pillar') {
      ui.say('', d.text, () => ui.choose(d.ask, [{ label: 'Yes', value: true }, { label: 'Not yet', value: false }], (yes) => {
        if (!yes) return;
        sfx.secret();
        // 'hub' means the last gold pillar you stood beside.
        const to = d.to === 'hub' ? (ROOMS[p.hub] ? p.hub : '001') : d.to;
        const [cx, cy] = d.to === 'hub' ? this.hubArrival(to) : [d.cx, d.cy];
        this.startFade(() => this.enterRoom(to, cx, cy, 'down'));
      }));
      return;
    }
    if (th.t === 'hub') { this.fastTravel(); return; }
    if (th.t === 'chop') { this.chop(th); return; }
    if (th.t === 'craft') { this.craftBoat(); return; }
    if (th.t === 'toll') { this.payToll(d); return; }
    if (th.t === 'door') {
      if (!check(p, d.need)) { sfx.deny(); ui.say('', d.msg); return; }
      ui.say('', d.text, () => ui.choose(d.ask, [{ label: 'Yes', value: true }, { label: 'Not yet', value: false }], (yes) => {
        if (!yes) return;
        sfx.door();
        this.startFade(() => this.enterRoom(d.to, d.cx, d.cy, 'down'));
      }));
      return;
    }
    if (th.t === 'take') {
      if (d.once && p.flags[d.once]) { sfx.deny(); ui.say('', d.full || 'DRAFT|You already took one.'); return; }
      const have = p.bag[d.item] || 0;
      if (d.upTo && have >= d.upTo) { sfx.deny(); ui.say('', d.full || 'DRAFT|You have enough.'); return; }
      R.addItem(p, d.item, d.upTo ? d.upTo - have : 1);
      if (d.once) p.flags[d.once] = true;
      sfx.item();
      this.rebuildSolid();
      this.noteProgress(null, [d.item]);
      ui.say('', d.text);
      saveGame(p);
      return;
    }
    if (th.t === 'chest') this.openChest(th);
  }

  /**
   * A tree a hatchet can take down. It leaves a stump until you walk off the
   * screen. A refusal is said once a visit; after that the trees here are just
   * trees, so a fight beside them is not interrupted by the same line.
   */
  chop(th) {
    const p = this.p;
    const d = th.def;
    const refuse = (line) => {
      sfx.deny();
      for (const o of this.things) if (o.t === 'chop') o.quiet = true;
      this.ui.say('', line);
    };
    if (!R.hasItem(p, 'hatchet')) { refuse(d.noTool); return; }
    const got = R.chopYield(p, d);
    if (!got) { refuse(d.full); return; }
    R.addItem(p, d.item, got);
    th.cut = true;
    this.startSwing('hatchet');
    sfx.cut();
    const x = th.cx * TILE;
    const y = th.cy * TILE;
    this.parts.push({ poof: true, x, y: y - 6, vx: 0, vy: 0, t: 0, life: 15 });
    for (let i = 0; i < 12; i++) {
      this.parts.push({ x: x + 4 + Math.random() * 8, y: y - 6 + Math.random() * 14, vx: (Math.random() - 0.5) * 2.6, vy: -Math.random() * 2.2, g: 0.12, t: 0, life: 26, color: i % 3 ? (i % 2 ? 'G' : 'g') : 'N' });
    }
    this.float(x + 2, y - 10, `+${got}`, 'J');
    this.ui.setFeed([['You chop down some wood.', '9'], [`${ITEMS[d.item].name} ${p.bag[d.item]}/${Math.min(d.upTo, ITEMS[d.item].cap)}`, 'J']]);
    this.noteProgress(null, [d.item]);
    saveGame(p);
  }

  /** Where you land beside a room's gold pillar. */
  hubArrival(id) {
    const th = (ROOMS[id].things || []).find((t) => t.t === 'hub');
    return th ? [th.x, th.y + 1] : [7, 7];
  }

  /** Gold pillars: any one takes you to any other you have stood beside, for 1 MP. You pick on the map. */
  fastTravel() {
    const p = this.p;
    const ui = this.ui;
    const others = Object.keys(ROOMS).some((id) => ROOMS[id].hub && p.seen[id] && id !== this.roomId);
    if (!others) { ui.say('', 'DRAFT|A gold pillar. It knows the other pillars you have stood beside. So far, none.'); return; }
    ui.openMap({
      travel: true,
      onTravel: (id) => {
        p.mp -= 1;
        sfx.secret();
        const [cx, cy] = this.hubArrival(id);
        this.startFade(() => this.enterRoom(id, cx, cy, 'down'));
      },
    });
  }

  craftBoat() {
    const p = this.p;
    const ui = this.ui;
    if (R.hasItem(p, 'wooden-boat')) { ui.say('', 'DRAFT|A crafting table. You already built your boat.'); return; }
    if (p.quests.jack_001 !== 'done') { ui.say('', "DRAFT|A crafting table. Jack hasn't shown you how to use it yet."); return; }
    const wood = p.bag.wood || 0;
    if (wood < 20) { ui.say('', `A Wooden Boat is twenty wood at any crafting table. You have ${wood}.`); return; }
    R.removeItem(p, 'wood', 20);
    R.addItem(p, 'wooden-boat', 1);
    sfx.secret();
    ui.say('', 'DRAFT|You build a Wooden Boat. The Blue Ocean is a road now. Start at the beach.');
    saveGame(p);
  }

  payToll(d) {
    const p = this.p;
    const ui = this.ui;
    if (p.flags.toll || (p.kills['toll-highwayman'] || 0) > 0) { ui.say('', 'DRAFT|The toll is settled.'); return; }
    ui.say('', d.text, () => ui.choose('Pay the toll?', [
      { label: `Pay ${d.price} gold`, value: true, disabled: p.gold < d.price },
      { label: 'Fight him', value: false },
    ], (pay) => {
      if (!pay) return;
      p.gold -= d.price;
      p.flags.toll = true;
      for (const m of this.mobs) if (m.def.calmFlag === 'toll') m.aggro = false;
      sfx.coin();
      ui.setFeed([[`You pay ${d.price} gold. He lets you by.`, 'J']]);
      saveGame(p);
    }));
  }

  openChest(th) {
    const p = this.p;
    const d = th.def;
    if (p.flags[d.id]) { this.ui.say('', 'DRAFT|Empty. You did that.'); return; }
    if (d.key && !R.hasItem(p, d.key)) { sfx.deny(); this.ui.say('', d.locked); return; }
    if (d.key) R.removeItem(p, d.key);
    p.flags[d.id] = true;
    const loot = d.loot;
    const lines = [];
    const gold = loot.gold ? R.rand(loot.gold[0], loot.gold[1]) : 0;
    if (gold) { p.gold += gold; lines.push(`${gold} gold`); }
    const gear = [];
    for (const [slug, n] of loot.items || []) {
      R.addItem(p, slug, n);
      if (ITEMS[slug].slot) gear.push(slug);
      else lines.push(countName(slug, n));
    }
    if (loot.xp) lines.push(`${loot.xp} XP`);
    d.gold ? sfx.secret() : sfx.item();
    const pages = [`DRAFT|You open the ${d.gold ? 'gold ' : ''}chest. Inside: ${lines.join(', ')}.`];
    for (const slug of gear) {
      const item = ITEMS[slug];
      pages.push(`DRAFT|And a ${item.name}. ${statLine(item)}.${item.slot === 'ranged' ? ' {b} throws it. It reaches things a sword can not.' : ''}`);
    }
    this.ui.say('', pages, () => { if (loot.xp) this.gainXp(loot.xp); saveGame(p); });
  }

  talk(who) {
    const p = this.p;
    const person = PEOPLE[who];
    const ui = this.ui;
    if (person.needsMet && !p.met[person.needsMet]) { ui.say(person.name, person.locked); return; }
    if (person.needsFlag && !p.flags[person.needsFlag]) { ui.say(person.name, person.locked); return; }

    const pages = [];
    const toasts = [];
    const first = !p.met[who];
    if (first) {
      p.met[who] = true;
      if (person.greeting) pages.push(person.greeting);
      const teach = person.teaches;
      if (teach && teach.free && !p.spells[teach.free]) {
        p.spells[teach.free] = true;
        if (!p.spell) p.spell = teach.free;
        pages.push(teach.first);
        toasts.push([`Learned ${R.SPELLS[teach.free].name}. ${label('y')} casts it.`, 'L']);
      }
    }

    const offer = (id, quiet) => {
      p.quests[id] = 'active';
      if (!quiet) pages.push(QUESTS[id].remind);
      toasts.push([`New quest: ${QUESTS[id].title}`, 'J']);
    };

    let qid = currentQuest(p, who);
    let xp = 0;
    if (qid && p.quests[qid] !== 'active') {
      // The Old Man's greeting is itself the ask; everyone else says it after.
      offer(qid, first && who === 'old_man');
    } else if (qid) {
      const q = QUESTS[qid];
      const pr = questProgress(p, qid);
      if (!pr.met) {
        pages.push(q.need.kills || (q.need.item && q.need.item[1] > 1) ? `${q.remind} (${pr.have}/${pr.want})` : q.remind);
      } else {
        if (q.consume && q.need.item) R.removeItem(p, q.need.item[0], q.need.item[1]);
        p.quests[qid] = 'done';
        pages.push(q.done);
        const r = q.reward || {};
        const got = [];
        if (r.gold) { p.gold += r.gold; got.push(`${r.gold} gold`); }
        if (r.xp) { xp = r.xp; got.push(`${r.xp} XP`); }
        for (const [slug, n] of r.items || []) { R.addItem(p, slug, n); got.push(countName(slug, n)); }
        toasts.push([`Quest done: ${q.title}`, 'I']);
        if (got.length) toasts.push([got.join('  '), '9']);
        qid = currentQuest(p, who);
        if (qid) offer(qid, false);
      }
    } else if (!pages.length && person.idle) {
      const i = p.lines[who] || 0;
      pages.push(person.idle[i % person.idle.length]);
      p.lines[who] = i + 1;
    }

    ui.say(person.name, pages, () => {
      if (toasts.some((t) => t[0].startsWith('Quest done'))) sfx.item();
      for (const [text, color] of toasts) ui.toast(text, color);
      if (xp) this.gainXp(xp);
      this.rebuildSolid();       // a finished quest can take a gate out of the way
      saveGame(p);
      if (person.ending && !p.flags.ended) { this.finish(); return; }
      this.offerLessons(who);
    });
  }

  /** Teachers sell what you have not learned: spells, or a thing you keep. */
  offerLessons(who) {
    const p = this.p;
    const teach = PEOPLE[who].teaches;
    if (!teach) return;
    if (teach.member && p.quests[teach.member] !== 'done') return;
    const known = (s) => (s.spell ? !!p.spells[s.spell] : R.hasItem(p, s.item));
    const nameOf = (s) => (s.spell ? R.SPELLS[s.spell].name : ITEMS[s.item].name);
    const left = (teach.sells || []).filter((s) => !known(s));
    if (!left.length) return;
    const options = left.map((s) => ({ label: `${nameOf(s)}  ${s.price} gold`, value: s, disabled: p.gold < s.price }));
    options.push({ label: 'Nothing', value: null });
    const NOTE = {
      gills: 'You breathe water. The whirlpool will take you now.',
      wings: 'Swords reach what flies. The waterfall goes up.',
    };
    this.ui.choose(teach.ask || 'Learn a spell?', options, (s) => {
      if (!s) return;
      p.gold -= s.price;
      sfx.item();
      if (s.spell) {
        p.spells[s.spell] = true;
        this.ui.toast(`Learned ${nameOf(s)}. Pick it in the bag, under MAGIC.`, 'L');
      } else {
        R.addItem(p, s.item, 1);
        this.ui.toast(`Learned ${nameOf(s)}.`, 'L');
        this.ui.toast(NOTE[s.item] || '', '9');
      }
      saveGame(p);
    });
  }

  /** The end of the road: the clock stops, the run is read back, and the game goes on. */
  finish() {
    const p = this.p;
    p.flags.ended = true;
    p.splits.end = p.frames;
    saveGame(p);
    playSong(null);
    sfx.fanfare();
    const run = R.runSummary(p, roomsFound(p));
    const best = this.onFinish ? this.onFinish(run) : false;
    this.ui.ending(run, best, () => playSong(this.room.music));
  }

  // ------------------------------------------------------------------ draw

  thingSprite(th) {
    const d = th.def;
    const T = this.S.things;
    if (th.t === 'sign') return T.sign;
    if (th.t === 'chest') {
      const open = !!this.p.flags[d.id];
      return d.gold ? (open ? T.goldChestOpen : T.goldChest) : (open ? T.chestOpen : T.chest);
    }
    if (th.t === 'npc') {
      const look = d.look || PEOPLE[d.who].look;
      const h = this.hero;
      const dx = h.x - th.cx * TILE;
      const dy = h.y + 4 - th.cy * TILE;
      let dir = 'down';
      if (!d.silent && Math.hypot(dx, dy) < 44) dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
      return this.S.people[look][dir][0];
    }
    if (th.t === 'chop') return th.cut ? T.pineStump : T.pine;
    if (d.heldSprite && R.hasItem(this.p, d.item)) return T[d.heldSprite];
    if (th.t === 'cook' || d.sprite === 'fire') return (this.t >> 3) % 2 ? T.fire : T.fire2;
    const spr = T[d.sprite] || T.sign;
    return Array.isArray(spr) ? spr[(this.t >> 3) % spr.length] : spr;
  }

  drawThings(g, things, ox, oy, list) {
    for (const th of things) {
      if (this.thingHidden(th)) continue;
      const spr = this.thingSprite(th);
      const x = ox + th.cx * TILE + Math.round((th.w * TILE - spr.width) / 2);
      const y = oy + (th.cy + th.h) * TILE - spr.height;
      if (list) list.push({ z: (th.cy + th.h) * TILE - (th.solid ? 0 : 14), draw: () => g.drawImage(spr, x, y) });
      else g.drawImage(spr, x, y);
    }
  }

  drawHero(g, x, y) {
    const h = this.hero;
    x = Math.round(x); y = Math.round(y);
    if (h.inv > 0 && (h.inv >> 2) % 2 === 0 && this.mode !== 'dead') return;
    const frames = this.S.people.hero[h.dir];
    const body = frames[h.swing > 0 ? 1 : (h.step >> 3) & 3];
    const armed = !!this.p.gear.sword || !!h.tool;
    const f = SWING_T - h.swing;
    const drawSword = () => {
      if (h.swing <= 0 || !armed) return;
      const sw = this.S.fx[h.tool || 'sword'][h.dir];
      const sl = this.S.fx.slash[h.dir];
      if (h.dir === 'up') { g.drawImage(sw, x + 9, y - 8); if (f < 7) g.drawImage(sl, x, y - 11); }
      if (h.dir === 'down') { g.drawImage(sw, x + 2, y + 13); if (f < 7) g.drawImage(sl, x, y + 22); }
      if (h.dir === 'right') { g.drawImage(sw, x + 12, y + 8); if (f < 7) g.drawImage(sl, x + 22, y); }
      if (h.dir === 'left') { g.drawImage(sw, x - 8, y + 8); if (f < 7) g.drawImage(sl, x - 11, y); }
    };
    const cell = Math.max(0, Math.min(ROWS - 1, Math.floor((h.y + 12) / TILE))) * COLS +
      Math.max(0, Math.min(COLS - 1, Math.floor((h.x + 8) / TILE)));
    if (this.solid[cell] === 2 && this.mode !== 'slide') g.drawImage(this.S.things.boat, x - 3, y + 9);
    if (h.dir === 'up') drawSword();
    g.drawImage(body, x, y);
    if (h.dir !== 'up') drawSword();
  }

  drawMob(g, m) {
    const x = Math.round(m.x) + (m.state === 'windup' ? ((this.t >> 1) % 2 ? 1 : -1) : 0);
    const y = Math.round(m.y);
    const i = (m.anim >> 3) & 1;
    const white = m.flash > 0 || (m.state === 'windup' && (this.t >> 2) % 2 === 0);
    const set = m.face > 0 ? (white ? m.spr.white : m.spr.right) : (white ? m.spr.whiteLeft : m.spr.left);
    let lift = 0;
    if (m.def.flying) {
      lift = Math.round(Math.sin((this.t + m.seed) / 7) * 2) - 4;
      g.globalAlpha = 0.3;
      fillRect(g, x + m.spr.w / 2 - 5, y + m.spr.h - 2, 10, 3, '0');
      g.globalAlpha = 1;
    }
    g.drawImage(set[i], x, y + lift);
    if (m.hp < m.def.hp && !m.def.boss) {
      const w = 14;
      const bx = x + Math.round((m.spr.w - w) / 2);
      fillRect(g, bx, y + lift - 3, w, 3, '0');
      fillRect(g, bx + 1, y + lift - 2, Math.max(1, Math.round((w - 2) * (m.hp / m.def.hp))), 1, '@');
    }
  }

  /** Two dice meeting. Until they settle they show any number they could have been. */
  drawClash(g, c) {
    if (c.t > 32 && (c.t >> 1) % 2) return;                // blink out
    const rolling = c.t < CLASH_SETTLE;
    const gap = rolling ? Math.round((1 - c.t / CLASH_SETTLE) * 10) : 0;
    const y = Math.round(c.y);
    const face = (value, max, salt) => `${rolling ? (c.seed * salt + c.t * 7) % (max + 1) : value}`;
    const die = (text, x, color) => {
      const w = textWidth(text) + 4;
      fillRect(g, x - 1, y - 1, w + 2, 11, '0');
      fillRect(g, x, y, w, 9, color);
      fillRect(g, x, y + 8, w, 1, 'q');
      drawText(g, text, x + 2, y + 1, 'q');
    };
    const hot = c.crit && !rolling && (c.t >> 2) % 2 === 0;
    const a = face(c.a, c.aMax, 3);
    if (c.d === null) { die(a, c.x - Math.round((textWidth(a) + 4) / 2), c.ca); return; }
    die(a, c.x - 1 - gap - (textWidth(a) + 4), hot ? '$' : c.ca);
    die(face(c.d, c.dMax, 5), c.x + 1 + gap, c.cd);
    if (!rolling && c.t < CLASH_SETTLE + 4) fillRect(g, c.x - 1, y + 1, 2, 7, '8');   // the moment they meet
  }

  drawRoomLayer(g, bake, things, ox, oy, live) {
    g.drawImage(bake.bg, ox, oy);
    if (!live) { this.drawThings(g, things, ox, oy, null); return; }
    const frame = this.t >> 4;
    for (const [cx, cy] of this.waterCells) g.drawImage(this.glints[(frame + cx * 3 + cy) & 3], ox + cx * TILE, oy + cy * TILE);
  }

  draw(g) {
    g.save();
    g.beginPath();
    g.rect(0, HUD_H, W, FIELD_H);
    g.clip();
    g.translate(0, HUD_H);

    if (this.mode === 'slide') {
      const s = this.slide;
      const e = EDGES[s.edge];
      const k = s.t / s.T;
      const ease = k * k * (3 - 2 * k);
      const ox = Math.round(-e.dx * W * ease);
      const oy = Math.round(-e.dy * FIELD_H * ease);
      const nx = ox + e.dx * W;
      const ny = oy + e.dy * FIELD_H;
      this.drawRoomLayer(g, this.bake, this.things, ox, oy, false);
      this.drawRoomLayer(g, s.toBake, s.toThings, nx, ny, false);
      this.drawHero(g, s.nx + nx, s.ny + ny);
      g.drawImage(this.bake.fg, ox, oy);
      g.drawImage(s.toBake.fg, nx, ny);
    } else {
      if (this.shake > 0) g.translate(rnd(3) - 1, rnd(3) - 1);
      this.drawRoomLayer(g, this.bake, this.things, 0, 0, true);
      const list = [];
      this.drawThings(g, this.things, 0, 0, list);
      for (const m of this.mobs) list.push({ z: m.y + m.spr.h - 1, draw: () => this.drawMob(g, m) });
      list.push({ z: this.hero.y + 16, draw: () => this.drawHero(g, this.hero.x, this.hero.y) });
      list.sort((a, b) => a.z - b.z);
      for (const item of list) item.draw();
      for (const s of this.shots) {
        const sx = Math.round(s.x);
        const sy = Math.round(s.y);
        if (s.foe) g.drawImage(this.S.fx[s.kind === 'orb' ? 'eorb' : s.kind], sx, sy);
        else if (s.kind === 'boom') g.drawImage(this.S.fx.boomerang[(s.t >> 1) & 3], sx, sy);
        else if (s.kind === 'arrow') g.drawImage(this.S.fx.arrow[s.dir], sx, sy);
        else g.drawImage(this.S.fx.orb, sx, sy);
      }
      g.drawImage(this.bake.fg, 0, 0);
      for (const q of this.parts) {
        if (q.poof) g.drawImage(this.S.fx.poof[Math.min(2, Math.floor(q.t / 5))], Math.round(q.x), Math.round(q.y));
        else fillRect(g, q.x, q.y, 2, 2, q.color);
      }
      for (const c of this.clashes) this.drawClash(g, c);
      for (const f of this.floats) if (f.t >= 0) drawTextOutlined(g, f.text, Math.round(f.x), Math.round(f.y), f.color, '0');

      // What A would do right now.
      if (this.mode === 'play' && !this.ui.busy && this.hero.swing <= 0) {
        const th = this.facingThing();
        if (th && (this.t >> 4) % 2 === 0) {
          drawTextOutlined(g, label('a'), th.cx * TILE + th.w * 8 - 3, (th.cy + th.h) * TILE - this.thingSprite(th).height - 9, 'J', 'q');
        }
      }

      const boss = this.mobs.find((m) => m.def.boss);
      if (boss) {
        const w = 150;
        const x = Math.round((W - w) / 2);
        drawTextOutlined(g, boss.def.name, x, FIELD_H - 21, '9', 'q');
        const hp = `${Math.max(0, boss.hp)}/${boss.def.hp}`;
        drawTextOutlined(g, hp, x + w - textWidth(hp), FIELD_H - 21, '9', 'q');
        fillRect(g, x, FIELD_H - 11, w, 6, '0');
        fillRect(g, x + 1, FIELD_H - 10, Math.max(0, Math.round((w - 2) * (boss.hp / boss.def.hp))), 4, '@');
      }
    }
    g.restore();

    if (this.mode === 'fade') {
      const f = this.fade;
      const half = f.T / 2;
      g.globalAlpha = Math.max(0, 1 - Math.abs(f.t - half) / half);
      fillRect(g, 0, HUD_H, W, H - HUD_H, '0');
      g.globalAlpha = 1;
    }
  }
}
