// Maps room IDs to enemies that appear there.
// Static rooms always have their enemy present.
// Probabilistic rooms use spawnChance + weighted enemy selection per player turn.
//
// Room 013: Marsh Behind the Cabin — Gator 50% spawn chance
// Room 016: — 50% spawn, rat 33% / giant rat 33% / sand crab 34%
// Room 018: Rocky Beach — Sand Crab 25% spawn chance
// Room 019: Sand Crab Nest — Sand Crab (always present)
// Room 003b: Cabin Basement — 50% spawn, rat 90% / giant rat 10%
// Room 003bb: Destroyed Basement — 50% spawn, wave of 3 (guaranteed 1 giant rat + 1 rat, 3rd weighted giant rat 90%)
// Room 008: Spider Cave Entrance — 50% spawn, spider 100%
//
// Config fields:
//   probabilistic  — uses spawnChance + weighted pool (vs. static always-present `enemies: [...]`)
//   spawnChance    — 0..1 chance a wave rolls at all
//   maxEnemies     — wave size (default 1)
//   guaranteed     — slugs that always lead the roster, in order
//   priority       — slug that ambushes first on entry/spawn, but ONLY if present AND aggressive;
//                    otherwise a random hostile is chosen (current fallback behavior)
//   enemies        — weighted pool used to fill remaining roster slots
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
    maxEnemies: 3,
    // Every wave always contains at least one giant rat AND one regular rat;
    // the remaining slot is filled from the weighted pool below (usually a giant rat).
    guaranteed: ['giant-rat', 'rat'],
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
  // Thief, but on a 1-in-15 roll. Legacy danger level 3. Room 237 (the Stables)
  // also included thief2 in the original, but declared danger level 0 — the include
  // was blanket paste across that file set, so the Stables stay safe here.
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
}

function getRoomEnemies(roomId) {
  return ROOM_ENEMIES[roomId] || null
}

function isProbabilistic(roomId) {
  return ROOM_ENEMIES[roomId]?.probabilistic === true
}

// The slug designated to attack first in a room, or null. Whether it actually
// gets the first strike is gated on the enemy also being present and aggressive
// (see RoomState.pickHostileTarget).
function getRoomPriorityEnemy(roomId) {
  return ROOM_ENEMIES[roomId]?.priority ?? null
}

// Picks a single enemy slug from a probabilistic room's weighted pool.
// Assumes the caller has already decided a spawn should happen.
function pickWeightedEnemy(config) {
  const totalWeight = config.enemies.reduce((sum, e) => sum + e.weight, 0)
  let roll = Math.random() * totalWeight
  for (const entry of config.enemies) {
    roll -= entry.weight
    if (roll <= 0) return entry.slug
  }
  return config.enemies[config.enemies.length - 1].slug
}

// Returns a slug (string) or null. Rolls spawnChance first, then picks
// an enemy by weight. Safe to call for any room — returns null for static rooms.
function rollRoomEnemy(roomId) {
  const config = ROOM_ENEMIES[roomId]
  if (!config?.probabilistic) return null

  if (Math.random() > config.spawnChance) return null

  return pickWeightedEnemy(config)
}

// Returns an ordered array of enemy slugs for a single spawn "wave", or [].
// Rolls spawnChance once; on success builds a wave of `maxEnemies` enemies (default 1).
// Any `guaranteed` slugs always lead the wave in order; the remaining slots are filled
// with weighted random picks from the pool. Order is the queue order — index 0 is
// fought first.
function rollRoomEnemyGroup(roomId) {
  const config = ROOM_ENEMIES[roomId]
  if (!config?.probabilistic) return []

  if (Math.random() > config.spawnChance) return []

  const count = config.maxEnemies && config.maxEnemies > 0 ? config.maxEnemies : 1
  const group = []

  // Guaranteed lead enemies always appear first, in the order listed.
  if (Array.isArray(config.guaranteed)) {
    for (const slug of config.guaranteed) {
      if (group.length >= count) break
      group.push(slug)
    }
  }

  // Fill the remaining slots with weighted random picks.
  while (group.length < count) {
    group.push(pickWeightedEnemy(config))
  }

  return group
}

// Refills a partial (leftover) roster back toward the room's wave size on RE-ENTRY.
// Given the enemies still present (e.g. a lone passive rat left after the giant rats
// were killed), rolls spawnChance once; on success, tops the roster up to maxEnemies by
// re-adding any missing `guaranteed` enemies first, then filling with weighted picks.
// The existing leftover enemies are always kept. Returns the (possibly unchanged) roster.
//   - Non-probabilistic rooms: returned unchanged.
//   - Already at/over capacity, or spawnChance roll fails: returned unchanged.
function topUpRoomEnemyGroup(roomId, existingRoster) {
  const roster = Array.isArray(existingRoster) ? [...existingRoster] : []
  const config = ROOM_ENEMIES[roomId]
  if (!config?.probabilistic) return roster

  const count = config.maxEnemies && config.maxEnemies > 0 ? config.maxEnemies : 1
  if (roster.length >= count) return roster

  // Only refill some of the time, matching the room's normal spawn cadence.
  if (Math.random() > config.spawnChance) return roster

  // Re-add guaranteed lead enemies that aren't already present, in order.
  if (Array.isArray(config.guaranteed)) {
    for (const slug of config.guaranteed) {
      if (roster.length >= count) break
      if (!roster.includes(slug)) roster.push(slug)
    }
  }

  // Fill any remaining slots from the weighted pool.
  while (roster.length < count) {
    roster.push(pickWeightedEnemy(config))
  }

  return roster
}

module.exports = { ROOM_ENEMIES, getRoomEnemies, isProbabilistic, getRoomPriorityEnemy, rollRoomEnemy, rollRoomEnemyGroup, topUpRoomEnemyGroup }
