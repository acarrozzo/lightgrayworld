// Light Gray Mini: everything drawn over the world. The HUD strip, the feed
// line, room banners, speech, the bag, the shop and the death card.
// The colors are Light Gray RPG's Classic theme: gray panels, one color per
// meaning (HP red, MP blue, XP green, gold gold).

import { W, H, HUD_H, drawText, drawTextCentered, drawTextOutlined, textWidth, wrap, panel, fillRect, makeCanvas, rng } from './gfx.js';
import { pressed, label, withKeys } from './input.js';
import { sfx } from './audio.js';
import { ITEMS, SLOT_LABEL, statLine } from './data/items.js';
import { QUESTS, SHOPS, ENDING, questProgress } from './data/quests.js';
import { ENEMIES } from './data/enemies.js';
import * as R from './rules.js';
import { plain } from './world.js';
import { saveGame } from './state.js';
import { newMapState, updateMap, drawMap, EVERYWHERE } from './map.js';

const WRAP = 38;
const TABS = ['STATUS', 'BAG', 'MAGIC', 'QUESTS'];
const STAT_COLOR = { str: 'A', dex: 'I', def: 'K', mag: 'L' };
// What a stat is, said as the roll it makes: more of it is a bigger die.
const STAT_NOTE = {
  str: (n) => `sword rolls 0-${n}`,
  dex: (n) => `throws roll 0-${n}`,
  def: (n) => `blocks roll 0-${n}`,
  mag: (n) => `spells roll 0-${n}`,
};

// The ending: when each thing on the results card arrives, in frames.
const END = { fade: 30, title: 40, kings: 84, kingGap: 26, count: 170, land: 230, stats: 246, ready: 262 };
const REWARD = { chest: 20, line: 54, gap: 52, open: 2 };   // open: the chest opens with this line (and is empty)

const bigCache = new Map();
/** Pixel text at a whole multiple of its size. */
function big(text, scale, color) {
  const key = `${text}|${scale}|${color}`;
  if (!bigCache.has(key)) {
    const c = makeCanvas(textWidth(text) + 1, 8);
    drawText(c.getContext('2d'), text, 0, 0, color);
    const out = makeCanvas(c.width * scale, c.height * scale);
    const og = out.getContext('2d');
    og.imageSmoothingEnabled = false;
    og.drawImage(c, 0, 0, out.width, out.height);
    bigCache.set(key, out);
    if (bigCache.size > 80) bigCache.delete(bigCache.keys().next().value);
  }
  return bigCache.get(key);
}

function bar(g, x, y, w, h, frac, color) {
  fillRect(g, x, y, w, h, '0');
  fillRect(g, x + 1, y + 1, w - 2, h - 2, 'j');
  const fill = Math.max(0, Math.min(1, frac)) * (w - 2);
  if (fill > 0) fillRect(g, x + 1, y + 1, Math.max(1, Math.round(fill)), h - 2, color);
}

export class UI {
  constructor(sprites) {
    this.S = sprites;
    this.game = null;
    this.modal = null;
    this.toasts = [];
    this.banner = null;
    this.feed = { parts: [], age: 9999 };
    this.t = 0;
  }

  get busy() { return this.modal !== null; }

  // ------------------------------------------------------------ openers

  /** Speech or a sign. `text` is a string or a list of them; each is paged. */
  say(speaker, text, then = null) {
    const pages = [];
    for (const t of Array.isArray(text) ? text : [text]) {
      const lines = wrap(withKeys(plain(t)), WRAP);
      for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3));
    }
    if (!pages.length) { if (then) then(); return; }
    this.modal = { type: 'say', speaker, pages, page: 0, shown: 0, then };
  }

  /** A short list to pick from. cb gets the option's value, or null on B. */
  choose(title, options, cb) {
    this.modal = { type: 'choose', title: withKeys(plain(title)), options, sel: 0, cb };
  }

  openMenu() {
    sfx.select();
    this.modal = { type: 'menu', tab: 0, row: 0 };
  }

  /** The map. With { travel, onTravel } it is how a gold pillar takes you somewhere. */
  openMap(opts = {}) {
    sfx.select();
    this.modal = newMapState(this.game.roomId, opts);
  }

  openShop(id) {
    sfx.select();
    this.modal = { type: 'shop', id, sel: 0, note: '' };
  }

  /**
   * The end of the road, for now: the run read back, the reward, the credits.
   * run: R.runSummary. best: { isNew, frames } or null. The game goes on after.
   */
  ending(run, best = null, then = null) {
    const r = rng(701);
    const stars = Array.from({ length: 54 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * H), k: Math.floor(r() * 64), gold: r() < 0.14 }));
    const reward = ENDING.reward.map((line) => wrap(plain(line), 38));
    this.modal = { type: 'ending', page: 0, t: 0, run, best, then, stars, reward };
  }

  deadCard(text, cb) {
    this.modal = { type: 'dead', text, t: 0, cb };
  }

  toast(text, color = '9') {
    this.toasts.push({ text, color, t: 0 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  showBanner(id, room, fresh = false) {
    this.banner = { id, name: room.name, sub: room.sub && room.sub !== String(id) ? room.sub : '', t: 0, fresh };
  }

  /** The one-line feed. parts: [[text, colorKey], ...] */
  setFeed(parts) {
    this.feed = { parts, age: 0 };
  }

  // -------------------------------------------------------------- update

  update() {
    this.t += 1;
    this.feed.age += 1;
    if (this.banner && ++this.banner.t > 170) this.banner = null;
    for (const t of this.toasts) t.t += 1;
    this.toasts = this.toasts.filter((t) => t.t < 150);

    const m = this.modal;
    if (!m) return;
    if (m.type === 'say') this.updateSay(m);
    else if (m.type === 'choose') this.updateChoose(m);
    else if (m.type === 'menu') this.updateMenu(m);
    else if (m.type === 'shop') this.updateShop(m);
    else if (m.type === 'map') updateMap(this, m);
    else if (m.type === 'dead') {
      m.t += 1;
      if (m.t > 70 && pressed.a) { this.modal = null; m.cb(); }
    } else if (m.type === 'ending') this.updateEnding(m);
  }

  updateEnding(m) {
    m.t += 1;
    const go = pressed.a || pressed.start;
    if (m.page === 0) {
      const n = Math.max(m.run.kings.length, 3);
      for (let i = 0; i < n; i++) if (m.t === END.kings + i * END.kingGap) sfx.coin();
      if (m.t > END.count && m.t < END.land && m.t % 4 === 0) sfx.text();
      if (m.t === END.land) sfx.level();
      if (go) {
        if (m.t < END.ready) m.t = END.ready;        // the first press skips to the whole card
        else { m.page = 1; m.t = 0; sfx.select(); }
      }
    } else if (m.page === 1) {
      const last = REWARD.line + (m.reward.length - 1) * REWARD.gap;
      if (m.t === REWARD.chest) sfx.item();
      m.reward.forEach((_, i) => {
        if (m.t !== REWARD.line + i * REWARD.gap) return;
        if (i === REWARD.open) sfx.deny();
        else if (i === m.reward.length - 1) sfx.secret();
        else sfx.text();
      });
      if (go) {
        if (m.t < last + 30) m.t = last + 30;
        else { m.page = 2; m.t = 0; sfx.select(); }
      }
    } else if (m.t > 60 && go) {
      this.modal = null;
      if (m.then) m.then();
    }
  }

  updateSay(m) {
    const total = m.pages[m.page].reduce((n, l) => n + l.length, 0);
    if (m.shown < total) {
      const before = Math.floor(m.shown);
      m.shown = Math.min(total, m.shown + 1.2);
      if (Math.floor(m.shown) !== before && Math.floor(m.shown) % 3 === 0) sfx.text();
    }
    if (pressed.a || pressed.b) {
      if (m.shown < total) { m.shown = total; return; }
      if (m.page < m.pages.length - 1) { m.page += 1; m.shown = 0; return; }
      this.modal = null;
      if (m.then) m.then();
    }
  }

  updateChoose(m) {
    if (pressed.up) { m.sel = (m.sel + m.options.length - 1) % m.options.length; sfx.select(); }
    if (pressed.down) { m.sel = (m.sel + 1) % m.options.length; sfx.select(); }
    if (pressed.a) {
      const opt = m.options[m.sel];
      if (opt.disabled) { sfx.deny(); return; }
      sfx.confirm();
      this.modal = null;
      m.cb(opt.value);
    } else if (pressed.b || pressed.start) {
      this.modal = null;
      m.cb(null);
    }
  }

  menuRows(m) {
    const p = this.game.p;
    if (m.tab === 0) return R.STAT_KEYS;
    if (m.tab === 1) return Object.keys(p.bag).filter((s) => ITEMS[s] && ITEMS[s].use);
    if (m.tab === 2) return Object.keys(p.spells);
    return [];
  }

  updateMenu(m) {
    const p = this.game.p;
    if (pressed.start || pressed.b) { sfx.select(); this.modal = null; saveGame(p); return; }
    if (pressed.left) { m.tab = (m.tab + TABS.length - 1) % TABS.length; m.row = 0; sfx.select(); }
    if (pressed.right) { m.tab = (m.tab + 1) % TABS.length; m.row = 0; sfx.select(); }
    const rows = this.menuRows(m);
    if (m.row >= rows.length) m.row = Math.max(0, rows.length - 1);
    if (rows.length) {
      if (pressed.up) { m.row = (m.row + rows.length - 1) % rows.length; sfx.select(); }
      if (pressed.down) { m.row = (m.row + 1) % rows.length; sfx.select(); }
    }
    if (!pressed.a || !rows.length) return;
    const pick = rows[m.row];
    if (m.tab === 0) {
      if (p.cp <= 0) { sfx.deny(); return; }
      p[pick] += 1;
      p.cp -= 1;
      sfx.confirm();
    } else if (m.tab === 1) {
      p.quick = pick;
      const res = R.useItem(p, pick);
      if (!res || res.wasted) { sfx.deny(); this.setFeed([["You don't need that right now.", 'a']]); return; }
      sfx.heal();
      this.game.reportUse(pick, res);
    } else if (m.tab === 2) {
      p.spell = pick;
      sfx.confirm();
    }
  }

  updateShop(m) {
    const p = this.game.p;
    const stock = SHOPS[m.id].stock;
    if (pressed.start || pressed.b) { sfx.select(); this.modal = null; saveGame(p); return; }
    if (pressed.up) { m.sel = (m.sel + stock.length - 1) % stock.length; m.note = ''; sfx.select(); }
    if (pressed.down) { m.sel = (m.sel + 1) % stock.length; m.note = ''; sfx.select(); }
    if (!pressed.a) return;
    const slug = stock[m.sel];
    const item = ITEMS[slug];
    if (item.slot && p.owned[slug]) { m.note = 'You have one.'; sfx.deny(); return; }
    if (p.gold < item.value) { m.note = 'Not enough gold.'; sfx.deny(); return; }
    p.gold -= item.value;
    const worn = item.slot ? R.takeGear(p, slug) : (R.addItem(p, slug, 1), false);
    m.note = item.slot ? (worn ? `Bought and equipped.` : 'Bought. What you wear is better.') : `Bought. You have ${p.bag[slug] || 0}.`;
    sfx.coin();
  }

  // ---------------------------------------------------------------- draw

  draw(g) {
    this.drawHud(g);
    if (this.banner && !(this.modal && this.modal.type !== 'say')) this.drawBanner(g);
    this.drawToasts(g);
    const m = this.modal;
    if (!m) return;
    if (m.type === 'say') this.drawSay(g, m);
    else if (m.type === 'choose') this.drawChoose(g, m);
    else if (m.type === 'menu') this.drawMenu(g, m);
    else if (m.type === 'shop') this.drawShop(g, m);
    else if (m.type === 'map') drawMap(g, this, m);
    else if (m.type === 'dead') this.drawDead(g, m);
    else if (m.type === 'ending') this.drawEnding(g, m);
  }

  drawHud(g) {
    const p = this.game.p;
    fillRect(g, 0, 0, W, HUD_H, 'q');
    fillRect(g, 0, HUD_H - 1, W, 1, 'j');

    drawText(g, 'HP', 3, 3, 'A');
    bar(g, 17, 3, 38, 7, p.hp / p.hpMax, 'A');
    drawText(g, `${p.hp}/${p.hpMax}`, 58, 3, '9');
    drawText(g, 'MP', 104, 3, 'E');
    bar(g, 118, 3, 26, 7, p.mpMax ? p.mp / p.mpMax : 0, 'E');
    drawText(g, `${p.mp}/${p.mpMax}`, 147, 3, '9');

    const start = R.levelStartXp(p.level);
    const next = R.nextLevelXp(p.level);
    drawText(g, `LV ${p.level}`, 3, 13, '9');
    bar(g, 40, 14, 40, 5, (p.xp - start) / (next - start), 'I');
    if (p.cp > 0 && (this.t >> 4) % 2 === 0) drawText(g, `+${p.cp}`, 84, 13, 'J');
    g.drawImage(this.S.fx.coin, 112, 12);
    drawText(g, `${p.gold}`, 123, 13, 'J');
    if (!p.untimed) {
      // The run clock. It stops, and turns gold, at Camp Hero.
      const time = R.clock(p.flags.ended && p.splits.end !== undefined ? p.splits.end : p.frames);
      drawText(g, time, 189 - textWidth(time), 13, p.flags.ended ? 'J' : '%');
    }

    // The three slots, each lettered with the button that fires it.
    const slots = [
      [label('b'), p.gear.ranged ? (ITEMS[p.gear.ranged].arrow ? 'bow' : 'boomerang') : null],
      [label('y'), p.spell ? 'spell' : null],
      [label('x'), p.quick && p.bag[p.quick] ? (ITEMS[p.quick].icon || 'potion') : null],
    ];
    slots.forEach(([letter, icon], i) => {
      const x = 192 + i * 21;
      fillRect(g, x, 2, 20, 19, 'j');
      fillRect(g, x + 1, 3, 18, 17, 'Q');
      drawText(g, letter, x + 2, 4, 'a');
      if (icon) g.drawImage(this.S.icons[icon], x + 8, 10);
      if (i === 2 && icon) {
        const n = `${Math.min(99, p.bag[p.quick])}`;
        drawText(g, n, x + 19 - textWidth(n), 4, '9');
      }
    });

    // The feed: the last thing that happened, numbers showing.
    let x = 3;
    const dim = this.feed.age > 240;
    for (const [text, color] of this.feed.parts) {
      drawText(g, text, x, 23, dim ? '%' : color);
      x += textWidth(text) + 1 + 5;
    }
  }

  drawBanner(g) {
    const b = this.banner;
    const title = `${b.id}  ${b.name}`;
    // A room's first visit says so: it has just gone on the map.
    const full = b.fresh ? `${title}  NEW` : title;
    const w = Math.max(textWidth(full), textWidth(b.sub)) + 16;
    const slide = Math.min(1, b.t / 10, (170 - b.t) / 10);
    const y = HUD_H - 26 + Math.round(30 * slide);
    const x = Math.round((W - w) / 2);
    panel(g, x, y, w, b.sub ? 27 : 17, 'Q', 'j');
    const tx = Math.round((W - textWidth(full)) / 2);
    drawText(g, title, tx, y + 5, '9');
    if (b.fresh) drawText(g, 'NEW', tx + (title.length + 2) * 6, y + 5, 'J');
    if (b.sub) drawTextCentered(g, b.sub, W / 2, y + 15, 'a');
  }

  drawToasts(g) {
    this.toasts.forEach((t, i) => {
      const y = HUD_H + 40 + i * 12 - Math.min(6, t.t);
      drawTextOutlined(g, t.text, Math.round((W - textWidth(t.text)) / 2), y, t.color, 'q');
    });
  }

  drawSay(g, m) {
    const top = this.game && this.game.hero.y > 92;
    const h = 42;
    const y = top ? HUD_H + 14 : H - h - 6;
    panel(g, 6, y, W - 12, h, 'Q', 'a');
    if (m.speaker) {
      const w = textWidth(m.speaker) + 10;
      panel(g, 12, y - 9, w, 13, 'q', 'a');
      drawText(g, m.speaker, 17, y - 6, 'J');
    }
    let left = Math.floor(m.shown);
    m.pages[m.page].forEach((line, i) => {
      const part = line.slice(0, Math.max(0, left));
      left -= line.length;
      drawText(g, part, 14, y + 7 + i * 10, '9');
    });
    const total = m.pages[m.page].reduce((n, l) => n + l.length, 0);
    if (m.shown >= total && (this.t >> 4) % 2 === 0) {
      drawText(g, m.page < m.pages.length - 1 ? '▼' : '●', W - 20, y + h - 12, 'J');
    }
  }

  drawChoose(g, m) {
    const w = Math.max(textWidth(m.title), ...m.options.map((o) => textWidth(o.label) + 12)) + 20;
    const h = 22 + m.options.length * 11;
    const x = Math.round((W - w) / 2);
    const y = Math.round(HUD_H + (H - HUD_H - h) / 2);
    panel(g, x, y, w, h, 'Q', 'a');
    drawText(g, m.title, x + 10, y + 7, '9');
    m.options.forEach((o, i) => {
      const oy = y + 19 + i * 11;
      if (i === m.sel) drawText(g, '▶', x + 10, oy, 'J');
      drawText(g, o.label, x + 20, oy, o.disabled ? '%' : i === m.sel ? 'J' : '9');
    });
  }

  drawTabs(g, x, y, active) {
    let tx = x;
    TABS.forEach((name, i) => {
      drawText(g, name, tx, y, i === active ? 'J' : 'a');
      if (i === active) fillRect(g, tx, y + 9, textWidth(name), 1, 'J');
      tx += textWidth(name) + 12;
    });
  }

  drawMenu(g, m) {
    const p = this.game.p;
    const x = 8;
    const y = HUD_H + 6;
    panel(g, x, y, W - 16, H - HUD_H - 12, 'Q', 'a');
    this.drawTabs(g, x + 10, y + 7, m.tab);
    drawText(g, '◀ ▶', W - 16 - 30, y + 7, 'a');
    const cx = x + 10;
    let cy = y + 24;
    const rows = this.menuRows(m);

    if (m.tab === 0) {
      const eff = R.effectiveStats(p);
      const bonus = R.gearBonus(p);
      drawText(g, `Level ${p.level}`, cx, cy, '9');
      drawText(g, `XP ${p.xp}/${R.nextLevelXp(p.level)}`, cx + 60, cy, 'I');
      drawText(g, `${p.gold} gold`, cx + 150, cy, 'J');
      cy += 12;
      drawText(g, p.cp > 0 ? `Points to spend: ${p.cp}   ${label('a')} adds one` : 'No points to spend. Level up.', cx, cy, p.cp > 0 ? 'J' : 'a');
      cy += 13;
      R.STAT_KEYS.forEach((k, i) => {
        if (i === m.row) drawText(g, '▶', cx, cy, 'J');
        drawText(g, k.toUpperCase(), cx + 10, cy, STAT_COLOR[k]);
        const b = bonus[k];
        const num = b ? `${p[k]} ${b > 0 ? '+' : '-'}${Math.abs(b)} = ${eff[k]}` : `${p[k]}`;
        drawText(g, num, cx + 36, cy, '9');
        drawText(g, STAT_NOTE[k](Math.max(0, eff[k])), cx + 104, cy, 'a');
        cy += 10;
      });
      cy += 5;
      fillRect(g, cx, cy, W - 36, 1, 'j');
      cy += 5;
      for (const slot of R.GEAR_SLOTS) {
        const item = ITEMS[p.gear[slot]];
        drawText(g, SLOT_LABEL[slot], cx, cy, 'a');
        drawText(g, item ? item.name : '-', cx + 44, cy, item ? '9' : '%');
        if (item) drawText(g, statLine(item), cx + 44 + textWidth(item.name) + 8, cy, 'I');
        cy += 10;
      }
    } else if (m.tab === 1) {
      if (!rows.length) { drawText(g, 'Nothing to eat or drink.', cx, cy, 'a'); cy += 12; }
      rows.forEach((slug, i) => {
        const item = ITEMS[slug];
        if (i === m.row) drawText(g, '▶', cx, cy, 'J');
        g.drawImage(this.S.icons[item.icon || 'potion'], cx + 10, cy - 1);
        drawText(g, `${item.name} ×${p.bag[slug]}`, cx + 24, cy, i === m.row ? 'J' : '9');
        drawText(g, statLine(item), cx + 130, cy, 'I');
        if (p.quick === slug) drawText(g, label('x'), cx + 190, cy, 'a');
        cy += 12;
      });
      cy += 4;
      fillRect(g, cx, cy, W - 36, 1, 'j');
      cy += 5;
      const keys = Object.keys(p.bag).filter((s) => ITEMS[s] && ITEMS[s].quest);
      drawText(g, keys.length ? 'Carrying' : `${label('a')} uses it and puts it on ${label('x')}.`, cx, cy, 'a');
      cy += 11;
      for (const slug of keys) {
        g.drawImage(this.S.icons[ITEMS[slug].icon || 'key'], cx, cy - 1);
        drawText(g, `${ITEMS[slug].name} ×${p.bag[slug]}`, cx + 14, cy, '9');
        cy += 12;
      }
    } else if (m.tab === 2) {
      if (!rows.length) drawText(g, 'You know no spells. Someone in pajamas might.', cx, cy, 'a');
      rows.forEach((slug, i) => {
        const s = R.SPELLS[slug];
        if (i === m.row) drawText(g, '▶', cx, cy, 'J');
        drawText(g, s.name, cx + 10, cy, i === m.row ? 'J' : '9');
        drawText(g, `${s.mp} MP`, cx + 110, cy, 'E');
        if (p.spell === slug) drawText(g, label('y'), cx + 150, cy, 'a');
        cy += 11;
        drawText(g, s.blurb, cx + 10, cy, 'a');
        cy += 14;
      });
    } else {
      const active = Object.keys(QUESTS).filter((id) => p.quests[id] === 'active');
      const done = Object.keys(QUESTS).filter((id) => p.quests[id] === 'done').length;
      if (!active.length) drawText(g, 'Nobody is waiting on you.', cx, cy, 'a');
      for (const id of active) {
        const q = QUESTS[id];
        const pr = questProgress(p, id);
        drawText(g, q.title, cx, cy, 'J');
        drawText(g, `${pr.have}/${pr.want}`, W - 30 - textWidth(`${pr.have}/${pr.want}`), cy, pr.met ? 'I' : '9');
        cy += 10;
        for (const line of wrap(q.objective, 36)) { drawText(g, line, cx + 6, cy, '9'); cy += 10; }
        cy += 4;
      }
      if (p.flags.ended && !p.untimed && p.splits.end !== undefined) {
        drawText(g, `Reached Camp Hero in ${R.clock(p.splits.end)}`, cx, y + H - HUD_H - 12 - 38, 'I');
      }
      drawText(g, `Done: ${done}`, cx, y + H - HUD_H - 12 - 26, 'a');
      if (p.flags[EVERYWHERE.flag]) drawText(g, `\u2605 ${EVERYWHERE.name}`, cx + 60, y + H - HUD_H - 12 - 26, 'J');
    }
    const closes = `${label('back')} closes`;
    drawText(g, closes, W - 16 - 10 - textWidth(closes), y + H - HUD_H - 12 - 14, '%');
  }

  drawShop(g, m) {
    const p = this.game.p;
    const shop = SHOPS[m.id];
    const x = 8;
    const y = HUD_H + 6;
    const h = H - HUD_H - 12;
    panel(g, x, y, W - 16, h, 'Q', 'a');
    drawText(g, shop.name, x + 10, y + 7, 'J');
    const gold = `${p.gold} gold`;
    drawText(g, gold, W - 18 - textWidth(gold), y + 7, 'J');
    let cy = y + 24;
    shop.stock.forEach((slug, i) => {
      const item = ITEMS[slug];
      const have = item.slot && p.owned[slug];
      const color = have ? '%' : i === m.sel ? 'J' : '9';
      if (i === m.sel) drawText(g, '▶', x + 10, cy, 'J');
      drawText(g, item.name, x + 20, cy, color);
      const price = have ? 'have' : `${item.value}`;
      drawText(g, price, W - 18 - textWidth(price), cy, have ? '%' : p.gold >= item.value ? 'J' : '@');
      cy += 10;
      drawText(g, statLine(item), x + 26, cy, have ? '%' : 'I');
      cy += 13;
    });
    if (m.note) drawText(g, m.note, x + 10, y + h - 26, '9');
    drawText(g, `${label('a')} buys   ${label('back')} leaves`, x + 10, y + h - 14, '%');
  }

  drawEnding(g, m) {
    // The world falls away to a night sky: Star City is right there.
    g.globalAlpha = m.page === 0 ? Math.min(1, m.t / END.fade) : 1;
    fillRect(g, 0, 0, W, H, 'q');
    g.globalAlpha = 1;
    if (m.page === 0 && m.t < END.fade) return;
    for (const s of m.stars) {
      const phase = ((this.t + s.k * 5) >> 4) % 4;
      if (phase === 3) continue;
      fillRect(g, s.x, s.y, 1, 1, phase === 0 ? (s.gold ? 'J' : '8') : phase === 1 ? 'a' : 'j');
    }
    const blink = (this.t >> 4) % 2 === 0;
    if (m.page === 0) this.drawEndingRun(g, m, blink);
    else if (m.page === 1) this.drawEndingReward(g, m, blink);
    else {
      const lines = ENDING.credits.map((l) => plain(l));
      lines.forEach((text, i) => {
        if (m.t > 10 + i * 10) drawTextCentered(g, text, W / 2, 74 + i * 13, i === 0 ? 'J' : i === lines.length - 1 ? 'a' : '9');
      });
      if (m.best && m.best.frames) drawTextCentered(g, `Best ${R.clock(m.best.frames)}`, W / 2, 150, '%');
      if (m.t > 60 && blink) drawTextCentered(g, '▶ Keep playing', W / 2, H - 26, 'J');
    }
  }

  drawEndingRun(g, m, blink) {
    const run = m.run;
    const t = m.t;
    if (t > END.title) {
      const title = big('CAMP HERO', 2, 'J');
      g.drawImage(big('CAMP HERO', 2, 'y'), Math.round((W - title.width) / 2) + 1, 15);
      g.drawImage(title, Math.round((W - title.width) / 2), 14);
    }
    const said = ENDING.reached.map((l) => plain(l));
    if (t > END.title + 14) drawTextCentered(g, said[0], W / 2, 36, '9');
    if (t > END.title + 28) drawTextCentered(g, said[1], W / 2, 47, 'a');

    // The three kings, left to right in the order they fell: the route.
    const kings = run.kings.length ? run.kings : R.KINGS.map((slug) => ({ slug, frames: null }));
    kings.forEach((k, i) => {
      const at = END.kings + i * END.kingGap;
      if (t < at) return;
      const cx = 48 + i * 80;
      const spr = this.S.creatureFor(ENEMIES[k.slug]).right[0];
      const pop = t - at < 6 ? -(6 - (t - at)) : 0;
      g.drawImage(spr, cx - spr.width / 2, 62 + pop + (32 - spr.height));
      drawTextCentered(g, ENDING.kings[k.slug], cx, 98, 'J');
      drawTextCentered(g, k.frames === null ? '-' : R.clock(k.frames), cx, 109, '9');
      if (i < kings.length - 1 && t > at + 10) drawText(g, '→', cx + 37, 76, 'j');
    });

    if (t > END.count - 12) drawTextCentered(g, 'TIME', W / 2, 124, 'a');
    if (t > END.count) {
      const k = Math.min(1, (t - END.count) / (END.land - END.count));
      const shown = run.timed ? R.clock(Math.round(run.frames * (1 - (1 - k) * (1 - k)))) : '--:--';
      const landed = t >= END.land;
      const num = big(shown, 3, landed && (t - END.land < 24) && (t >> 2) % 2 ? '8' : landed ? 'J' : '9');
      g.drawImage(num, Math.round((W - num.width) / 2), 134);
      if (!run.timed && landed) drawTextCentered(g, plain(ENDING.untimed), W / 2, 162, '%');
      else if (landed && m.best && m.best.isNew && blink) drawTextCentered(g, 'NEW BEST', W / 2, 162, '$');
      else if (landed && m.best && m.best.frames && !m.best.isNew) drawTextCentered(g, `Best ${R.clock(m.best.frames)}`, W / 2, 162, '%');
    }
    if (t > END.stats) {
      const stats = `Level ${run.level}  ${run.kills} kills  ${run.deaths} ${run.deaths === 1 ? 'death' : 'deaths'}  ${run.rooms} rooms`;
      drawTextCentered(g, stats, W / 2, 178, 'I');
    }
    if (t >= END.ready && blink) drawTextCentered(g, '▶', W / 2, 200, 'J');
  }

  drawEndingReward(g, m, blink) {
    const t = m.t;
    if (t > 4) {
      const title = big('REWARD', 2, 'J');
      g.drawImage(title, Math.round((W - title.width) / 2), 14);
    }
    if (t > REWARD.chest) {
      // A gold chest, three times life size. It opens on the line that says why it is empty.
      const open = t >= REWARD.line + REWARD.open * REWARD.gap;
      const spr = open ? this.S.things.goldChestOpen : this.S.things.goldChest;
      const bob = open ? 0 : Math.round(Math.sin(this.t / 9) * 1.5);
      g.drawImage(spr, W / 2 - 24, 36 + bob, 48, 48);
      if (!open) {
        for (let i = 0; i < 5; i++) {
          const a = this.t / 20 + i * 1.257;
          if (((this.t >> 3) + i) % 3) fillRect(g, Math.round(W / 2 + Math.cos(a) * 34), Math.round(62 + Math.sin(a) * 20), 1, 1, i % 2 ? '8' : 'J');
        }
      }
    }
    let y = 96;
    m.reward.forEach((lines, i) => {
      const show = t >= REWARD.line + i * REWARD.gap;
      for (const line of lines) {
        if (show) drawTextCentered(g, line, W / 2, y, i === m.reward.length - 1 ? 'J' : '9');
        y += 11;
      }
      y += 4;
    });
    if (t >= REWARD.line + (m.reward.length - 1) * REWARD.gap + 30 && blink) drawTextCentered(g, '▶', W / 2, 206, 'J');
  }

  drawDead(g, m) {
    const k = Math.min(1, m.t / 50);
    g.globalAlpha = 0.86 * k;
    fillRect(g, 0, HUD_H, W, H - HUD_H, 'q');
    g.globalAlpha = 1;
    if (m.t < 30) return;
    const lines = wrap(m.text, 34);
    let y = HUD_H + 70 - lines.length * 5;
    for (const line of lines) { drawTextCentered(g, line, W / 2, y, '9'); y += 11; }
    if (m.t > 70 && (this.t >> 4) % 2 === 0) drawTextCentered(g, '▶ Rise', W / 2, y + 16, 'J');
  }
}
