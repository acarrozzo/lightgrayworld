// Maps room IDs to enemies that appear there.
// Static rooms always have their enemy present.
// Probabilistic rooms use spawnChance + weighted enemy selection per player turn.
//
// Room 013: Marsh Behind the Cabin — Gator 50% spawn chance
// Room 016: — 50% spawn, rat 33% / giant rat 33% / sand crab 34%
// Room 018: Rocky Beach — Sand Crab 25% spawn chance
// Room 019: Sand Crab Nest — Sand Crab (always present)
// Room 003b: Cabin Basement — 50% spawn, rat 90% / giant rat 10%
// Room 003bb: Destroyed Basement — 50% spawn, giant rat 90% / rat 10%
// Room 008: Spider Cave Entrance — 50% spawn, spider 100%
//
// One enemy at a time, as in the original: a room holds at most one present
// enemy per player. A probabilistic room rolls for that one enemy; a static room
// always has its one enemy standing there.
//
// Config fields:
//   probabilistic  — uses spawnChance + weighted pool (vs. static always-present `enemies: [slug]`)
//   spawnChance    — 0..1 chance an enemy appears on a turn action when none is present
//   enemies        — weighted pool the one enemy is picked from
//   challenge      — optional gate a static enemy hides behind (see battle-action-handlers)
//
// A pool entry is `{ slug, weight }`, or a **ladder**: `{ weight, ladder: [...] }`
// whose rungs are `{ killed?: string[], anyKilled?: string[], notKilled?: string[],
// enemies: [{ slug, weight }] }`, read top to bottom against the player's kill
// list — the first rung whose conditions hold is the pool that slot rolls from
// (an empty `enemies` means the slot yields nothing). It is the original's
// "boss slot": the Mountains' 1-in-50 that gave a Flying Dung Beetle until you
// had killed the Giant Mountain Giant or the Gatekeeper, then Jikay or Jiemji,
// then King Blade. `rollRoomEnemy(roomId, { kills })` takes the kill set; with
// none, only a rung with no conditions can match.
// Room 009: Spider Cave #009 — 60% spawn, spider 50% / scorpion 50%
// Room 010: Spider Cave #010 — Giant Spider 60% spawn chance
// Room 011: Spider Cave #011 — 60% spawn, scorpion 70% / spider 30%
// Room 012: Scorpion Pit — Alpha Scorpion 70% spawn chance
// Room 012b: Scorpion Pit (alt) — Alpha Scorpion 70% spawn chance
// Room 012c: Scorpion Pit (deep) — 60% spawn, alpha-scorpion 80% / scorpion-guard 20%
// Room 012d: Narrow Passage — Giant Rat 60% spawn chance
// Room 012e: Scorpion — Scorpion Guard 60% spawn chance
// Room 012f: Wide Antechamber — Mammoth Scorpion 60% spawn chance
// Room 012g: Scorpion Queen Chamber — Scorpion Queen 60% spawn chance
// Room 012h: Scorpion King Throne — Scorpion King 60% spawn chance
// Room 028b: Bat Cave EXIT — 50% spawn, bat 100%
// Room 028c: Abandoned Workshop — 50% spawn, bat 100%
// Room 028d: Bat Cave — 50% spawn, bat 90% / golden-bat 10%
// Room 028e: Bat Nest — 100% spawn, bat 90% / golden-bat 10%
// Room 028f: Salamander Cavern — 50% spawn, salamander 90% / golden-bat 10%
// Room 028g: Goblin Tracks — 50% spawn, goblin 80% / goblin-bandit 20%
// Room 028h: Goblin Dead End — 50% spawn, goblin-bandit 80% / goblin 20%
// Room 028i: Goblin Hideout — 100% spawn, goblin-chief 100%
/**
 * The Mountains' ordinary set, in units of 1/1050 (see the MOUNTAINS block):
 * seven slots of 70. Two of the slots are sub-rolls of seven.
 */
const MOUNTAIN_SET = [
  // The road's rarities, one slot shared seven ways.
  { slug: 'bowman', weight: 10 },
  { slug: 'highwayman', weight: 10 },
  { slug: 'imp', weight: 10 },
  { slug: 'wisp', weight: 10 },
  { slug: 'falcon', weight: 10 },
  { slug: 'dark-ranger', weight: 10 },
  { slug: 'ent', weight: 10 },
  { slug: 'mountain-giant', weight: 70 },
  { slug: 'ice-troll', weight: 70 },
  { slug: 'giant-brute', weight: 70 },
  { slug: 'wyvern', weight: 70 },
  { slug: 'stone-dwarf', weight: 70 },
  // The snow rarities, one slot shared seven ways — the Yeti three of them.
  { slug: 'yeti', weight: 30 },
  { slug: 'snow-ogre', weight: 10 },
  { slug: 'snow-ninja', weight: 10 },
  { slug: 'snow-owl', weight: 10 },
  { slug: 'dragon', weight: 10 },
]

/** The same set at a fraction of its weight, for rooms that roll something rarer first. */
const MOUNTAIN_SET_SCALED = (factor) => MOUNTAIN_SET.map((entry) => ({ ...entry, weight: entry.weight * factor }))

/**
 * The Mountains' boss slot, exactly the original's chain of ifs: once every
 * king is dead the three share it; with both lieutenants dead King Blade takes
 * three fifths of it; a dead Jikay summons Jiemji and vice versa; the first
 * fall of the Giant Mountain Giant or the Gatekeeper opens it to both; and
 * until then it is a Flying Dung Beetle, which is the original's joke.
 */
const MOUNTAIN_BOSS_SLOT = (weight) => ({
  weight,
  ladder: [
    { killed: ['jikay', 'jiemji', 'king-blade'], enemies: [{ slug: 'jikay', weight: 1 }, { slug: 'jiemji', weight: 1 }, { slug: 'king-blade', weight: 1 }] },
    { killed: ['jikay', 'jiemji'], enemies: [{ slug: 'jikay', weight: 1 }, { slug: 'jiemji', weight: 1 }, { slug: 'king-blade', weight: 3 }] },
    { killed: ['jikay'], enemies: [{ slug: 'jiemji', weight: 1 }] },
    { killed: ['jiemji'], enemies: [{ slug: 'jikay', weight: 1 }] },
    { anyKilled: ['giant-mountain-giant', 'gatekeeper'], enemies: [{ slug: 'jikay', weight: 1 }, { slug: 'jiemji', weight: 1 }] },
    { enemies: [{ slug: 'flying-dung-beetle', weight: 1 }] },
  ],
})

/**
 * The Cathedral's two 1-in-50 slots (the Nave and the Altar), as the original
 * wrote them: the first hands out a Rat until one of the mountain's guardians
 * is down, then whichever lieutenant that guardian unlocks, then King Blade
 * once both guardians are dead — and nothing at all once he is; the second is
 * a Giant Rat "for funsies" until the Gatekeeper falls, after which it is Jikay.
 */
const CATHEDRAL_BOSS_SLOTS = [
  {
    weight: 21,
    ladder: [
      { killed: ['giant-mountain-giant', 'gatekeeper'], notKilled: ['king-blade'], enemies: [{ slug: 'king-blade', weight: 1 }] },
      { killed: ['giant-mountain-giant', 'gatekeeper'], enemies: [] },
      { killed: ['giant-mountain-giant'], enemies: [{ slug: 'jikay', weight: 1 }] },
      { killed: ['gatekeeper'], enemies: [{ slug: 'jiemji', weight: 1 }] },
      { enemies: [{ slug: 'rat', weight: 1 }] },
    ],
  },
  {
    weight: 21,
    ladder: [
      { killed: ['gatekeeper'], enemies: [{ slug: 'jikay', weight: 1 }] },
      { enemies: [{ slug: 'giant-rat', weight: 1 }] },
    ],
  },
]

const ROOM_ENEMIES = {
  '013': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'gator', weight: 100 },
    ],
  },
  '016': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 25 },
      { slug: 'giant-rat', weight: 25 },
      { slug: 'sand-crab', weight: 50 },
    ],
  },
  '018': {
    probabilistic: true,
    spawnChance: 0.25,
    enemies: [
      { slug: 'sand-crab', weight: 100 },
    ],
  },
  '019': { enemies: ['sand-crab'] }, // always present
  '003b': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 90 },
      { slug: 'giant-rat', weight: 10 },
    ],
  },
  '003bb': {
    probabilistic: true,
    spawnChance: 0.5,
    // The mirror of the basement next door: mostly giant rats down here.
    enemies: [
      { slug: 'rat', weight: 10 },
      { slug: 'giant-rat', weight: 90 },
    ],
  },
  '008': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'spider', weight: 100 },
    ],
  },
  '009': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'spider', weight: 50 },
      { slug: 'scorpion', weight: 50 },
    ],
  },
  '010': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'giant-spider', weight: 70 },
      { slug: 'scorpion', weight: 30 },
    ],
  },
  '011': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'scorpion', weight: 70 },
      { slug: 'spider', weight: 30 },
    ],
  },
  '012': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'giant-spider', weight: 50 },
      { slug: 'alpha-scorpion', weight: 50 },
    ],
  },
  '012b': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'alpha-scorpion', weight: 100 },
    ],
  },
  '012c': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'alpha-scorpion', weight: 80 },
      { slug: 'scorpion-guard', weight: 20 },
    ],
  },
  '012d': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'giant-rat', weight: 100 },
    ],
  },
  '012e': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'scorpion-guard', weight: 100 },
    ],
  },
  '012f': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'mammoth-scorpion', weight: 100 },
    ],
  },
  '012g': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'scorpion-queen', weight: 100 },
    ],
  },
  '012h': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'scorpion-king', weight: 100 },
    ],
  },
  '028b': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'bat', weight: 100 },
    ],
  },
  '028c': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'bat', weight: 100 },
    ],
  },
  '028d': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'bat', weight: 90 },
      { slug: 'golden-bat', weight: 10 },
    ],
  },
  '028e': {
    probabilistic: true,
    spawnChance: 1.0,
    enemies: [
      { slug: 'bat', weight: 90 },
      { slug: 'golden-bat', weight: 10 },
    ],
  },
  '028f': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'salamander', weight: 90 },
      { slug: 'golden-bat', weight: 10 },
    ],
  },
  '028g': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'goblin', weight: 80 },
      { slug: 'goblin-bandit', weight: 20 },
    ],
  },
  '028h': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'goblin-bandit', weight: 80 },
      { slug: 'goblin', weight: 20 },
    ],
  },
  '028i': {
    probabilistic: true,
    spawnChance: 1.0,
    enemies: [
      { slug: 'goblin-chief', weight: 100 },
    ],
  },
  // ==================== FOREST PATH ====================
  // Forest-path battle set: 12 enemy types, ~24% spawn chance (12/50 in original)
  // Rooms: 101, 102, 104, 107, 108, 109, 112, 113, 114
  '101': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  '102': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  // Room 103b/103c: Cow Farm — 50% cow spawn
  '103b': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'cow', weight: 100 },
    ],
  },
  '103c': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'cow', weight: 100 },
    ],
  },
  '104': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  '107': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  '108': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  '109': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  '112': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  '113': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  '114': {
    probabilistic: true,
    spawnChance: 0.24,
    enemies: [
      { slug: 'rat', weight: 8 },
      { slug: 'giant-rat', weight: 8 },
      { slug: 'thief', weight: 8 },
      { slug: 'goblin', weight: 8 },
      { slug: 'goblin-bandit', weight: 8 },
      { slug: 'imp', weight: 8 },
      { slug: 'hob-goblin', weight: 8 },
      { slug: 'orc', weight: 8 },
      { slug: 'ogre', weight: 8 },
      { slug: 'kobold', weight: 8 },
      { slug: 'skeleton', weight: 8 },
      { slug: 'snake', weight: 8 },
    ],
  },
  // ==================== FOREST (main) ====================
  // Forest battle set: ~27% spawn chance (8/30 in original)
  // Wolf, Coyote, Buck, Bear, Stag, Wild Boar common; Bigfoot, Hawk rare; Snake, Imp very rare
  '116': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '117': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '119': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '120': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '121': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '122': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '123': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '124': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '125': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '126': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '127': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '129': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '130': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '131': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '132': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '133': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '134': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '135': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  '136': {
    probabilistic: true,
    spawnChance: 0.27,
    enemies: [
      { slug: 'wolf', weight: 12 },
      { slug: 'coyote', weight: 12 },
      { slug: 'buck', weight: 12 },
      { slug: 'bear', weight: 12 },
      { slug: 'stag', weight: 12 },
      { slug: 'wild-boar', weight: 12 },
      { slug: 'bigfoot', weight: 8 },
      { slug: 'hawk', weight: 8 },
      { slug: 'snake', weight: 4 },
      { slug: 'imp', weight: 4 },
    ],
  },
  // Room 137: Troll Base Camp — 70% Troll spawn
  '137': {
    probabilistic: true,
    spawnChance: 0.7,
    enemies: [
      { slug: 'troll', weight: 100 },
    ],
  },
  // ==================== OGRE LAIR (Forest Underground) ====================
  // Room 111a: Ogre Cave Exit — Goblin, Hob Goblin, Giant Rat, Spider; rare Ogre Priest
  '111a': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'goblin', weight: 24 },
      { slug: 'hob-goblin', weight: 24 },
      { slug: 'giant-rat', weight: 24 },
      { slug: 'spider', weight: 24 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111b: Goblin Tent — Goblin dominant, Hob Goblin, Alpha Scorpion; rare Ogre Priest
  '111b': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'goblin', weight: 50 },
      { slug: 'hob-goblin', weight: 20 },
      { slug: 'alpha-scorpion', weight: 20 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111c: Rat's Nest — Giant Rat dominant, Spider; rare Ogre Priest
  '111c': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'giant-rat', weight: 70 },
      { slug: 'spider', weight: 20 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111d: Hob Goblin Hut — Hob Goblin dominant, Goblin; rare Ogre Priest
  '111d': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'hob-goblin', weight: 60 },
      { slug: 'goblin', weight: 20 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111e: Ogre Path — Ogre dominant, Hob Goblin, Orc; rare Ogre Priest
  '111e': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'ogre', weight: 50 },
      { slug: 'hob-goblin', weight: 20 },
      { slug: 'orc', weight: 20 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111f: Orc Den — Orc dominant; rare Ogre Priest
  '111f': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'orc', weight: 80 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111g: Ogre Yard — Ogre dominant, Orc; rare Ogre Priest
  '111g': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'ogre', weight: 50 },
      { slug: 'orc', weight: 20 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111h: Ogre Treasure Room — Ogre, Ogre Guard; rare Ogre Priest (higher rate)
  '111h': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'ogre', weight: 30 },
      { slug: 'ogre-guard', weight: 40 },
      { slug: 'ogre-priest', weight: 10 },
    ],
  },
  // Room 111i: Ogre Guard Room — Ogre Guard dominant, Ogre; rare Ogre Priest
  '111i': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'ogre-guard', weight: 60 },
      { slug: 'ogre', weight: 20 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111j: Ogress Fire Altar — Fire Ogress dominant, Ogre Guard; rare Ogre Priest
  '111j': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'fire-ogress', weight: 60 },
      { slug: 'ogre-guard', weight: 20 },
      { slug: 'ogre-priest', weight: 5 },
    ],
  },
  // Room 111k: Ogre Lieutenant Quarters — Boss room, always Ogre Lieutenant
  '111k': {
    probabilistic: true,
    spawnChance: 1.0,
    enemies: [
      { slug: 'ogre-lieutenant', weight: 100 },
    ],
  },
  // ==================== KOBOLD LAIR (Forest Underground) ====================
  // Room 115a: Kobold Lair Exit — mixed low-level; rare Kobold Monk
  '115a': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'kobold', weight: 24 },
      { slug: 'giant-rat', weight: 24 },
      { slug: 'salamander', weight: 24 },
      { slug: 'alpha-scorpion', weight: 24 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115b: Kobold Dead End — Flying Kobold dominant, Bat, Golden Bat; rare Kobold Monk
  '115b': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'flying-kobold', weight: 50 },
      { slug: 'bat', weight: 20 },
      { slug: 'golden-bat', weight: 20 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115c: Kobold Twisted Path — Kobold, Flying Kobold, Kobold Shaman; rare Kobold Monk
  '115c': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'kobold', weight: 50 },
      { slug: 'flying-kobold', weight: 20 },
      { slug: 'kobold-shaman', weight: 20 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115d: Kobold Temple — Kobold Shaman dominant, Imp; rare Kobold Monk (higher rate)
  '115d': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'kobold-shaman', weight: 60 },
      { slug: 'imp', weight: 20 },
      { slug: 'kobold-monk', weight: 8 },
    ],
  },
  // Room 115e: Kobold Bloody Path — Kobold Ninja, Flying Kobold, Kobold Shaman; rare Kobold Monk
  '115e': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'kobold-ninja', weight: 50 },
      { slug: 'flying-kobold', weight: 20 },
      { slug: 'kobold-shaman', weight: 20 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115f: Kobold Hidden Chamber — mixed critters; rare Kobold Monk
  '115f': {
    probabilistic: true,
    spawnChance: 0.3,
    enemies: [
      { slug: 'giant-rat', weight: 30 },
      { slug: 'salamander', weight: 30 },
      { slug: 'alpha-scorpion', weight: 30 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115g: Dark Courtyard — Kobold Ninja dominant, Kobold Warlock; rare Kobold Monk
  '115g': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'kobold-ninja', weight: 60 },
      { slug: 'kobold-warlock', weight: 20 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115h: Control Room — Kobold Warlock dominant, Kobold Ninja, Kobold Shaman; rare Kobold Monk
  '115h': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'kobold-warlock', weight: 50 },
      { slug: 'kobold-ninja', weight: 20 },
      { slug: 'kobold-shaman', weight: 20 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115i: Magic Altar — Kobold Warlock, Kobold Ninja, Kobold Champion; rare Kobold Monk
  '115i': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'kobold-warlock', weight: 50 },
      { slug: 'kobold-ninja', weight: 20 },
      { slug: 'kobold-champion', weight: 20 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115j: Champion Arena — Kobold Champion dominant, Kobold Warlock; rare Kobold Monk
  '115j': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'kobold-champion', weight: 60 },
      { slug: 'kobold-warlock', weight: 20 },
      { slug: 'kobold-monk', weight: 5 },
    ],
  },
  // Room 115k: Kobold Master Chambers — Boss room, always Kobold Master
  '115k': {
    probabilistic: true,
    spawnChance: 1.0,
    enemies: [
      { slug: 'kobold-master', weight: 100 },
    ],
  },
  // ==================== RED TOWN ====================
  // Red Town streets: the legacy `thief.php` set — a lone Thief on a 1-in-50 roll.
  // Rare enough to be flavour rather than a real obstacle, exactly as in the original.
  '201': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '202': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '203': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '204': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '205': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '209': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '211': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '212': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '213': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '216': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '217': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '218': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '219': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '220': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '223': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '224': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '225': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '227': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '228': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '229': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '230': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '235': {
    probabilistic: true,
    spawnChance: 0.02,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  // The back alleys and the shady end of town run `thief2.php` — the same lone
  // Thief, but on a 1-in-15 roll. Legacy danger level 3, which the Stables share:
  // they sit outside the Grand Gate, and a stall full of horses is worth robbing.
  '231': {
    probabilistic: true,
    spawnChance: 0.067,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '232': {
    probabilistic: true,
    spawnChance: 0.067,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '233': {
    probabilistic: true,
    spawnChance: 0.067,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '234': {
    probabilistic: true,
    spawnChance: 0.067,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '236': {
    probabilistic: true,
    spawnChance: 0.067,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  // Room 237 — the Stables, outside the town wall on the Rocky Flats road.
  '237': {
    probabilistic: true,
    spawnChance: 0.067,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  '232mm': {
    probabilistic: true,
    spawnChance: 0.067,
    enemies: [
      { slug: 'thief', weight: 100 },
    ],
  },
  // ==================== RED TOWN SEWERS ====================
  // The legacy `sewers.php` set: rand(1,35) with 17.5 hostile outcomes, so a 50%
  // spawn chance. Weights are the legacy roll bands doubled so the Imp's extra
  // 50/50 coin-flip lands on a whole number (35 total weight = 35 legacy slots).
  '232a': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232b': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232c': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232d': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232e': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232f': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232g': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232h': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232i': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232j': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  // Room 232k had no battle set in the original — an omission, not a safe room; it sits between two sewer rooms at danger 8.
  '232k': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232l': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  '232y': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'rat', weight: 2 },
      { slug: 'giant-rat', weight: 2 },
      { slug: 'thief', weight: 2 },
      { slug: 'spider', weight: 2 },
      { slug: 'snake', weight: 2 },
      { slug: 'goblin', weight: 2 },
      { slug: 'bat', weight: 2 },
      { slug: 'golden-bat', weight: 2 },
      { slug: 'salamander', weight: 2 },
      { slug: 'skeleton', weight: 2 },
      { slug: 'tarantula', weight: 4 },
      { slug: 'sewer-rat', weight: 4 },
      { slug: 'red-gator', weight: 4 },
      { slug: 'flying-dung-beetle', weight: 2 },
      { slug: 'imp', weight: 1 },
    ],
  },
  // ==================== THIEVE'S DEN ====================
  // The Den had no battle set wired up in the original even though its rooms carry
  // danger levels 8/11/14. Filled in from the enemies the room text names: the
  // hangout's card-players, the Brutes who "use this training room quite often",
  // and the Master Thief guarding the treasure.
  '232m': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'thief', weight: 50 },
      { slug: 'thief-pickpocket', weight: 50 },
    ],
  },
  '232n': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'thief-brute', weight: 70 },
      { slug: 'thief-pickpocket', weight: 30 },
    ],
  },
  '232o': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'master-thief', weight: 100 },
    ],
  },
  // ==================== THE CATACOMBS ====================
  // The legacy `catacombs.php` set: rand(1,10) with 6 hostile outcomes (0.6 spawn).
  // Roll 6 splits three ways into Imp / Golden Bat / Skeleton Knight, which is why
  // the Knight carries weight 4 out of 18 rather than 3.
  '232p': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'skeleton', weight: 3 },
      { slug: 'skeleton-archer', weight: 3 },
      { slug: 'skeleton-knight', weight: 4 },
      { slug: 'skeleton-sorcerer', weight: 3 },
      { slug: 'ancient-skeleton', weight: 3 },
      { slug: 'imp', weight: 1 },
      { slug: 'golden-bat', weight: 1 },
    ],
  },
  '232q': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'skeleton', weight: 3 },
      { slug: 'skeleton-archer', weight: 3 },
      { slug: 'skeleton-knight', weight: 4 },
      { slug: 'skeleton-sorcerer', weight: 3 },
      { slug: 'ancient-skeleton', weight: 3 },
      { slug: 'imp', weight: 1 },
      { slug: 'golden-bat', weight: 1 },
    ],
  },
  '232r': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'skeleton', weight: 3 },
      { slug: 'skeleton-archer', weight: 3 },
      { slug: 'skeleton-knight', weight: 4 },
      { slug: 'skeleton-sorcerer', weight: 3 },
      { slug: 'ancient-skeleton', weight: 3 },
      { slug: 'imp', weight: 1 },
      { slug: 'golden-bat', weight: 1 },
    ],
  },
  '232s': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'skeleton', weight: 3 },
      { slug: 'skeleton-archer', weight: 3 },
      { slug: 'skeleton-knight', weight: 4 },
      { slug: 'skeleton-sorcerer', weight: 3 },
      { slug: 'ancient-skeleton', weight: 3 },
      { slug: 'imp', weight: 1 },
      { slug: 'golden-bat', weight: 1 },
    ],
  },
  '232t': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'skeleton', weight: 3 },
      { slug: 'skeleton-archer', weight: 3 },
      { slug: 'skeleton-knight', weight: 4 },
      { slug: 'skeleton-sorcerer', weight: 3 },
      { slug: 'ancient-skeleton', weight: 3 },
      { slug: 'imp', weight: 1 },
      { slug: 'golden-bat', weight: 1 },
    ],
  },
  '232u': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'skeleton', weight: 3 },
      { slug: 'skeleton-archer', weight: 3 },
      { slug: 'skeleton-knight', weight: 4 },
      { slug: 'skeleton-sorcerer', weight: 3 },
      { slug: 'ancient-skeleton', weight: 3 },
      { slug: 'imp', weight: 1 },
      { slug: 'golden-bat', weight: 1 },
    ],
  },
  '232z': {
    probabilistic: true,
    spawnChance: 0.6,
    enemies: [
      { slug: 'skeleton', weight: 3 },
      { slug: 'skeleton-archer', weight: 3 },
      { slug: 'skeleton-knight', weight: 4 },
      { slug: 'skeleton-sorcerer', weight: 3 },
      { slug: 'ancient-skeleton', weight: 3 },
      { slug: 'imp', weight: 1 },
      { slug: 'golden-bat', weight: 1 },
    ],
  },
  // The Sacred Altar and the Sacrificial Chamber are the deep end (legacy danger 17)
  // and each has a named keeper rather than a battle set: room232v.php rolled
  // Victoria the Dead on 4-in-10, room232w.php rolled Omar the Dead the same way.
  // Both are Wizard Morty's quest targets, so they are fixed spawns — no other
  // enemy shares their room, and the roll is the original's 40%.
  '232v': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'victoria-the-dead', weight: 100 },
    ],
  },
  '232w': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'omar-the-dead', weight: 100 },
    ],
  },
  // Room 232x (A Sewer Oasis) is deliberately absent: the original set its danger
  // level to 0 and gave it no battle set — it is the one safe room down here.

  // ==================== ROCKY FLATS ====================
  // The open-road set (legacy battle-sets/rockyflatspath.php): rand(1,50) with
  // sixteen live outcomes, so a 32% chance of meeting something and a very wide
  // spread when you do. Kobolds occupied two of the sixteen slots, which is the
  // only weight above 1. Every stone, mud and grass path on the map runs it —
  // the village, the treasury, the shops, the mine head and the arena do not.
  // Room 301 — the stone path in from Red Town.
  '301': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 302 — the stone path.
  '302': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 304 — the stone path north.
  '304': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 305 — the stone path up to the Grassy Field.
  '305': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 312 — the muddy path west of the Crossroads.
  '312': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 313 — the muddy path.
  '313': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 314 — the muddy path below the Abandoned Mine.
  '314': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 315 — the Abandoned Mine entrance.
  '315': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 316 — the muddy path toward the Swamp.
  '316': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 317 — the Dry Grass Clearing.
  '317': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 318 — the grass path below the Red Fort.
  '318': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 319 — the grass path by the Grotto.
  '319': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },
  // Room 320 — the grass path toward the Savannah.
  '320': {
    probabilistic: true,
    spawnChance: 0.32,
    enemies: [
      { slug: 'thief', weight: 1 },
      { slug: 'red-bandit', weight: 1 },
      { slug: 'goblin', weight: 1 },
      { slug: 'goblin-bandit', weight: 1 },
      { slug: 'snake', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'kobold', weight: 2 },
      { slug: 'golden-bat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'hob-goblin', weight: 1 },
      { slug: 'orc', weight: 1 },
      { slug: 'ogre', weight: 1 },
      { slug: 'flying-kobold', weight: 1 },
      { slug: 'troll', weight: 1 },
    ],
  },

  // ---------- The Abandoned Mine ----------
  // The Dwarf Captain's Gold Key quest lives down here. Its three targets are
  // one room apart and each one owns its room: skeevers on the tracks, dartwings
  // in the nests, the worm in the lair.
  // Abandoned Mine EXIT — legacy rand(1,12) with six live outcomes. The sixth
  // set the enemy to 'Bloody Skeever', which battle-initialize.php never
  // defined and the kill list never tracked; the Rabid Skeever the room's
  // own name points at is used instead.
  '315a': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [
      { slug: 'giant-rat', weight: 1 },
      { slug: 'skeleton', weight: 1 },
      { slug: 'imp', weight: 1 },
      { slug: 'kobold', weight: 1 },
      { slug: 'salamander', weight: 1 },
      { slug: 'rabid-skeever', weight: 1 },
    ],
  },
  // Bloody Skeever Tracks — rand(1,10), 1-6 skeever and 7 dartwing.
  '315b': {
    probabilistic: true,
    spawnChance: 0.7,
    enemies: [
      { slug: 'rabid-skeever', weight: 6 },
      { slug: 'bleeding-dartwing', weight: 1 },
    ],
  },
  // Bleeding Nests — the same roll with the two swapped.
  '315c': {
    probabilistic: true,
    spawnChance: 0.7,
    enemies: [
      { slug: 'bleeding-dartwing', weight: 6 },
      { slug: 'rabid-skeever', weight: 1 },
    ],
  },
  // Lair of the Worm — nothing else lives here.
  '315d': {
    probabilistic: true,
    spawnChance: 0.7,
    enemies: [
      { slug: 'mongolian-death-worm', weight: 100 },
    ],
  },

  // ---------- The Stone Grotto ----------
  // Stone Grotto — the missing dwarf axeman is the Captain's third quest, and
  // this is where he was last seen. 3-in-10 him, 1-in-10 a demon wing.
  '321': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'possessed-axeman', weight: 3 },
      { slug: 'demon-wing', weight: 1 },
    ],
  },
  // Under the Grotto — legacy rand(1,15), 1-4 demon wing and 5 a golden bat.
  '321b': {
    probabilistic: true,
    spawnChance: 0.3333333333333333,
    enemies: [
      { slug: 'demon-wing', weight: 4 },
      { slug: 'golden-bat', weight: 1 },
    ],
  },

  // ---------- The Red Fort ----------
  // Bandits thicken as you go west, then two named rooms at the end: the Butcher
  // in the kitchen and Red Beard in his war room. Both are Mining Guild business.
  // Red Fort Courtyard.
  '322': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'red-bandit', weight: 3 },
      { slug: 'bandit-marauder', weight: 1 },
    ],
  },
  // Red Fort Hallway.
  '323': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'bandit-marauder', weight: 2 },
      { slug: 'red-bandit', weight: 2 },
    ],
  },
  // Red Fort Barracks.
  '324': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'bandit-marauder', weight: 3 },
      { slug: 'red-bandit', weight: 1 },
    ],
  },
  // Red Fort Kitchen — the Butcher, and a 7-in-10 chance he is in.
  '325': {
    probabilistic: true,
    spawnChance: 0.7,
    enemies: [
      { slug: 'butcher', weight: 100 },
    ],
  },
  // Red Beard's War Room. Quest 31 — Mining Guild membership, and with it the
  // Neverending Mine — turns on this one kill.
  '326': {
    probabilistic: true,
    spawnChance: 0.7,
    enemies: [
      { slug: 'red-beard', weight: 100 },
    ],
  },

  // ==================== THE NEVERENDING MINE ====================
  // Three tiers of nine ordinary levels, each running the same shape: a 4-in-10
  // chance of a fight, three common shapes taking one slot each, and a fourth
  // slot that rolls one of five elites. Weights are out of 20 so the elites land
  // at 1/20 apiece, which is the original's rand(1,10) then rand(1,5).
  //
  // Every fifth level is a boss instead, always present, exactly as the original
  // left them after it turned their odds up to 100%. Mine Level 0 is safe.
  // Iron tier, upper (legacy battle-sets/mine01.php) — Mine Levels 1-4.
  '311-01': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'iron-rat', weight: 5 },
      { slug: 'iron-crab', weight: 5 },
      { slug: 'iron-scorpion', weight: 5 },
      { slug: 'slag-beast', weight: 1 },
      { slug: 'iron-gator', weight: 1 },
      { slug: 'iron-golem', weight: 1 },
      { slug: 'iron-cobra', weight: 1 },
      { slug: 'earth-golem', weight: 1 },
    ],
  },
  '311-02': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'iron-rat', weight: 5 },
      { slug: 'iron-crab', weight: 5 },
      { slug: 'iron-scorpion', weight: 5 },
      { slug: 'slag-beast', weight: 1 },
      { slug: 'iron-gator', weight: 1 },
      { slug: 'iron-golem', weight: 1 },
      { slug: 'iron-cobra', weight: 1 },
      { slug: 'earth-golem', weight: 1 },
    ],
  },
  '311-03': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'iron-rat', weight: 5 },
      { slug: 'iron-crab', weight: 5 },
      { slug: 'iron-scorpion', weight: 5 },
      { slug: 'slag-beast', weight: 1 },
      { slug: 'iron-gator', weight: 1 },
      { slug: 'iron-golem', weight: 1 },
      { slug: 'iron-cobra', weight: 1 },
      { slug: 'earth-golem', weight: 1 },
    ],
  },
  '311-04': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'iron-rat', weight: 5 },
      { slug: 'iron-crab', weight: 5 },
      { slug: 'iron-scorpion', weight: 5 },
      { slug: 'slag-beast', weight: 1 },
      { slug: 'iron-gator', weight: 1 },
      { slug: 'iron-golem', weight: 1 },
      { slug: 'iron-cobra', weight: 1 },
      { slug: 'earth-golem', weight: 1 },
    ],
  },
  // Mine Level 5 — the War Turtle. Sub-boss, always present.
  '311-05': {
    enemies: ['war-turtle'],
  },
  // Iron tier, lower (mine06.php) — the same eight, with the elites promoted to
  // the common slots. Mine Levels 6-9.
  '311-06': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'slag-beast', weight: 5 },
      { slug: 'iron-gator', weight: 5 },
      { slug: 'iron-golem', weight: 5 },
      { slug: 'iron-rat', weight: 1 },
      { slug: 'iron-crab', weight: 1 },
      { slug: 'iron-scorpion', weight: 1 },
      { slug: 'iron-cobra', weight: 1 },
      { slug: 'earth-golem', weight: 1 },
    ],
  },
  '311-07': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'slag-beast', weight: 5 },
      { slug: 'iron-gator', weight: 5 },
      { slug: 'iron-golem', weight: 5 },
      { slug: 'iron-rat', weight: 1 },
      { slug: 'iron-crab', weight: 1 },
      { slug: 'iron-scorpion', weight: 1 },
      { slug: 'iron-cobra', weight: 1 },
      { slug: 'earth-golem', weight: 1 },
    ],
  },
  '311-08': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'slag-beast', weight: 5 },
      { slug: 'iron-gator', weight: 5 },
      { slug: 'iron-golem', weight: 5 },
      { slug: 'iron-rat', weight: 1 },
      { slug: 'iron-crab', weight: 1 },
      { slug: 'iron-scorpion', weight: 1 },
      { slug: 'iron-cobra', weight: 1 },
      { slug: 'earth-golem', weight: 1 },
    ],
  },
  '311-09': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'slag-beast', weight: 5 },
      { slug: 'iron-gator', weight: 5 },
      { slug: 'iron-golem', weight: 5 },
      { slug: 'iron-rat', weight: 1 },
      { slug: 'iron-crab', weight: 1 },
      { slug: 'iron-scorpion', weight: 1 },
      { slug: 'iron-cobra', weight: 1 },
      { slug: 'earth-golem', weight: 1 },
    ],
  },
  // Mine Level 10 — the Phoenix. Mining Guild quest 32, and the reason the quest
  // text warns you: it flies, so melee cannot touch it. Bring a bow.
  '311-10': {
    enemies: ['phoenix'],
  },
  // Steel tier, upper (mine11.php) — Mine Levels 11-14. Coal starts at 10.
  '311-11': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'steel-rat', weight: 5 },
      { slug: 'steel-crab', weight: 5 },
      { slug: 'steel-scorpion', weight: 5 },
      { slug: 'black-frog', weight: 1 },
      { slug: 'steel-gator', weight: 1 },
      { slug: 'steel-golem', weight: 1 },
      { slug: 'stone-assassin', weight: 1 },
      { slug: 'gamma-monk', weight: 1 },
    ],
  },
  '311-12': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'steel-rat', weight: 5 },
      { slug: 'steel-crab', weight: 5 },
      { slug: 'steel-scorpion', weight: 5 },
      { slug: 'black-frog', weight: 1 },
      { slug: 'steel-gator', weight: 1 },
      { slug: 'steel-golem', weight: 1 },
      { slug: 'stone-assassin', weight: 1 },
      { slug: 'gamma-monk', weight: 1 },
    ],
  },
  '311-13': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'steel-rat', weight: 5 },
      { slug: 'steel-crab', weight: 5 },
      { slug: 'steel-scorpion', weight: 5 },
      { slug: 'black-frog', weight: 1 },
      { slug: 'steel-gator', weight: 1 },
      { slug: 'steel-golem', weight: 1 },
      { slug: 'stone-assassin', weight: 1 },
      { slug: 'gamma-monk', weight: 1 },
    ],
  },
  '311-14': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'steel-rat', weight: 5 },
      { slug: 'steel-crab', weight: 5 },
      { slug: 'steel-scorpion', weight: 5 },
      { slug: 'black-frog', weight: 1 },
      { slug: 'steel-gator', weight: 1 },
      { slug: 'steel-golem', weight: 1 },
      { slug: 'stone-assassin', weight: 1 },
      { slug: 'gamma-monk', weight: 1 },
    ],
  },
  // Mine Level 15 — the Ulfberht. Sub-boss.
  '311-15': {
    enemies: ['ulfberht'],
  },
  // Steel tier, lower (mine16.php) — Mine Levels 16-19.
  '311-16': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'black-frog', weight: 5 },
      { slug: 'steel-gator', weight: 5 },
      { slug: 'steel-golem', weight: 5 },
      { slug: 'steel-rat', weight: 1 },
      { slug: 'steel-crab', weight: 1 },
      { slug: 'steel-scorpion', weight: 1 },
      { slug: 'stone-assassin', weight: 1 },
      { slug: 'gamma-monk', weight: 1 },
    ],
  },
  '311-17': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'black-frog', weight: 5 },
      { slug: 'steel-gator', weight: 5 },
      { slug: 'steel-golem', weight: 5 },
      { slug: 'steel-rat', weight: 1 },
      { slug: 'steel-crab', weight: 1 },
      { slug: 'steel-scorpion', weight: 1 },
      { slug: 'stone-assassin', weight: 1 },
      { slug: 'gamma-monk', weight: 1 },
    ],
  },
  '311-18': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'black-frog', weight: 5 },
      { slug: 'steel-gator', weight: 5 },
      { slug: 'steel-golem', weight: 5 },
      { slug: 'steel-rat', weight: 1 },
      { slug: 'steel-crab', weight: 1 },
      { slug: 'steel-scorpion', weight: 1 },
      { slug: 'stone-assassin', weight: 1 },
      { slug: 'gamma-monk', weight: 1 },
    ],
  },
  '311-19': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'black-frog', weight: 5 },
      { slug: 'steel-gator', weight: 5 },
      { slug: 'steel-golem', weight: 5 },
      { slug: 'steel-rat', weight: 1 },
      { slug: 'steel-crab', weight: 1 },
      { slug: 'steel-scorpion', weight: 1 },
      { slug: 'stone-assassin', weight: 1 },
      { slug: 'gamma-monk', weight: 1 },
    ],
  },
  // Mine Level 20 — the Cyclops. Mining Guild quest 33. Its attacks are pure:
  // full ATT every hit, and your DEF never enters the sum.
  '311-20': {
    enemies: ['cyclops'],
  },
  // Mithril tier, upper (mine21.php) — Mine Levels 21-24. Mithril starts at 20.
  '311-21': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'mithril-rat', weight: 5 },
      { slug: 'mithril-crab', weight: 5 },
      { slug: 'mithril-scorpion', weight: 5 },
      { slug: 'blue-frog', weight: 1 },
      { slug: 'mithril-gator', weight: 1 },
      { slug: 'mithril-golem', weight: 1 },
      { slug: 'cosmic-mage', weight: 1 },
      { slug: 'carbon-beast', weight: 1 },
    ],
  },
  '311-22': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'mithril-rat', weight: 5 },
      { slug: 'mithril-crab', weight: 5 },
      { slug: 'mithril-scorpion', weight: 5 },
      { slug: 'blue-frog', weight: 1 },
      { slug: 'mithril-gator', weight: 1 },
      { slug: 'mithril-golem', weight: 1 },
      { slug: 'cosmic-mage', weight: 1 },
      { slug: 'carbon-beast', weight: 1 },
    ],
  },
  '311-23': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'mithril-rat', weight: 5 },
      { slug: 'mithril-crab', weight: 5 },
      { slug: 'mithril-scorpion', weight: 5 },
      { slug: 'blue-frog', weight: 1 },
      { slug: 'mithril-gator', weight: 1 },
      { slug: 'mithril-golem', weight: 1 },
      { slug: 'cosmic-mage', weight: 1 },
      { slug: 'carbon-beast', weight: 1 },
    ],
  },
  '311-24': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'mithril-rat', weight: 5 },
      { slug: 'mithril-crab', weight: 5 },
      { slug: 'mithril-scorpion', weight: 5 },
      { slug: 'blue-frog', weight: 1 },
      { slug: 'mithril-gator', weight: 1 },
      { slug: 'mithril-golem', weight: 1 },
      { slug: 'cosmic-mage', weight: 1 },
      { slug: 'carbon-beast', weight: 1 },
    ],
  },
  // Mine Level 25 — the Griffin. Sub-boss, and flying.
  '311-25': {
    enemies: ['griffin'],
  },
  // Mithril tier, lower (mine26.php) — Mine Levels 26-29.
  '311-26': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'blue-frog', weight: 5 },
      { slug: 'mithril-gator', weight: 5 },
      { slug: 'mithril-golem', weight: 5 },
      { slug: 'mithril-rat', weight: 1 },
      { slug: 'mithril-crab', weight: 1 },
      { slug: 'mithril-scorpion', weight: 1 },
      { slug: 'cosmic-mage', weight: 1 },
      { slug: 'carbon-beast', weight: 1 },
    ],
  },
  '311-27': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'blue-frog', weight: 5 },
      { slug: 'mithril-gator', weight: 5 },
      { slug: 'mithril-golem', weight: 5 },
      { slug: 'mithril-rat', weight: 1 },
      { slug: 'mithril-crab', weight: 1 },
      { slug: 'mithril-scorpion', weight: 1 },
      { slug: 'cosmic-mage', weight: 1 },
      { slug: 'carbon-beast', weight: 1 },
    ],
  },
  '311-28': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'blue-frog', weight: 5 },
      { slug: 'mithril-gator', weight: 5 },
      { slug: 'mithril-golem', weight: 5 },
      { slug: 'mithril-rat', weight: 1 },
      { slug: 'mithril-crab', weight: 1 },
      { slug: 'mithril-scorpion', weight: 1 },
      { slug: 'cosmic-mage', weight: 1 },
      { slug: 'carbon-beast', weight: 1 },
    ],
  },
  '311-29': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [
      { slug: 'blue-frog', weight: 5 },
      { slug: 'mithril-gator', weight: 5 },
      { slug: 'mithril-golem', weight: 5 },
      { slug: 'mithril-rat', weight: 1 },
      { slug: 'mithril-crab', weight: 1 },
      { slug: 'mithril-scorpion', weight: 1 },
      { slug: 'cosmic-mage', weight: 1 },
      { slug: 'carbon-beast', weight: 1 },
    ],
  },
  // Mine Level 30 — the Minotaur. Mining Guild quest 34, and the bottom of the mine.
  '311-30': {
    enemies: ['minotaur'],
  },

  // ==================== FOREST (Rocky Flats supporting change) ====================
  // The Hill Ogre. The original put it behind the hill at r100/room110.php on a
  // 3-in-10 roll and it was the only thing in the room; the Rocky Flats Bounty
  // Board's B-Squad quest asks for its head, so the room it lives in gets it.
  '110': {
    probabilistic: true,
    spawnChance: 0.3,
    enemies: [
      { slug: 'hill-ogre', weight: 100 },
    ],
  },

  // ==================== BLUE OCEAN ====================
  // The surface battle set: a 6-in-18 roll for any of six, equal odds.
  // Two rooms sit outside it — the Oasis (413), which is safe, and the storm
  // (410), which rolled the same set. The temples summon their boss on attack.
  ...Object.fromEntries(
    ['401', '402', '403', '404', '406', '407', '408', '410', '411', '414', '415', '416', '417', '419', '420'].map((roomId) => [
      roomId,
      {
        probabilistic: true,
        spawnChance: 1 / 3,
        enemies: [
          { slug: 'jellyfish', weight: 1 },
          { slug: 'electric-eel', weight: 1 },
          { slug: 'piranha', weight: 1 },
          { slug: 'barracuda', weight: 1 },
          { slug: 'squid', weight: 1 },
          { slug: 'albatross', weight: 1 },
        ],
      },
    ])
  ),
  // Mud Island — rand(1,10) <= 2.
  '412': {
    probabilistic: true,
    spawnChance: 0.2,
    enemies: [{ slug: 'mud-crab', weight: 100 }],
  },
  // Riding a Massive Wave — rand(1,10) <= 3, and it is the King Squid.
  '421': {
    probabilistic: true,
    spawnChance: 0.3,
    enemies: [{ slug: 'king-squid', weight: 100 }],
  },
  // In a Tornado of Currents — rand(1,10) <= 2 crocodile.
  '422': {
    probabilistic: true,
    spawnChance: 0.2,
    enemies: [{ slug: 'crocodile', weight: 100 }],
  },
  // Crocodile Island — rand(1,15) == 1.
  '424': {
    probabilistic: true,
    spawnChance: 1 / 15,
    enemies: [{ slug: 'crocodile', weight: 100 }],
  },
  // The four Water Temples: the boss is always there and never starts it.
  '405': { enemies: ['heavy-walrus'] },
  '409': { enemies: ['coral-wizard'] },
  '418': { enemies: ['smooth-ranger'] },
  '423': { enemies: ['thunder-barbarian'] },
  // The Master Temple. The Guardian stands watch from the moment you arrive,
  // but will not be challenged until its four tests — the temple bosses — are
  // complete. `challenge` is data only; executeStartBattle checks it before
  // any fight with a static enemy here begins.
  '425': {
    enemies: ['water-temple-guardian'],
    challenge: {
      requiresCompletedQuests: [
        'quest_watertempleguardian_001',
        'quest_watertempleguardian_002',
        'quest_watertempleguardian_003',
        'quest_watertempleguardian_004',
      ],
      message:
        "You can't challenge the Water Temple Guardian yet. Complete its four tests first by defeating the Red, Green, Blue and Yellow temple bosses.",
    },
  },

  // ==================== UNDER THE OCEAN ====================
  // The underwater battle set: a 7-in-21 roll, weighted the way the original
  // nested it — two slots each for the turtle and the colossal squid, one each
  // for barracuda and squid, and a 1-in-9 sub-roll on the last slot that
  // usually gave a Glowing Octopus and occasionally a shark, a crocodile or
  // one of the surface fish. Written out as weights times nine.
  ...Object.fromEntries(
    ['480', '481', '482', '483', '484', '485', '486', '487', '488', '493', '494', '497', '498'].map((roomId) => [
      roomId,
      {
        probabilistic: true,
        spawnChance: 1 / 3,
        enemies: [
          { slug: 'giant-sea-turtle', weight: 18 },
          { slug: 'colossal-squid', weight: 18 },
          { slug: 'barracuda', weight: 9 },
          { slug: 'squid', weight: 9 },
          { slug: 'glowing-octopus', weight: 2 },
          { slug: 'great-white', weight: 1 },
          { slug: 'hammerhead', weight: 1 },
          { slug: 'crocodile', weight: 1 },
          { slug: 'jellyfish', weight: 1 },
          { slug: 'electric-eel', weight: 1 },
          { slug: 'piranha', weight: 1 },
        ],
      },
    ])
  ),
  // The Sunken Ship: the same roll with a whole slot given to the Glowing
  // Octopus — "a slightly higher chance of finding the GLOWING OCTOPUS if you
  // search near the SUNKEN SHIP" — and the King Squid on the rare sub-roll.
  '489': {
    probabilistic: true,
    spawnChance: 1 / 3,
    enemies: [
      { slug: 'giant-sea-turtle', weight: 18 },
      { slug: 'colossal-squid', weight: 18 },
      { slug: 'glowing-octopus', weight: 11 },
      { slug: 'squid', weight: 9 },
      { slug: 'king-squid', weight: 1 },
      { slug: 'great-white', weight: 1 },
      { slug: 'hammerhead', weight: 1 },
      { slug: 'crocodile', weight: 1 },
      { slug: 'jellyfish', weight: 1 },
      { slug: 'electric-eel', weight: 1 },
      { slug: 'piranha', weight: 1 },
    ],
  },
  // The Mud Cave under Mud Island — rand(1,10) <= 3 at the exit, <= 4 in the
  // tunnel, and the nest itself never empties.
  '490': {
    probabilistic: true,
    spawnChance: 0.3,
    enemies: [{ slug: 'mud-crab', weight: 100 }],
  },
  '491': {
    probabilistic: true,
    spawnChance: 0.4,
    enemies: [{ slug: 'mud-crab', weight: 100 }],
  },
  '492': { enemies: ['mud-crab'] },
  // Shark water: a hammerhead every time, then a great white every time, then
  // the Kraken, which does not wait to be attacked.
  '495': { enemies: ['hammerhead'] },
  '496': { enemies: ['great-white'] },
  '499': { enemies: ['kraken'] },

  // ==================== DARK FOREST ====================
  // The stone path in from the Forest (501, 503): the original's "Mountain
  // Path" set, a 4-in-8 roll. Half of it is the two highwaymen types the Ranger
  // Guard wants gone; the other half is a 1-in-9 sub-roll across the Forest's
  // usual suspects with a Troll on the end. Written out as weights times nine.
  ...Object.fromEntries(
    ['501', '503'].map((roomId) => [
      roomId,
      {
        probabilistic: true,
        spawnChance: 0.5,
        enemies: [
          { slug: 'bowman', weight: 18 },
          { slug: 'highwayman', weight: 18 },
          { slug: 'imp', weight: 4 },
          { slug: 'snake', weight: 4 },
          { slug: 'salamander', weight: 4 },
          { slug: 'golden-bat', weight: 4 },
          { slug: 'wild-boar', weight: 4 },
          { slug: 'kobold', weight: 4 },
          { slug: 'skeleton', weight: 4 },
          { slug: 'giant-rat', weight: 4 },
          { slug: 'troll', weight: 4 },
        ],
      },
    ])
  ),
  // The Highway Toll. The Highwayman at the gate never jumps you: you fight
  // him to pass, or you pay. A spawn table that never rolls, so he is placed
  // only when the "fight highwayman" button calls him out (room-action-handlers)
  // — a static roster would have him ambush every arrival, which he never did.
  // Beating him here opens the mountain road west for this session, as paying
  // the toll does (see ROOM_GATES['504']).
  '504': {
    probabilistic: true,
    spawnChance: 0,
    enemies: [{ slug: 'highwayman', weight: 100 }],
  },

  // The Dark Forest proper: the original's `dark-forest.php` battle set, a
  // 7-in-20 roll plus a 1-in-200 Wisp. Trolls of every rank fill six of the
  // seven slots (the Elder twice); the seventh is a 1-in-6 sub-roll of the
  // forest's rarities. Weights are times sixty so the Wisp can be a whole number.
  ...Object.fromEntries(
    ['505', '507', '508', '510', '512', '513', '516', '517', '518', '519', '520'].map((roomId) => [
      roomId,
      {
        probabilistic: true,
        spawnChance: 0.355,
        enemies: [
          { slug: 'troll', weight: 60 },
          { slug: 'troll-shaman', weight: 60 },
          { slug: 'troll-sorcerer', weight: 60 },
          { slug: 'troll-elder', weight: 120 },
          { slug: 'troll-champion', weight: 60 },
          { slug: 'bigfoot', weight: 10 },
          { slug: 'imp', weight: 10 },
          { slug: 'bowman', weight: 10 },
          { slug: 'falcon', weight: 10 },
          { slug: 'ent', weight: 10 },
          { slug: 'dark-ranger', weight: 10 },
          { slug: 'wisp', weight: 6 },
        ],
      },
    ])
  ),
  // The Dark Grove: an Ent 1-in-20 before the ordinary set even rolls. The
  // Dark Elf's "Ent Hunter" quest is why the grove is worth standing in.
  '509': {
    probabilistic: true,
    spawnChance: 0.39,
    enemies: [
      { slug: 'ent', weight: 70 },
      { slug: 'troll', weight: 57 },
      { slug: 'troll-shaman', weight: 57 },
      { slug: 'troll-sorcerer', weight: 57 },
      { slug: 'troll-elder', weight: 114 },
      { slug: 'troll-champion', weight: 57 },
      { slug: 'bigfoot', weight: 10 },
      { slug: 'imp', weight: 10 },
      { slug: 'bowman', weight: 10 },
      { slug: 'falcon', weight: 10 },
      { slug: 'dark-ranger', weight: 10 },
      { slug: 'wisp', weight: 6 },
    ],
  },
  // Champion's Camp: "only the strongest trolls make it to the top of the
  // hill". A 5-in-10 roll, four of them the Champion, one a 1-in-3 of the
  // rarities, and the Wisp's 1-in-200 on top.
  '511': {
    probabilistic: true,
    spawnChance: 0.505,
    enemies: [
      { slug: 'troll-champion', weight: 240 },
      { slug: 'falcon', weight: 20 },
      { slug: 'ent', weight: 20 },
      { slug: 'dark-ranger', weight: 20 },
      { slug: 'wisp', weight: 3 },
    ],
  },
  // Lost in the Trees: the original's own table, heavier on Dark Rangers and
  // Bowmen than the rest of the wood, and a 1-in-100 Wisp instead of 1-in-200.
  // (Its rarity sub-roll listed six outcomes on a four-sided die; the Bowman
  // and Dark Ranger it could not reach are the two it rolls separately.)
  '514': {
    probabilistic: true,
    spawnChance: 0.36,
    enemies: [
      { slug: 'bigfoot', weight: 5 },
      { slug: 'imp', weight: 5 },
      { slug: 'ent', weight: 5 },
      { slug: 'falcon', weight: 5 },
      { slug: 'dark-ranger', weight: 20 },
      { slug: 'troll-shaman', weight: 20 },
      { slug: 'troll-sorcerer', weight: 20 },
      { slug: 'troll-elder', weight: 20 },
      { slug: 'bowman', weight: 20 },
      { slug: 'troll-champion', weight: 20 },
      { slug: 'wisp', weight: 4 },
    ],
  },

  // The Troll Nest and the Troll King. Both ambush on a roll (1-in-5, 1-in-2)
  // and both could be called out by attacking in the original; the "challenge"
  // buttons in room-action-handlers cover the second half.
  '521': {
    probabilistic: true,
    spawnChance: 0.2,
    enemies: [{ slug: 'troll-queen', weight: 100 }],
  },
  '523': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [{ slug: 'troll-king', weight: 100 }],
  },
  // The Forest Princess: always here, never starts it. Her "Test of Light" is
  // yours to begin.
  '525': { enemies: ['forest-princess'] },

  // ==================== THE DARK KEEP ====================
  // Ground floor: the original's `dark-keep-1.php`, three of nine.
  ...Object.fromEntries(
    ['516a', '516b', '516c'].map((roomId) => [
      roomId,
      {
        probabilistic: true,
        spawnChance: 1 / 3,
        enemies: [
          { slug: 'lurker', weight: 1 },
          { slug: 'winged-demon', weight: 1 },
          { slug: 'undead-orc', weight: 1 },
        ],
      },
    ])
  ),
  // The Dark Stairwell: the stone guardian 1-in-10 — and, the original's own
  // comment, a Giant Rat 1-in-10 "for funsies".
  '516d': {
    probabilistic: true,
    spawnChance: 0.2,
    enemies: [
      { slug: 'stone-sphinx', weight: 1 },
      { slug: 'giant-rat', weight: 1 },
    ],
  },
  // Second floor: `dark-keep-2.php`, four of ten, the Paladin three times as
  // often as the Priest.
  ...Object.fromEntries(
    ['516e', '516f', '516g'].map((roomId) => [
      roomId,
      {
        probabilistic: true,
        spawnChance: 0.4,
        enemies: [
          { slug: 'warped-priest', weight: 1 },
          { slug: 'dark-paladin', weight: 3 },
        ],
      },
    ])
  ),
  // The Dark Throne: the Prince swoops in 1-in-10 on his own, and every time
  // you reach for the crown (see 'grab crown' in room-action-handlers).
  '516h': {
    probabilistic: true,
    spawnChance: 0.1,
    enemies: [{ slug: 'dark-prince', weight: 100 }],
  },

  // ==================== MOUNTAINS ====================
  // The original's `battle-sets/mountains.php`, a 7-in-15 roll plus a 1-in-50
  // boss slot. Written in units of 1/1050 so every slot is a whole number:
  // each of the seven 1-in-15 slots is 70, the boss slot is 21. The road's
  // rarities (bowman, highwayman, imp, wisp, falcon, dark ranger, ent) share
  // one slot, as do the snow rarities (the Yeti three times, the trio and the
  // Dragon once each). The boss slot is the ladder described at the top of
  // this file — a Flying Dung Beetle until the mountain's kings start falling.
  ...Object.fromEntries(
    ['601', '602', '603', '605', '606', '612', '613', '614', '615', '618'].map((roomId) => [
      roomId,
      {
        probabilistic: true,
        spawnChance: 511 / 1050,
        enemies: [...MOUNTAIN_SET, MOUNTAIN_BOSS_SLOT(21)],
      },
    ])
  ),
  // The Mountain Alcove: "EXTRA RARES FOR ALCOVE!!!!" — two 1-in-4 rolls over
  // the snow trio before the ordinary set even runs, one of them with the
  // Dragon at the end and the other with the Yeti. P(anything) ≈ 0.74.
  '604': {
    probabilistic: true,
    spawnChance: 780.5 / 1050,
    enemies: [
      { slug: 'snow-ogre', weight: 150 },
      { slug: 'snow-ninja', weight: 150 },
      { slug: 'snow-owl', weight: 150 },
      { slug: 'dragon', weight: 37.5 },
      { slug: 'yeti', weight: 37.5 },
      ...MOUNTAIN_SET_SCALED(0.5),
      MOUNTAIN_BOSS_SLOT(10.5),
    ],
  },
  // The Peak: the Giant Mountain Giant one time in two, and nothing else
  // wanders this high.
  '617': {
    probabilistic: true,
    spawnChance: 0.5,
    enemies: [{ slug: 'giant-mountain-giant', weight: 100 }],
  },
  // The Mountain Bridge: the Gatekeeper, always — `rand(1, 1)` in the original.
  '619': { enemies: ['gatekeeper'] },
  // Dragon's Ledge: a Dragon one time in four before the ordinary set.
  '620': {
    probabilistic: true,
    spawnChance: 645.75 / 1050,
    enemies: [{ slug: 'dragon', weight: 262.5 }, ...MOUNTAIN_SET_SCALED(0.75), MOUNTAIN_BOSS_SLOT(15.75)],
  },
  // The Cathedral Courtyard: "most of them are not statues" — a Grey
  // Gargoyle one time in four and a White one time in four, then the set.
  '621': {
    probabilistic: true,
    spawnChance: 780.5 / 1050,
    enemies: [
      { slug: 'grey-gargoyle', weight: 262.5 },
      { slug: 'white-gargoyle', weight: 262.5 },
      ...MOUNTAIN_SET_SCALED(0.5),
      MOUNTAIN_BOSS_SLOT(10.5),
    ],
  },
  // The Nave: vampires five slots in fifteen, the Fallen Priest two, a 1-in-7
  // sub-roll of gargoyles and the snow trio one — and the Cathedral's own two
  // 1-in-50 boss slots (see CATHEDRAL_BOSS_SLOTS).
  '622': {
    probabilistic: true,
    spawnChance: 602 / 1050,
    enemies: [
      { slug: 'vampire', weight: 350 },
      { slug: 'fallen-priest', weight: 140 },
      { slug: 'grey-gargoyle', weight: 20 },
      { slug: 'white-gargoyle', weight: 20 },
      { slug: 'snow-ogre', weight: 10 },
      { slug: 'snow-ninja', weight: 10 },
      { slug: 'snow-owl', weight: 10 },
      ...CATHEDRAL_BOSS_SLOTS,
    ],
  },
  // The Altar: the Fallen Angel seven slots in fifteen, the Priest three.
  '623': {
    probabilistic: true,
    spawnChance: 742 / 1050,
    enemies: [{ slug: 'fallen-angel', weight: 490 }, { slug: 'fallen-priest', weight: 210 }, ...CATHEDRAL_BOSS_SLOTS],
  },
  // The Graveyard: a Risen Skeleton one time in four. Nothing else finds it.
  '616': {
    probabilistic: true,
    spawnChance: 0.25,
    enemies: [{ slug: 'risen-skeleton', weight: 100 }],
  },
  // The Silver Temple: a Silver Titan steps into the arena one time in four,
  // or the moment you challenge one (room-action-handlers).
  '625': {
    probabilistic: true,
    spawnChance: 0.25,
    enemies: [{ slug: 'silver-titan', weight: 100 }],
  },
}

function getRoomEnemies(roomId) {
  return ROOM_ENEMIES[roomId] || null
}

function isProbabilistic(roomId) {
  return ROOM_ENEMIES[roomId]?.probabilistic === true
}

/** Whether a ladder rung's conditions hold against the player's kill set. */
function rungMatches(rung, kills) {
  const has = (slug) => Boolean(kills && kills.has(slug))
  if (rung.killed && !rung.killed.every(has)) return false
  if (rung.anyKilled && !rung.anyKilled.some(has)) return false
  if (rung.notKilled && rung.notKilled.some(has)) return false
  return true
}

/**
 * The pool a ladder slot rolls from for this player: the first rung whose
 * conditions hold. A ladder whose rungs all fail yields nothing, as does a
 * matching rung with an empty pool.
 */
function resolveLadder(ladder, kills) {
  const rung = ladder.find((candidate) => rungMatches(candidate, kills))
  return rung ? rung.enemies : []
}

/** One weighted pick, or null from an empty pool. */
function pickFromPool(pool) {
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0)
  if (totalWeight <= 0) return null
  let roll = Math.random() * totalWeight
  for (const entry of pool) {
    roll -= entry.weight
    if (roll <= 0) return entry.slug
  }
  return pool[pool.length - 1].slug
}

// Picks a single enemy slug from a probabilistic room's weighted pool.
// Assumes the caller has already decided a spawn should happen. A ladder
// entry is resolved against `kills` (the player's kill set) and then rolled
// as its own small pool; a ladder that resolves to nothing spends the slot.
function pickWeightedEnemy(config, kills) {
  const totalWeight = config.enemies.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * totalWeight
  let entry = config.enemies[config.enemies.length - 1]
  for (const candidate of config.enemies) {
    roll -= candidate.weight
    if (roll <= 0) {
      entry = candidate
      break
    }
  }
  if (Array.isArray(entry.ladder)) return pickFromPool(resolveLadder(entry.ladder, kills))
  return entry.slug
}

/**
 * Every slug a room's table can produce, ladders included — for the World
 * Tool and the validator, which want to know what can be met here at all.
 */
function listRoomEnemySlugs(config) {
  const slugs = new Set()
  if (!config) return []
  for (const entry of config.enemies) {
    if (typeof entry === 'string') slugs.add(entry)
    else if (Array.isArray(entry.ladder)) {
      for (const rung of entry.ladder) for (const e of rung.enemies) slugs.add(e.slug)
    } else slugs.add(entry.slug)
  }
  return [...slugs]
}

// Returns a slug (string) or null. Rolls spawnChance first, then picks
// an enemy by weight. Safe to call for any room — returns null for static rooms.
// `context.kills` is the player's kill set (services/kill-list-service); a
// ladder slot reads it, and with none only an unconditional rung can match.
function rollRoomEnemy(roomId, context = {}) {
  const config = ROOM_ENEMIES[roomId]
  if (!config?.probabilistic) return null

  if (Math.random() > config.spawnChance) return null

  return pickWeightedEnemy(config, context.kills)
}

module.exports = { ROOM_ENEMIES, getRoomEnemies, isProbabilistic, rollRoomEnemy, listRoomEnemySlugs, resolveLadder }
