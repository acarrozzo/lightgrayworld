// Light Gray Mini: the rest of the road, from Jack Lumber's gate to Camp Hero.
//
// These rooms are described rather than drawn by hand: which edges open, where
// the paths run, what is stamped where, and how many trees or rocks to scatter
// in whatever space is left. build() turns that into the same 16x12 grid the
// hand-drawn rooms use, and the validator checks the result like any other.
// The scatter is seeded by the room id, so a room always comes out the same.
//
// Sign and gate text is the main game's unless marked DRAFT. Two kinds of small
// edit are made to real lines without a DRAFT mark: an em dash becomes a
// period, and a mention of a Wings or Gills potion is dropped, because here
// those are things you learn once and keep.

const COLS = 16;
const ROWS = 12;
const NS = [7, 8];          // where a north or south exit sits
const WE = [5, 6];          // where a west or east exit sits
const ROAD_H = [0, 5, 16, 2];
const ROAD_V = [7, 0, 2, 12];

function seeded(text) {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function mk(id, gen, avoid) {
  const { border = 'T', fill = '.', open = {}, sides = {}, paths = [], stamps = [], scatter = {} } = gen;
  const m = Array.from({ length: ROWS }, () => Array(COLS).fill(fill));
  const held = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const hold = (x, y) => { if (x >= 0 && y >= 0 && x < COLS && y < ROWS) held[y][x] = true; };

  for (let x = 0; x < COLS; x++) { m[0][x] = sides.N || border; m[ROWS - 1][x] = sides.S || border; }
  for (let y = 0; y < ROWS; y++) { m[y][0] = sides.W || border; m[y][COLS - 1] = sides.E || border; }
  // Corners belong to whichever side is closed.
  for (const [x, y, a, b] of [[0, 0, 'N', 'W'], [COLS - 1, 0, 'N', 'E'], [0, ROWS - 1, 'S', 'W'], [COLS - 1, ROWS - 1, 'S', 'E']]) {
    const sa = sides[a] || border;
    const sb = sides[b] || border;
    m[y][x] = sa !== fill ? sa : sb !== fill ? sb : border;
  }

  // An exit keeps its whole row or column clear, so every way in meets in the middle.
  for (const c of open.N || []) { m[0][c] = fill; for (let y = 0; y < ROWS; y++) hold(c, y); }
  for (const c of open.S || []) { m[ROWS - 1][c] = fill; for (let y = 0; y < ROWS; y++) hold(c, y); }
  for (const r of open.W || []) { m[r][0] = fill; for (let x = 0; x < COLS; x++) hold(x, r); }
  for (const r of open.E || []) { m[r][COLS - 1] = fill; for (let x = 0; x < COLS; x++) hold(x, r); }

  for (const [x, y, w, h, ch = ':'] of paths) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { m[j][i] = ch; hold(i, j); }
  }
  for (const [x, y, ...rows] of stamps) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ' ') { m[y + j][x + i] = ch; hold(x + i, y + j); } }));
  }
  for (const [x, y] of avoid) { hold(x, y); hold(x + 1, y); hold(x - 1, y); hold(x, y + 1); hold(x, y - 1); }

  const r = seeded(id);
  for (const [ch, n] of Object.entries(scatter)) {
    for (let placed = 0, tries = 0; placed < n && tries < 500; tries++) {
      const x = 1 + Math.floor(r() * (COLS - 2));
      const y = 1 + Math.floor(r() * (ROWS - 2));
      if (held[y][x] || m[y][x] !== fill) continue;
      m[y][x] = ch;
      placed += 1;
    }
  }
  return m.map((row) => row.join(''));
}

function build(id, def) {
  const { gen, ...rest } = def;
  const avoid = [...(gen.keep || [])];
  for (const t of def.things || []) {
    for (let y = t.y; y < t.y + (t.h || 1); y++) for (let x = t.x; x < t.x + (t.w || 1); x++) avoid.push([x, y]);
  }
  const stamps = [...(gen.stamps || [])];
  for (const w of def.warps || []) { avoid.push([w.x, w.y]); if (w.tile) stamps.push([w.x, w.y, w.tile]); }
  if (def.boss) for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]]) avoid.push([def.boss.cx + dx, def.boss.cy + dy]);
  return { ...rest, map: mk(id, { ...gen, stamps }, avoid) };
}

const FULL = 'Everything is full again.';

// Pines fall to a hatchet, two wood each, and grow back when you leave.
const pines = (cells, lines) => cells.map(([x, y]) => ({ t: 'chop', x, y, item: 'wood', gives: 2, ...lines }));
const field = { sheet: 'field', theme: 'field', music: 'field' };
const forest = { sheet: 'field', theme: 'forest', music: 'forest' };
const town = { sheet: 'field', theme: 'town', music: 'town', safe: true };
const sea = { sheet: 'field', theme: 'beach', music: 'ocean', sea: true };
const deep = { sheet: 'underwater', theme: 'underwater', music: 'ocean' };
const dark = { sheet: 'field', theme: 'darkforest', music: 'dark' };
const peak = { sheet: 'field', theme: 'mountain', music: 'mountain' };
const CITY = { border: '#', fill: '_' };
const CAVE = { border: '#', fill: '.' };

const DEFS = {
  // ------------------------------------------- the rest of the Grassy Field
  '023': {
    name: "Jack's Forest Gate", sub: 'Path to the Forest', ...field, at: [3, 1], safe: true,
    gen: { open: { W: WE, N: NS, E: WE }, paths: [ROAD_H, [7, 0, 2, 6]], scatter: { T: 14, ',': 4 } },
    things: [
      { t: 'npc', x: 13, y: 4, who: 'green_guard' },
      { t: 'sign', x: 5, y: 3, text: 'DRAFT|East: the Forest. North: Jack Lumber.' },
    ],
    gates: [{
      edge: 'E', need: { quest: 'jack_000' },
      msg: "You're not ready for the Forest yet. Go talk to Jack Lumber in his cabin to the north. Complete his quests and I'll let you through.",
    }],
  },
  '024': {
    name: 'Jack Lumber', sub: 'Professional Lumberjack', ...field, at: [3, 0], safe: true,
    gen: { open: { S: NS, N: NS }, paths: [ROAD_V], scatter: { T: 12, u: 4 } },
    things: [
      { t: 'decor', x: 10, y: 2, w: 3, h: 2, sprite: 'houseWood', text: 'A flannel wearing, hatchet wielding man has a wood workshop set up here.' },
      { t: 'npc', x: 10, y: 5, who: 'jack' },
      { t: 'craft', x: 4, y: 5, sprite: 'bench' },
      {
        t: 'take', x: 12, y: 5, sprite: 'blockHatchet', heldSprite: 'block', item: 'hatchet', upTo: 1,
        text: 'You pick up a hatchet.', full: 'You already have a hatchet.',
      },
      { t: 'sign', x: 5, y: 8, text: 'DRAFT|WOOD WORKSHOP. Twenty wood makes a boat. Take the hatchet. The trees are north.' },
    ],
  },
  '025': {
    name: 'Goblin Woods', sub: "Jack's Tree Farm", ...field, at: [3, -1],
    gen: { open: { S: NS }, paths: [[7, 6, 2, 6]], scatter: { T: 10, u: 3 } },
    things: pines([[3, 3], [5, 3], [10, 3], [12, 3], [3, 6], [5, 6], [10, 6], [12, 6]], {
      upTo: 10,
      noTool: "You need a hatchet to chop wood here. There should be one at Jack's cabin to the south.",
      full: 'Jack will only let you chop down 10 wood here. You can chop down more in the Forest.',
    }),
    spawns: [['goblin', 3]],
  },
  '026': {
    name: 'Stone Path South', sub: 'Gate to the Rocky Flats', ...field, at: [1, 3],
    gen: { open: { N: NS }, paths: [[7, 0, 2, 9], [3, 6, 5, 1]], keep: [[3, 7], [2, 6]], scatter: { o: 14, T: 5 } },
    things: [
      { t: 'npc', x: 7, y: 9, who: 'dwarf_guard' },
      { t: 'sign', x: 10, y: 8, text: 'A stout dwarf in battered plate stands watch beside a massive iron-banded gate. He wants to see a guild badge before he lets anyone south.' },
      { t: 'sign', x: 4, y: 5, text: 'DRAFT|BAT CAVE. Bring something that throws.' },
    ],
    warps: [{ x: 3, y: 6, tile: 'v', to: '028b', cx: 3, cy: 4, dir: 'down' }],
  },
  '028b': {
    name: 'Bat Cave', sub: 'EXIT', sheet: 'batcave', theme: 'batcave', music: 'cave', at: [0, 0],
    gen: { ...CAVE, open: { E: WE }, paths: [[3, 4, 1, 2, '.']], scatter: { '#': 8, o: 5 } },
    warps: [{ x: 3, y: 3, tile: '^', to: '026', cx: 3, cy: 7, dir: 'down' }],
    spawns: [['bat', 5]],
  },
  '028g': {
    name: 'Goblin Tracks', sub: 'in the Bat Cave', sheet: 'batcave', theme: 'batcave', music: 'cave', at: [1, 0],
    gen: { ...CAVE, open: { W: WE, N: NS }, scatter: { '#': 8, o: 4 } },
    things: [{ t: 'chest', x: 12, y: 8, id: 'chest-028', loot: { gold: [40, 70], items: [['red-potion', 2]] } }],
    spawns: [['goblin', 3], ['salamander', 1], ['bat', 2]],
  },
  '028i': {
    name: 'Goblin Hideout', sub: 'The Chief is home', sheet: 'batcave', theme: 'batcave', music: 'cave', at: [1, -1],
    gen: { ...CAVE, open: { S: NS }, scatter: { o: 4 } },
    boss: { slug: 'goblin-chief', cx: 7, cy: 4 },
    spawns: [['goblin', 2]],
  },

  // ------------------------------------------------------------- the Forest
  101: {
    name: 'Forest Path', sub: 'Wolves', ...forest, at: [4, 1],
    gen: { open: { W: WE, E: WE, N: NS }, paths: [ROAD_H, [7, 0, 2, 6]], scatter: { T: 24, b: 3 } },
    things: pines([[2, 8], [4, 8], [6, 8], [9, 8], [11, 8], [13, 8]], {
      upTo: 20,
      noTool: 'DRAFT|You need a hatchet to chop these trees. Jack Lumber keeps one at his cabin.',
      full: 'DRAFT|Twenty is all you can carry.',
    }),
    spawns: [['wolf', 2], ['snake', 1]],
  },
  104: {
    name: 'On a Stone Path', sub: 'by a Forest Gate', ...forest, at: [5, 1], safe: true, hub: true,
    gen: { open: { W: WE, E: WE, N: NS, S: NS }, paths: [ROAD_H, ROAD_V], scatter: { T: 16 } },
    things: [
      { t: 'hub', x: 10, y: 3, sprite: 'hubPillar' },
      { t: 'sign', x: 5, y: 3, text: ['DRAFT|FOREST PATH DIRECTORY', 'DRAFT|The Ogre Lair lies east and the Kobold Lair northeast. Both run deep, and both end in a boss worth a guild membership.', 'DRAFT|Red Town is south. They will want to see an Ogre dead first.'] },
    ],
  },
  118: {
    name: 'Hunter Bill', sub: 'Training Camp', ...forest, at: [4, 0], safe: true,
    gen: { open: { S: NS }, paths: [[7, 5, 2, 7]], scatter: { T: 24 } },
    things: [
      { t: 'npc', x: 9, y: 4, who: 'hunter_bill' },
      { t: 'rest', x: 6, y: 4, sprite: 'fire', text: `DRAFT|You rest at Bill's camp. ${FULL}` },
    ],
  },
  114: {
    name: 'Magical Gate', sub: 'North is darker', ...forest, at: [5, 0],
    gen: { open: { S: NS, N: NS, E: WE }, paths: [ROAD_V, [7, 5, 9, 2]], scatter: { T: 18 } },
    spawns: [['bear', 1], ['wolf', 1]],
    gates: [{
      edge: 'N', need: { any: [{ quest: 'wizards_000' }, { kills: ['kobold-master', 1] }] },
      msg: "You cannot pass the Magical Gate yet! Join the Wizard's Guild by defeating the Kobold Master to pass.",
    }],
  },
  115: {
    name: 'Kobold Lair', sub: 'Entrance', ...forest, at: [6, 0],
    gen: { open: { W: WE }, paths: [[0, 5, 11, 2]], scatter: { T: 22 } },
    things: [{ t: 'sign', x: 8, y: 3, text: 'Magical Kobolds Below! The enemies below generally drop MAGIC increasing equipment.' }],
    warps: [{ x: 10, y: 5, tile: 'v', to: '115a', cx: 3, cy: 4, dir: 'down' }],
    spawns: [['snake', 2]],
  },
  111: {
    name: 'Ogre Cave', sub: 'Entrance', ...forest, at: [6, 1],
    gen: { open: { W: WE }, paths: [[0, 5, 11, 2]], scatter: { T: 20, o: 3 } },
    things: [{ t: 'sign', x: 8, y: 3, text: 'Ogres Below!' }],
    warps: [{ x: 10, y: 5, tile: 'v', to: '111a', cx: 3, cy: 4, dir: 'down' }],
    spawns: [['wolf', 2]],
  },
  107: {
    name: 'Red Town Gate', sub: 'Prove your worth', ...forest, at: [5, 2], safe: true,
    gen: { open: { N: NS, S: NS }, paths: [ROAD_V], stamps: [[1, 10, '######'], [9, 10, '######']], scatter: { T: 16 } },
    things: [{ t: 'npc', x: 6, y: 9, who: 'red_guard' }],
    gates: [{
      edge: 'S', need: { kills: ['ogre', 1] },
      msg: 'A Red Guard stops you at the gate. To gain access to Red Town you must prove your worth by killing an Ogre.',
    }],
  },
  '111a': {
    name: 'Ogre Lair', sub: 'Underground', sheet: 'ogrelair', theme: 'ogrelair', music: 'cave', at: [0, 0],
    gen: { ...CAVE, open: { E: WE }, paths: [[3, 4, 1, 2, '.']], scatter: { '#': 6, o: 4 } },
    warps: [{ x: 3, y: 3, tile: '^', to: '111', cx: 9, cy: 6, dir: 'down' }],
    spawns: [['ogre', 2]],
  },
  '111k': {
    name: 'Ogre Lieutenant', sub: 'His lair', sheet: 'ogrelair', theme: 'ogrelair', music: 'cave', at: [1, 0],
    gen: { ...CAVE, open: { W: WE }, scatter: { o: 4 } },
    boss: { slug: 'ogre-lieutenant', cx: 10, cy: 5 },
  },
  '115a': {
    name: 'Kobold Lair', sub: 'Underground', sheet: 'koboldlair', theme: 'koboldlair', music: 'cave', at: [0, 0],
    gen: { ...CAVE, open: { N: NS }, paths: [[3, 4, 6, 1, '.']], scatter: { '#': 6, o: 3 } },
    warps: [{ x: 3, y: 3, tile: '^', to: '115', cx: 9, cy: 6, dir: 'down' }],
    spawns: [['kobold', 2], ['kobold-warlock', 2]],
  },
  '115k': {
    name: 'Kobold Master', sub: 'His chambers', sheet: 'koboldlair', theme: 'koboldlair', music: 'cave', at: [0, -1],
    gen: { ...CAVE, open: { S: NS }, scatter: { o: 3 } },
    boss: { slug: 'kobold-master', cx: 7, cy: 4 },
    spawns: [['kobold', 1]],
  },

  // --------------------------------------------------------------- Red Town
  210: {
    name: 'Grand Square', sub: 'The heart of New Babylon', ...town, at: [5, 3], hub: true,
    gen: { ...CITY, open: { N: NS, W: WE, E: WE, S: NS } },
    things: [
      { t: 'rest', x: 10, y: 2, w: 2, h: 2, sprite: 'fountain', text: `DRAFT|You rest at the fountain. ${FULL}` },
      { t: 'hub', x: 4, y: 3, sprite: 'hubPillar' },
      { t: 'npc', x: 11, y: 8, who: 'vinny' },
      { t: 'sign', x: 5, y: 8, text: ['The heart of New Babylon, and easily the busiest place in town. Roads run off in every direction.', 'DRAFT|West: the guilds. East: the shops. South: Todd\'s.'] },
    ],
  },
  225: {
    name: 'Guild Row', sub: "Wizard's and Warrior's", ...town, at: [4, 3],
    gen: { ...CITY, open: { E: WE } },
    things: [
      { t: 'decor', x: 2, y: 2, w: 3, h: 2, sprite: 'houseBlue', text: 'Do you want to bend fire and lightning to your will? To heal what should not heal, and unmake what should not be unmade? Then the Wizard\'s Guild wants you.' },
      { t: 'decor', x: 10, y: 2, w: 3, h: 2, sprite: 'houseRed', text: 'Do you love crushing enemies with massive warhammers and razor-sharp swords? Initiation Bonus: TWO FREE SWORDS. Because one just isn\'t enough.' },
      { t: 'npc', x: 3, y: 4, who: 'wizards_recruiter' },
      { t: 'npc', x: 11, y: 4, who: 'warriors_recruiter' },
      { t: 'npc', x: 5, y: 8, who: 'wizard_morty' },
      { t: 'npc', x: 12, y: 8, who: 'warrior_pete' },
    ],
  },
  227: {
    name: 'Market Street', sub: 'Weapons and potions', ...town, at: [6, 3],
    gen: { ...CITY, open: { W: WE } },
    things: [
      { t: 'npc', x: 3, y: 3, look: 'merchant', silent: true },
      { t: 'shop', x: 3, y: 4, sprite: 'counter', shop: 'michael' },
      { t: 'npc', x: 7, y: 3, look: 'merchant', silent: true },
      { t: 'shop', x: 7, y: 4, sprite: 'counter', shop: 'steel' },
      { t: 'npc', x: 11, y: 3, look: 'innkeeper', silent: true },
      { t: 'shop', x: 11, y: 4, sprite: 'counter', shop: 'adam' },
      { t: 'sign', x: 5, y: 8, text: "DRAFT|Michael's Weapon Shop. His back room. Adam's General Store." },
    ],
  },
  220: {
    name: "Todd's Pub & Inn", sub: 'Stories over ale', ...town, at: [5, 4],
    gen: { ...CITY, open: { N: NS } },
    things: [
      { t: 'decor', x: 10, y: 2, w: 4, h: 2, sprite: 'housePub', text: "Todd's is where travelers and townsfolk gather to swap stories over ale and laughter." },
      { t: 'npc', x: 11, y: 5, who: 'todds' },
      { t: 'rest', x: 4, y: 4, sprite: 'tea', text: `DRAFT|You sit at Todd's a while. ${FULL}` },
    ],
  },

  // ------------------------------------------------------------- Blue Ocean
  403: {
    name: 'Blue Ocean', sub: 'Open water', ...sea, at: [-2, 1],
    gen: { border: 'o', fill: '~', sides: { N: '~', E: '~', W: '~' }, stamps: [[6, 7, ' ss ', 'ssss', ' ss ']] },
    spawns: [['jellyfish', 2], ['piranha', 2]],
  },
  404: {
    name: 'Blue Ocean', sub: 'West', ...sea, at: [-3, 1],
    gen: { border: 'o', fill: '~', sides: { N: '~', E: '~' }, stamps: [[3, 6, 'sss', 'sss', 'sss']] },
    things: [{ t: 'chest', x: 4, y: 7, id: 'chest-404', loot: { gold: [150, 250], items: [['purple-potion', 1]] } }],
    spawns: [['squid', 2], ['piranha', 1]],
  },
  413: {
    name: 'Blue Oasis', sub: 'Friendly Pirate', ...sea, at: [-3, 0], safe: true, hub: true,
    gen: {
      border: 'o', fill: '~', sides: { S: '~', E: '~' },
      stamps: [[4, 3, 'ssssssss'], [3, 4, 'ssssssssss'], [3, 5, 'ssssssssss'], [3, 6, 'ssssssssss'], [4, 7, 'ssssssss'], [5, 8, 'ssssss'], [4, 3, 'T'], [11, 3, 'T']],
    },
    things: [
      { t: 'npc', x: 7, y: 4, who: 'friendly_pirate' },
      { t: 'rest', x: 10, y: 5, sprite: 'restStone', text: `DRAFT|You rest at the spring. ${FULL}` },
      { t: 'hub', x: 5, y: 5, sprite: 'hubPillar' },
    ],
  },
  410: {
    name: 'Blue Ocean', sub: 'The whirlpool', ...sea, at: [-2, 0],
    gen: { border: 'o', fill: '~', sides: { S: '~', W: '~' } },
    things: [{ t: 'decor', x: 8, y: 5, sprite: 'whirl', solid: false, text: 'DRAFT|The water turns here, and goes down.' }],
    warps: [{
      x: 8, y: 5, to: '486', cx: 8, cy: 6, dir: 'down', need: { has: 'gills' },
      msg: "You can't swim that way! You need to be breathing water.",
    }],
    spawns: [['jellyfish', 2], ['squid', 1]],
  },
  486: {
    name: 'Under the Ocean', sub: 'Breathing water', ...deep, at: [0, 0],
    gen: { ...CAVE, open: { W: WE }, paths: [[8, 4, 1, 2, '.']], keep: [[8, 6]], scatter: { o: 5, T: 5, '#': 4 } },
    warps: [{ x: 8, y: 3, tile: '^', to: '410', cx: 8, cy: 7, dir: 'down' }],
    spawns: [['great-white', 1]],
  },
  496: {
    name: 'Shark Waters', sub: 'They are always here', ...deep, at: [-1, 0],
    gen: { ...CAVE, open: { E: WE, W: WE }, scatter: { o: 5, T: 5 } },
    spawns: [['great-white', 2]],
  },
  499: {
    name: 'The Kraken', sub: 'The King under the Ocean', ...deep, at: [-2, 0],
    gen: { ...CAVE, open: { E: WE }, scatter: { o: 3 } },
    things: [{ t: 'sign', x: 13, y: 3, text: 'This unique beast attacks by launching spiked projectiles in your direction, so your dexterity, not your armour, is what keeps you alive.' }],
    boss: { slug: 'kraken', cx: 5, cy: 6 },
  },

  // ------------------------------------------------------------ Dark Forest
  501: {
    name: 'Stone Path Bridge', sub: 'Highwaymen', ...dark, at: [5, -1],
    gen: { open: { S: NS, N: NS }, paths: [ROAD_V], stamps: [[1, 5, '~~~~~~==~~~~~~'], [1, 6, '~~~~~~==~~~~~~']], scatter: { T: 14 } },
    things: [{ t: 'sign', x: 5, y: 3, text: 'A chilly stream flows west to east below your feet.' }],
    spawns: [['bowman', 1], ['highwayman', 1]],
  },
  502: {
    name: 'Dark Forest Outpost', sub: 'Ranger Guard', ...dark, at: [5, -2], safe: true,
    gen: { open: { S: NS, N: NS, W: WE }, paths: [ROAD_V, [0, 5, 9, 2]], scatter: { T: 14 } },
    things: [
      { t: 'npc', x: 10, y: 4, who: 'ranger_guard' },
      { t: 'rest', x: 10, y: 8, sprite: 'fire', text: `DRAFT|You rest at the outpost. ${FULL}` },
    ],
    gates: [{ edge: 'N', need: { quest: 'ranger_001' }, msg: 'You cannot enter the Dark Forest from here until you defeat a Highwayman and a Bowman.' }],
  },
  504: {
    name: 'Highway Toll', sub: 'Pay up', ...dark, at: [4, -2],
    gen: { open: { E: WE, W: WE }, paths: [ROAD_H], scatter: { T: 16 } },
    things: [{ t: 'toll', x: 10, y: 3, sprite: 'sign', price: 300, text: 'A mean looking Highwayman stands guard at the Toll to the Stone Mountain Map.' }],
    boss: { slug: 'toll-highwayman', cx: 3, cy: 5 },
    gates: [{
      edge: 'W', need: { any: [{ flag: 'toll' }, { kills: ['toll-highwayman', 1] }] },
      msg: 'DRAFT|The Highwayman blocks the mountain road. Pay the toll (300 gold) or fight him to pass.',
    }],
  },
  507: {
    name: 'Dark Forest Teleport', sub: 'Dark Elf', ...dark, at: [5, -3], safe: true, hub: true,
    gen: { open: { S: NS, E: WE }, paths: [[7, 5, 2, 7], [7, 5, 9, 2]], scatter: { T: 18 } },
    things: [
      { t: 'hub', x: 4, y: 4, sprite: 'hubPillar' },
      { t: 'npc', x: 10, y: 3, who: 'dark_elf' },
      { t: 'rest', x: 12, y: 3, sprite: 'tea', text: `DRAFT|You drink the tea. Man this tea is good. ${FULL}` },
    ],
  },
  520: {
    name: 'Dark Grove', sub: 'Trolls', ...dark, at: [6, -3],
    gen: { open: { W: WE, N: NS }, paths: [[0, 5, 9, 2], [7, 0, 2, 7]], scatter: { T: 14 } },
    spawns: [['troll-elder', 1], ['troll-shaman', 2], ['highwayman', 1]],
  },
  523: {
    name: 'Troll King', sub: 'The King of the Dark Forest', ...dark, at: [6, -4],
    gen: { open: { S: NS }, scatter: { T: 8, o: 3 } },
    things: [{ t: 'sign', x: 4, y: 9, text: "The King doesn't have particularly high health or impressive stats but attacks with such vicious blows you can be torn to shreds in seconds if you're not careful." }],
    boss: { slug: 'troll-king', cx: 7, cy: 4 },
  },

  // -------------------------------------------------------------- Mountains
  601: {
    name: 'Mountain Path', sub: 'Ice Trolls', ...peak, at: [3, -2],
    gen: { ...CAVE, open: { E: WE, W: WE }, paths: [ROAD_H], scatter: { T: 8, o: 6, '#': 5 } },
    things: [{ t: 'sign', x: 5, y: 3, text: 'The most generic mountain path you can think of.' }],
    spawns: [['ice-troll', 2]],
  },
  605: {
    name: 'Stone Mountain', sub: 'Base Camp', ...peak, at: [2, -2], safe: true, hub: true,
    gen: { ...CAVE, open: { E: WE, W: WE, N: NS }, paths: [ROAD_H, [7, 0, 2, 6]], scatter: { T: 6, o: 4 } },
    things: [
      { t: 'hub', x: 10, y: 3, sprite: 'hubPillar' },
      { t: 'rest', x: 4, y: 3, sprite: 'fire', text: `DRAFT|You rest at Base Camp. ${FULL}` },
      { t: 'sign', x: 11, y: 8, text: '"Like, one day, we\'ll totally make it to the peak!"' },
    ],
  },
  614: {
    name: 'High Pass', sub: "Now we're talking.", ...peak, at: [2, -3],
    gen: { ...CAVE, open: { S: NS, N: NS }, paths: [ROAD_V], scatter: { o: 6, '#': 6, T: 4 } },
    spawns: [['mountain-giant', 1], ['wyvern', 1], ['ice-troll', 1]],
  },
  617: {
    name: 'Giant Mountain Giant', sub: 'The King of the Mountains', ...peak, at: [2, -4],
    gen: { ...CAVE, open: { S: NS }, scatter: { o: 5 } },
    boss: { slug: 'giant-mountain-giant', cx: 7, cy: 4 },
  },
  608: {
    name: 'Blue Guard', sub: 'Mountain Outpost', ...peak, at: [1, -2], safe: true,
    gen: { ...CAVE, open: { E: WE, W: WE }, paths: [ROAD_H], scatter: { T: 6, o: 4 } },
    things: [
      { t: 'npc', x: 9, y: 4, who: 'hector' },
      { t: 'rest', x: 5, y: 4, sprite: 'fire', text: `DRAFT|You rest at the outpost. ${FULL}` },
    ],
  },
  610: {
    name: 'Master Trainer', sub: 'Top of the waterfall', ...peak, at: [0, -2], safe: true,
    gen: { ...CAVE, open: { E: WE, W: WE }, paths: [ROAD_H], scatter: { T: 5, o: 4 } },
    things: [
      { t: 'npc', x: 9, y: 4, who: 'master_trainer' },
      { t: 'sign', x: 11, y: 3, text: 'A hooded man is floating off the ground. He is able to impart valuable skills without uttering a single word.' },
      {
        t: 'door', x: 4, y: 8, sprite: 'restStone', ask: 'Jump?', to: '020', cx: 9, cy: 7,
        text: 'DRAFT|The waterfall drops out of the mountains here, all the way down to the Healing Springs.',
      },
    ],
  },
  611: {
    name: 'Star City', sub: 'Blue Gate', ...peak, at: [-1, -2], safe: true,
    gen: { ...CAVE, open: { E: WE, W: WE }, paths: [ROAD_H], scatter: { o: 4 } },
    things: [
      { t: 'decor', x: 1, y: 5, w: 2, h: 2, sprite: 'gate', gone: { quest: 'rigel_001' }, text: 'An elaborate shiny structure, consisting of many moving pieces all clicking and popping in complex synchronization.' },
      { t: 'npc', x: 5, y: 4, who: 'rigel' },
      { t: 'sign', x: 9, y: 3, text: ['DRAFT|THE BLUE GATE. Three keys.', 'DRAFT|GREED. Dropped by the King under the Ocean.', 'DRAFT|WRATH. Dropped by the King of the Dark Forest.', 'DRAFT|PRIDE. Dropped by the King of the Mountains.'] },
    ],
    gates: [{ edge: 'W', need: { quest: 'rigel_001' }, msg: "You can't enter Star City until the Blue Gate is opened. Bring Rigel the Keys of Greed, Wrath and Pride." }],
  },
  701: {
    name: 'Camp Hero', sub: 'A proper camp for a proper hero', sheet: 'field', theme: 'camp', music: 'camp', at: [-2, -2], safe: true, hub: true,
    gen: { open: { E: WE }, paths: [[7, 5, 9, 2]], scatter: { T: 10, ',': 6 } },
    things: [
      { t: 'rest', x: 4, y: 3, w: 2, h: 2, sprite: 'fountain', text: 'You rest at the fountain and feel rejuvenated!' },
      { t: 'npc', x: 9, y: 3, who: 'pax' },
      { t: 'hub', x: 11, y: 8, sprite: 'hubPillar' },
      { t: 'sign', x: 5, y: 8, text: 'Now this is a proper camp for a proper hero. There is a breathtaking view of Star City to the west.' },
    ],
  },
};

export const MORE_ROOMS = Object.fromEntries(Object.entries(DEFS).map(([id, def]) => [id, build(id, def)]));
