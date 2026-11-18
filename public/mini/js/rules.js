// Light Gray Mini: the numbers. Pure functions, no drawing, no storage, so the
// same file runs under the test runner.
//
// The shape is Light Gray RPG's own: an offensive roll opposed by a defensive
// roll, floored at zero. Melee rolls STR, ranged rolls DEX, spells use MAG.
// An enemy's melee is blocked with DEF, its ranged with DEX, its magic with MAG.

import { ITEMS } from './data/items.js';

export function rand(lo, hi, r = Math.random) {
  if (hi < lo) return lo;
  return lo + Math.floor(r() * (hi - lo + 1));
}

/** One opposed roll. Returns both dice and the damage. */
export function opposedRoll(off, def, r = Math.random) {
  const a = rand(0, Math.max(0, Math.floor(off)), r);
  const d = rand(0, Math.max(0, Math.floor(def)), r);
  return { a, d, dmg: Math.max(0, a - d) };
}

/** A roll in the top tenth of its range is a crit. Tiny rolls never are. */
export function isCrit(roll, max) {
  const top = Math.floor(max);
  return top >= 3 && roll >= Math.ceil(top * 0.9);
}

/**
 * The player's own hit: the same opposed roll, with both ranges kept so the
 * dice can be shown, and doubled when the attack roll is a crit.
 */
export function strike(off, def, r = Math.random) {
  const roll = opposedRoll(off, def, r);
  const crit = roll.dmg > 0 && isCrit(roll.a, off);
  return {
    ...roll, crit, dmg: crit ? roll.dmg * 2 : roll.dmg,
    aMax: Math.max(0, Math.floor(off)), dMax: Math.max(0, Math.floor(def)),
  };
}

/** Total XP needed to reach the level after `level`: the original cubic curve. */
export function nextLevelXp(level) {
  return 2 * Math.pow(level + 1, 3);
}

/** Total XP at which `level` began. */
export function levelStartXp(level) {
  return level <= 1 ? 0 : 2 * Math.pow(level, 3);
}

/**
 * What an enemy of a level is worth. Sized so a level takes about six kills of
 * things your own level, before quests and bosses, all the way up the curve:
 * the road to Star City is about twenty levels and an hour long.
 */
export function enemyXp(level, boss = false) {
  const base = Math.ceil((3 * level * level + 3 * level + 1) / 3);
  return boss ? base * 4 : base;
}

/** What one level-up adds to the bars. Training is automatic in the Mini. */
export function levelGains(newLevel) {
  return { hp: 2 + newLevel, mp: 1 + Math.floor(newLevel / 2) };
}

export const STAT_KEYS = ['str', 'dex', 'def', 'mag'];
export const GEAR_SLOTS = ['sword', 'ranged', 'shield', 'armor', 'staff'];

/** Base stats plus everything worn. Gear can push a stat below zero. */
export function effectiveStats(player) {
  const out = { str: player.str, dex: player.dex, def: player.def, mag: player.mag };
  for (const slot of GEAR_SLOTS) {
    const item = ITEMS[player.gear[slot]];
    if (!item) continue;
    for (const k of STAT_KEYS) if (item[k]) out[k] += item[k];
  }
  return out;
}

/** The gear bonus alone, for the status screen. */
export function gearBonus(player) {
  const eff = effectiveStats(player);
  return { str: eff.str - player.str, dex: eff.dex - player.dex, def: eff.def - player.def, mag: eff.mag - player.mag };
}

/** The one number an item is judged by when deciding whether to wear it. */
export function gearScore(item) {
  if (!item) return -Infinity;
  const main = { sword: 'str', ranged: 'dex', shield: 'def', armor: 'def', staff: 'mag' }[item.slot];
  return item[main] || 0;
}

/** Which of the player's defenses answers an attack type. */
export function defenseFor(type, stats) {
  if (type === 'ranged') return stats.dex;
  if (type === 'magic') return stats.mag;
  return stats.def;
}

/**
 * An enemy's hit on the player. `special` follows enemy-specials in the main
 * game: bite is one hit in five at twice full attack; power is one in three
 * summing three rolls.
 */
export function enemyHit(enemy, stats, r = Math.random) {
  const def = defenseFor(enemy.type, stats);
  if (enemy.special === 'bite' && r() < 0.2) {
    const a = enemy.att * 2;
    const d = rand(0, Math.max(0, def), r);
    return { a, d, dmg: Math.max(0, a - d), special: 'bite' };
  }
  if (enemy.special === 'power' && r() < 1 / 3) {
    const a = rand(0, enemy.att, r) + rand(0, enemy.att, r) + rand(0, enemy.att, r);
    const d = rand(0, Math.max(0, def), r);
    return { a, d, dmg: Math.max(0, a - d), special: 'power' };
  }
  return opposedRoll(enemy.att, def, r);
}

/** Spell numbers, from the main game's registry at spell level 1. */
export const SPELLS = {
  missile: {
    name: 'Magic Missile', mp: 2, kind: 'shot',
    blurb: '1 + level + a MAG roll. Nothing blocks it.',
    roll(mag, r = Math.random) { return 2 + rand(0, Math.max(0, mag), r); },
  },
  heal: {
    name: 'Heal', mp: 2, kind: 'heal',
    blurb: 'Two MAG rolls of health.',
    roll(mag, r = Math.random) { const m = Math.max(1, mag); return rand(1, m, r) + rand(1, m, r); },
  },
};

/** Apply XP. Returns the levels gained, each with what it added. */
export function addXp(player, amount) {
  const ups = [];
  player.xp += amount;
  while (player.xp >= nextLevelXp(player.level)) {
    player.level += 1;
    const g = levelGains(player.level);
    player.hpMax += g.hp;
    player.mpMax += g.mp;
    player.hp = player.hpMax;
    player.mp = player.mpMax;
    player.cp += 1;
    ups.push({ level: player.level, ...g });
  }
  return ups;
}

// ------------------------------------------------------------- the run clock

/** The three kings Rigel wants dead, in no order. */
export const KINGS = ['kraken', 'troll-king', 'giant-mountain-giant'];

/** Frames (60 a second) as a clock: 4:07, 41:12, 1:02:09. */
export function clock(frames) {
  const s = Math.floor((frames || 0) / 60);
  const two = (n) => String(n).padStart(2, '0');
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

/** What the results card shows. A save from before the clock existed has no time. */
export function runSummary(player, rooms = 0) {
  const kings = KINGS.filter((k) => player.splits[k] !== undefined)
    .sort((a, b) => player.splits[a] - player.splits[b])
    .map((slug) => ({ slug, frames: player.splits[slug] }));
  return {
    frames: player.frames, timed: !player.untimed,
    level: player.level, deaths: player.deaths, rooms,
    kills: Object.values(player.kills).reduce((a, b) => a + b, 0),
    kings,
  };
}

/** A timed run beats no record, or a slower one. */
export function isBest(run, best) {
  return !!run.timed && (!best || !(best.frames > 0) || run.frames < best.frames);
}

export function newPlayer() {
  return {
    v: 1,
    room: '000', x: 120, y: 120, dir: 'up',
    level: 1, xp: 0, hp: 10, hpMax: 10, mp: 2, mpMax: 2,
    str: 0, dex: 0, def: 0, mag: 0, cp: 1,
    gold: 0,
    gear: { sword: null, ranged: null, shield: null, armor: null, staff: null },
    owned: {},          // gear ever picked up: slug -> true
    bag: {},            // consumables and quest items: slug -> count
    quick: null,        // the item on the X button
    spells: {},         // slug -> true
    spell: null,        // the spell on the Y button
    flags: {},
    quests: {},         // id -> 'active' | 'done'
    met: {},            // giver id -> true
    kills: {},          // enemy slug -> count
    lines: {},          // line set -> next index, so lines cycle in order
    seen: {},           // room id -> true
    downAt: {},         // boss slug -> time it was last killed
    deaths: 0,
    frames: 0,          // the run clock, in 60ths of a second
    splits: {},         // boss slug -> the clock when it first fell
    hub: '001',
  };
}

/** Put gear on if it beats what is worn. Returns true when it was equipped. */
export function takeGear(player, slug) {
  const item = ITEMS[slug];
  if (!item || !item.slot) return false;
  player.owned[slug] = true;
  if (gearScore(item) > gearScore(ITEMS[player.gear[item.slot]])) {
    player.gear[item.slot] = slug;
    return true;
  }
  return false;
}

export function addItem(player, slug, n = 1) {
  const item = ITEMS[slug];
  if (!item) return 0;
  if (item.slot) { takeGear(player, slug); return 1; }
  const cap = item.cap ?? 99;
  const have = player.bag[slug] || 0;
  const add = Math.max(0, Math.min(n, cap - have));
  if (add > 0) player.bag[slug] = have + add;
  if (item.use && !player.quick) player.quick = slug;
  return add;
}

/**
 * What one tree gives you: `gives` each, until the place's own limit (`upTo`)
 * or the bag's is reached. Zero means the tree stays standing.
 */
export function chopYield(player, def) {
  const item = ITEMS[def.item];
  if (!item) return 0;
  const have = player.bag[def.item] || 0;
  const cap = Math.min(def.upTo ?? Infinity, item.cap ?? 99);
  return Math.max(0, Math.min(def.gives || 1, cap - have));
}

export function hasItem(player, slug, n = 1) {
  return (player.bag[slug] || 0) >= n;
}

export function removeItem(player, slug, n = 1) {
  const have = player.bag[slug] || 0;
  if (have < n) return false;
  if (have === n) delete player.bag[slug];
  else player.bag[slug] = have - n;
  if (player.quick === slug && !player.bag[slug]) {
    player.quick = Object.keys(player.bag).find((s) => ITEMS[s] && ITEMS[s].use) || null;
  }
  return true;
}

/** Eat or drink something from the bag. Returns what it restored, or null. */
export function useItem(player, slug) {
  const item = ITEMS[slug];
  if (!item || !item.use || !hasItem(player, slug)) return null;
  const hp = Math.min(item.use.hp || 0, player.hpMax - player.hp);
  const mp = Math.min(item.use.mp || 0, player.mpMax - player.mp);
  if (hp <= 0 && mp <= 0) return { hp: 0, mp: 0, wasted: true };
  removeItem(player, slug);
  player.hp += hp;
  player.mp += mp;
  player.quick = player.bag[slug] ? slug : player.quick;
  return { hp, mp, wasted: false };
}
