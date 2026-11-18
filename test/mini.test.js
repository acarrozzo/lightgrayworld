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
      if (t.heldSprite) assert.ok(THING_SPRITES.has(t.heldSprite), `room ${id}: unknown sprite ${t.heldSprite}`);
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

test('mini: the map shows where you have been and where the roads go', async () => {
  const R = await load('rules.js');
  const M = await load('map.js');
  const p = R.newPlayer();
  p.seen['000'] = true;
  assert.deepEqual([...M.knownRooms(p)], [], 'Room Zero has no doors, so it promises nothing');
  assert.equal(M.roomsFound(p), 1);
  p.seen['001'] = true;
  assert.deepEqual([...M.knownRooms(p)].sort(), ['002', '004', '005', '006'], 'the four roads off the Crossroads');
  p.seen['006'] = true;
  assert.ok(M.knownRooms(p).has('023'), 'a gated road still shows: you can see it from here');
  assert.ok(!M.knownRooms(p).has('101'), 'but not what lies two rooms on');
  p.seen['stale-room-from-an-old-save'] = true;
  assert.equal(M.roomsFound(p), 3, 'a room that no longer exists is not counted');
  assert.doesNotThrow(() => M.knownRooms(p));
});

test('mini: the overworld fits the map screen, and every pillar is on it', async () => {
  const M = await load('map.js');
  const { ROOMS } = await load('data/rooms.js');
  const lay = M.sheetLayout('field');
  // One pixel per tile with a pixel between rooms, inside a 240 by 117 window.
  assert.ok(lay.cols * 17 - 1 <= 240 && lay.rows * 13 - 1 <= 117, `the overworld is ${lay.cols} by ${lay.rows}`);
  for (const [id, room] of Object.entries(ROOMS)) {
    assert.ok(M.SHEET_NAME[room.sheet], `room ${id} is on a sheet with no name`);
    if (room.hub) assert.equal(room.sheet, 'field', `gold pillar ${id} is not on the overworld`);
    if (room.sheet !== 'field') {
      const small = M.sheetLayout(room.sheet);
      assert.ok(small.cols * 49 - 1 <= 240 && small.rows * 37 - 1 <= 117, `sheet ${room.sheet} is too big to draw`);
    }
  }
});

test('mini: the cursor steps between rooms you know, and stairs lead between sheets', async () => {
  const M = await load('map.js');
  const all = () => true;
  assert.equal(M.stepCursor('001', 1, 0, all), '006');
  assert.equal(M.stepCursor('001', 0, -1, all), '005');
  assert.equal(M.stepCursor('001', 1, 0, (id) => id === '104'), '104', 'it skips what it may not land on');
  assert.equal(M.stepCursor('617', 0, -1, all), null, 'nothing is north of the Giant');
  assert.equal(M.stepCursor('026', 0, 1, all), null, 'it does not leap across the world for want of a neighbor');
  const pillars = (id) => ['001', '104', '210', '413', '507', '605', '701'].includes(id);
  assert.equal(M.stepCursor('210', 0, -1, pillars, true), '104');
  assert.equal(M.stepCursor('001', -1, 0, pillars, true), '413', 'between pillars it may jump as far as it must');
  for (const from of ['001', '104', '210', '413', '507', '605', '701']) {
    const reach = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => M.stepCursor(from, dx, dy, pillars, true)).filter(Boolean);
    assert.ok(reach.length > 0, `pillar ${from} can reach another`);
  }
  assert.equal(M.stairsLink('007'), '008');
  assert.equal(M.stairsLink('008'), '007');
  assert.equal(M.stairsLink('410'), '486');
  assert.equal(M.stairsLink('020'), null, 'the waterfall stays on one sheet');
  assert.equal(M.stairsLink('999'), null);
  assert.deepEqual(M.roomNotes('210'), ['Gold pillar', 'Rest']);
  assert.deepEqual(M.roomNotes('003'), ['Way down']);
});

test('mini: the map marks who is waiting on you', async () => {
  const R = await load('rules.js');
  const M = await load('map.js');
  const p = R.newPlayer();
  assert.deepEqual(M.questMark(p, '003'), { kind: 'offer', who: 'old_man', quest: 'oldman_001' });
  assert.equal(M.questMark(p, '007'), null, 'the Soldier will not talk until you have met the Old Man');
  p.met.old_man = true;
  p.quests.oldman_001 = 'active';
  assert.equal(M.questMark(p, '003'), null, 'a quest in progress is not a reason to go back yet');
  assert.equal(M.questMark(p, '007').kind, 'offer');
  R.addItem(p, 'flower', 1);
  assert.equal(M.questMark(p, '003').kind, 'ready');
  assert.equal(M.questMark(p, '001'), null);
  assert.equal(M.questMark(p, '024'), null, 'Jack waits on the gold chest');
});

test('mini: finding every room is every room but the Plane of Rebirth', async () => {
  const R = await load('rules.js');
  const M = await load('map.js');
  const { ROOMS } = await load('data/rooms.js');
  const p = R.newPlayer();
  for (const id of Object.keys(ROOMS)) if (id !== '999' && id !== '617') p.seen[id] = true;
  assert.equal(M.foundEverything(p), false);
  p.seen['617'] = true;
  assert.equal(M.foundEverything(p), true, 'nobody has to die to finish the map');
  assert.equal(M.roomsFound(p), Object.keys(ROOMS).length - 1);
});

test('mini: a button is called what it is on the thing you are holding', async () => {
  const I = await load('input.js');
  I.setDevice('keys');
  assert.deepEqual(['a', 'b', 'y', 'x', 'start', 'map', 'back'].map(I.label), ['Z', 'X', 'C', 'V', 'Enter', 'Tab', 'Esc']);
  assert.equal(I.withKeys('{a} swings. {b} throws. {start} is your bag.'), 'Z swings. X throws. Enter is your bag.');
  I.setDevice('touch');
  assert.deepEqual(['a', 'b', 'y', 'x', 'start', 'map', 'back'].map(I.label), ['A', 'B', 'Y', 'X', 'START', 'MAP', 'B']);
  assert.equal(I.withKeys('{move} {x} eats.'), 'The pad moves you. X eats.');
  assert.equal(I.withKeys('No keys here. {nope}'), 'No keys here. {nope}');
  I.setDevice('nonsense');
  assert.equal(I.currentDevice(), 'touch', 'an unknown device changes nothing');
  I.setDevice('keys');
});

test('mini: no text in the data names a pad button outright', async () => {
  const { ROOMS } = await load('data/rooms.js');
  const { QUESTS, PEOPLE } = await load('data/quests.js');
  // "A swings" would be wrong on a keyboard. Lines name buttons with {a}, {b}, {x}, {y}.
  const bad = /\b[ABXY] (swings|throws|casts|eats|talks|closes|buys|uses|opens)\b|\bSTART (is|opens|closes)\b/;
  const lines = [];
  for (const room of Object.values(ROOMS)) for (const t of room.things || []) lines.push(...[t.text, t.full, t.msg, t.ask, t.locked, t.noTool].flat().filter(Boolean));
  for (const q of Object.values(QUESTS)) lines.push(q.remind, q.done, q.objective);
  for (const person of Object.values(PEOPLE)) lines.push(person.greeting, person.locked, ...(person.idle || []));
  for (const line of lines.filter(Boolean)) assert.ok(!bad.test(line), `names a button outright: ${line}`);
});

test('mini: the middle of the Grassy Field is open ground', async () => {
  const { ROOMS } = await load('data/rooms.js');
  const trees = (id) => ROOMS[id].map.join('').split('T').length - 1;
  assert.equal(trees('001'), 0, 'no trees at the Crossroads');
  // The eight rooms around it keep trees only on their outer sides.
  for (const [id, inner] of Object.entries({ '005': 'S', '002': 'N', '004': 'E', '006': 'W' })) {
    const m = ROOMS[id].map;
    const edge = inner === 'S' ? m[11] : inner === 'N' ? m[0] : m.map((r) => r[inner === 'E' ? 15 : 0]).join('');
    assert.ok(!edge.includes('T'), `room ${id} still has trees on the side facing the Crossroads`);
  }
});

test('mini: a tree gives two wood until the place or the bag says stop', async () => {
  const R = await load('rules.js');
  const p = R.newPlayer();
  const jacks = { item: 'wood', gives: 2, upTo: 10 };
  const forest = { item: 'wood', gives: 2, upTo: 20 };
  assert.equal(R.chopYield(p, jacks), 2);
  p.bag.wood = 9;
  assert.equal(R.chopYield(p, jacks), 1, 'the last tree tops you up and no further');
  p.bag.wood = 10;
  assert.equal(R.chopYield(p, jacks), 0, 'Jack lets you take ten');
  assert.equal(R.chopYield(p, forest), 2, 'the Forest goes on to twenty');
  p.bag.wood = 20;
  assert.equal(R.chopYield(p, { item: 'wood', gives: 2, upTo: 99 }), 0, 'the bag holds twenty whatever the place says');
  assert.equal(R.chopYield(p, { item: 'nothing', gives: 2, upTo: 9 }), 0);
});

test("mini: the hatchet is at Jack's cabin, and the pines add up to a boat", async () => {
  const { ROOMS } = await load('data/rooms.js');
  const { ITEMS } = await load('data/items.js');
  const { neighbor } = await load('world.js');
  const things = (id) => ROOMS[id].things || [];
  const where = (pick) => Object.keys(ROOMS).filter((id) => things(id).some(pick)).sort();
  assert.deepEqual(where((t) => t.t === 'take' && t.item === 'hatchet'), ['024']);
  assert.equal(neighbor('024', 'N'), '025', "Jack's trees are one screen north of his cabin");
  assert.deepEqual(where((t) => t.t === 'chop'), ['025', '101']);
  const farm = things('025').filter((t) => t.t === 'chop');
  assert.equal(farm[0].upTo, 10);
  assert.ok(farm.reduce((n, t) => n + t.gives, 0) >= 10, 'one visit to the farm is enough for the ten Jack allows');
  assert.equal(things('101').find((t) => t.t === 'chop').upTo, ITEMS.wood.cap, 'the Forest fills the bag: the twenty a boat costs');
  // Nothing still hands out wood for free.
  assert.deepEqual(where((t) => t.t === 'take' && t.item === 'wood'), []);
});
