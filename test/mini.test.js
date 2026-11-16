// Light Gray Mini (public/mini): the parts that run without a browser.
// The Mini is plain ES modules, so they are loaded with import().

const test = require('node:test');
const assert = require('node:assert/strict');

const load = (name) => import(`../public/mini/js/${name}`);

/** A random source that replays a fixed list, then repeats the last value. */
function fixed(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('mini: the world data is consistent', async () => {
  const { validateWorld } = await load('world.js');
  assert.deepEqual(validateWorld(), []);
});

test('mini: every room edge that opens has a way back', async () => {
  const { neighbor, EDGES } = await load('world.js');
  const { ROOMS } = await load('data/rooms.js');
  for (const id of Object.keys(ROOMS)) {
    for (const edge of Object.keys(EDGES)) {
      const nb = neighbor(id, edge);
      if (nb) assert.equal(neighbor(nb, EDGES[edge].opposite), id, `${id} ${edge} -> ${nb} does not return`);
    }
  }
});

test('mini: every sprite grid fits and uses real palette colors', async () => {
  const { checkArt } = await load('art-sprites.js');
  const { PAL } = await load('gfx.js');
  assert.deepEqual(checkArt(PAL), []);
});

test('mini: every song track fits its song', async () => {
  const { SONGS } = await load('songs.js');
  const { songShape, noteHz } = await load('audio.js');
  for (const [name, song] of Object.entries(SONGS)) {
    const shape = songShape(song);
    assert.ok(shape.steps > 0 && shape.steps % 16 === 0, `${name} is ${shape.steps} steps, not whole bars`);
    assert.equal(shape.misfit, 0, `${name} has a track that does not divide the song`);
  }
  assert.equal(Math.round(noteHz('a4')), 440);
  assert.equal(Math.round(noteHz('bb3')), 233);
});

test('mini: the XP curve is the original cubic one', async () => {
  const R = await load('rules.js');
  // Light Gray RPG: getNextLevelXP(level) = (level + 1)^3 * 2, cumulative.
  assert.deepEqual([1, 2, 3, 4, 9].map(R.nextLevelXp), [16, 54, 128, 250, 2000]);
  const p = R.newPlayer();
  assert.deepEqual(R.addXp(p, 15), []);
  const ups = R.addXp(p, 1);
  assert.equal(ups.length, 1);
  assert.equal(p.level, 2);
  assert.equal(p.cp, 2, 'one point per level, on top of the starting one');
  assert.equal(p.hp, p.hpMax, 'a level-up restores HP');
  // A big reward can cross several levels at once.
  const q = R.newPlayer();
  assert.equal(R.addXp(q, 130).length, 3);
  assert.equal(q.level, 4);
});

test('mini: a hit is an offensive roll minus a defensive roll, floored at zero', async () => {
  const R = await load('rules.js');
  assert.deepEqual(R.opposedRoll(5, 3, fixed(0.99, 0)), { a: 5, d: 0, dmg: 5 });
  assert.deepEqual(R.opposedRoll(5, 3, fixed(0, 0.99)), { a: 0, d: 3, dmg: 0 });
  assert.equal(R.opposedRoll(0, 0).dmg, 0, 'no strength, no damage');
  assert.equal(R.opposedRoll(-4, 2, fixed(0.99, 0)).a, 0, 'gear can push a stat below zero; the roll floors');
  for (let i = 0; i < 200; i++) {
    const r = R.opposedRoll(7, 4);
    assert.ok(r.a >= 0 && r.a <= 7 && r.d >= 0 && r.d <= 4 && r.dmg === Math.max(0, r.a - r.d));
  }
});

test('mini: each attack type is blocked by its own stat', async () => {
  const R = await load('rules.js');
  const stats = { str: 9, dex: 2, def: 5, mag: 7 };
  assert.equal(R.defenseFor('melee', stats), 5);
  assert.equal(R.defenseFor('ranged', stats), 2);
  assert.equal(R.defenseFor('magic', stats), 7);
  // The Gator's bite: one hit in five lands at twice full attack.
  const bite = R.enemyHit({ att: 8, type: 'melee', special: 'bite' }, stats, fixed(0.1, 0));
  assert.deepEqual(bite, { a: 16, d: 0, dmg: 16, special: 'bite' });
});

test('mini: gear is worn when it is better, and counts toward stats', async () => {
  const R = await load('rules.js');
  const p = R.newPlayer();
  assert.equal(R.takeGear(p, 'long-sword'), true);
  assert.equal(R.takeGear(p, 'training-sword'), false, 'a worse sword goes in the pack, not the hand');
  assert.equal(p.gear.sword, 'long-sword');
  R.takeGear(p, 'kite-shield');
  R.takeGear(p, 'padded-armor');
  assert.deepEqual(R.effectiveStats(p), { str: 5, dex: 0, def: 14, mag: 0 });
});

test('mini: food heals up to the cap and is not wasted when full', async () => {
  const R = await load('rules.js');
  const p = R.newPlayer();
  R.addItem(p, 'redberry', 3);
  assert.equal(p.quick, 'redberry', 'the first food lands on the X button');
  assert.deepEqual(R.useItem(p, 'redberry'), { hp: 0, mp: 0, wasted: true });
  assert.equal(p.bag.redberry, 3, 'a full Wanderer keeps the berry');
  p.hp = 7;
  assert.deepEqual(R.useItem(p, 'redberry'), { hp: 3, mp: 0, wasted: false });
  assert.equal(p.bag.redberry, 2);
  assert.equal(R.addItem(p, 'flower', 5), 1, 'one flower at a time');
});

test('mini: the Old Man and the Soldier hand out their quests in order', async () => {
  const R = await load('rules.js');
  const { currentQuest, questProgress, QUESTS } = await load('data/quests.js');
  const p = R.newPlayer();
  assert.equal(currentQuest(p, 'old_man'), 'oldman_001');
  assert.equal(questProgress(p, 'oldman_001').met, false);
  R.addItem(p, 'flower', 1);
  assert.equal(questProgress(p, 'oldman_001').met, true);
  p.quests.oldman_001 = 'done';
  assert.equal(currentQuest(p, 'old_man'), 'oldman_002');
  p.kills['giant-rat'] = 1;
  assert.deepEqual(questProgress(p, 'oldman_002'), { have: 1, want: 2, met: false });
  p.kills['giant-rat'] = 5;
  assert.deepEqual(questProgress(p, 'oldman_002'), { have: 2, want: 2, met: true });
  assert.equal(currentQuest(p, 'young_soldier'), 'soldier_001');
  R.takeGear(p, 'training-sword');
  assert.equal(questProgress(p, 'soldier_001').met, true);
  assert.equal(currentQuest(p, 'shaman'), null, 'the Shaman has no quests');
  for (const q of Object.values(QUESTS)) assert.ok(q.remind && q.done && q.title);
});

test('mini: gates read the same conditions the rooms declare', async () => {
  const R = await load('rules.js');
  const { check, edgeGate } = await load('world.js');
  const p = R.newPlayer();
  assert.match(edgeGate(p, '004', 'W'), /sand crabs/);
  R.takeGear(p, 'training-sword');
  assert.equal(edgeGate(p, '004', 'W'), null);
  assert.match(edgeGate(p, '006', 'E'), /Gold Chest/);
  p.flags.chest1 = true;
  assert.equal(edgeGate(p, '006', 'E'), null);
  // The Forest waits on Jack; Red Town on an Ogre; the Magical Gate on the Kobold Master.
  assert.match(edgeGate(p, '023', 'E'), /Jack Lumber/);
  assert.match(edgeGate(p, '107', 'S'), /killing an Ogre/);
  p.kills.ogre = 1;
  assert.equal(edgeGate(p, '107', 'S'), null);
  assert.match(edgeGate(p, '114', 'N'), /Magical Gate/);
  p.kills['kobold-master'] = 1;
  assert.equal(edgeGate(p, '114', 'N'), null, 'the kill alone opens it, as in the main game');
  // The toll takes gold or a fight.
  assert.match(edgeGate(p, '504', 'W'), /toll/);
  p.flags.toll = true;
  assert.equal(edgeGate(p, '504', 'W'), null);
  assert.equal(check(p, { has: 'gills' }), false);
  R.addItem(p, 'gills', 1);
  assert.equal(check(p, { has: 'gills' }), true);
  assert.equal(check(p, { all: [{ quest: 'oldman_001' }, { sword: true }] }), false);
  p.quests.oldman_001 = 'done';
  assert.equal(check(p, { all: [{ quest: 'oldman_001' }, { sword: true }] }), true);
});

test('mini: the Blue Gate opens on three kings, in any order', async () => {
  const R = await load('rules.js');
  const { questProgress } = await load('data/quests.js');
  const { edgeGate } = await load('world.js');
  const p = R.newPlayer();
  assert.deepEqual(questProgress(p, 'rigel_001'), { have: 0, want: 3, met: false });
  p.kills['giant-mountain-giant'] = 1;
  p.kills['troll-king'] = 2;
  assert.deepEqual(questProgress(p, 'rigel_001'), { have: 2, want: 3, met: false });
  p.kills.kraken = 1;
  assert.equal(questProgress(p, 'rigel_001').met, true);
  assert.match(edgeGate(p, '611', 'W'), /Blue Gate/, 'the kills are not enough; Rigel has to be told');
  p.quests.rigel_001 = 'done';
  assert.equal(edgeGate(p, '611', 'W'), null);
});

test('mini: you can walk from Room Zero to Camp Hero', async () => {
  const { ROOMS } = await load('data/rooms.js');
  const { neighbor, EDGES } = await load('world.js');
  // Every room reachable from the start by edges, stairs, doors and pillars, ignoring gates.
  const seen = new Set(['000']);
  const todo = ['000'];
  while (todo.length) {
    const id = todo.pop();
    const room = ROOMS[id];
    const next = [];
    for (const edge of Object.keys(EDGES)) next.push(neighbor(id, edge));
    for (const w of room.warps || []) next.push(w.to);
    for (const t of room.things || []) if (t.to && t.to !== 'hub') next.push(t.to);
    for (const n of next) if (n && !seen.has(n)) { seen.add(n); todo.push(n); }
  }
  const lost = Object.keys(ROOMS).filter((id) => !seen.has(id) && id !== '999');
  assert.deepEqual(lost, [], 'rooms nobody can get to');
  assert.ok(seen.has('701'));
  assert.ok(Object.keys(ROOMS).length >= 60);
});

test('mini: everything the data names can be drawn', async () => {
  const { hasArt, THING_SPRITES, LOOKS } = await load('art-sprites.js');
  const { ENEMIES } = await load('data/enemies.js');
  const { ROOMS } = await load('data/rooms.js');
  const { PEOPLE } = await load('data/quests.js');
  const { THEMES } = await load('art-tiles.js');
  const { SONGS } = await load('songs.js');
  for (const [slug, def] of Object.entries(ENEMIES)) assert.ok(hasArt(def), `no art for enemy ${slug}`);
  for (const [id, person] of Object.entries(PEOPLE)) assert.ok(LOOKS[person.look], `no look for ${id}`);
  for (const [id, room] of Object.entries(ROOMS)) {
    assert.ok(THEMES[room.theme], `room ${id}: unknown theme ${room.theme}`);
    assert.ok(SONGS[room.music], `room ${id}: unknown song ${room.music}`);
    for (const t of room.things || []) {
      if (t.sprite) assert.ok(THING_SPRITES.has(t.sprite), `room ${id}: unknown sprite ${t.sprite}`);
      if (t.look) assert.ok(LOOKS[t.look], `room ${id}: unknown look ${t.look}`);
    }
  }
});

test('mini: a fight takes a sane number of swings at the level you meet it', async () => {
  const { ENEMIES } = await load('data/enemies.js');
  // Expected damage of one opposed roll, exactly.
  const expected = (off, def) => {
    let sum = 0;
    for (let a = 0; a <= off; a++) for (let d = 0; d <= def; d++) sum += Math.max(0, a - d);
    return sum / ((off + 1) * (def + 1));
  };
  // Roughly the STR a Wanderer brings: 60% of their points, plus the sword of the day.
  const sword = (lv) => (lv >= 18 ? 27 : lv >= 12 ? 18 : lv >= 9 ? 11 : lv >= 4 ? 5 : 3);
  for (const [slug, e] of Object.entries(ENEMIES)) {
    const off = Math.round(e.level * 0.6) + sword(e.level);
    const swings = e.hp / expected(off, e.def);
    const cap = e.boss ? 90 : 14;
    assert.ok(swings <= cap, `${slug} takes about ${Math.round(swings)} swings at level ${e.level}`);
  }
});
