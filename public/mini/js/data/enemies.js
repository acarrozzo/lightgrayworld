// Light Gray Mini: enemies. Names, attack types and who flies are Light Gray
// RPG's. Through the Grassy Field the level, HP, ATT and DEF are the main
// game's too. From the Goblin Chief on, the numbers are the Mini's own: the
// real Troll King is level 45 with 800 HP, and this game gets there at 20.
//
// What the Mini adds is how each one moves, since here they are on the map.
//
//   ai: wander | chase | hop | sidle | lunge | flutter | shooter | blink | turret
//   passive: leaves you alone until you hit it
//   flying: a sword can't reach it (ranged, spells, or Wings)
//   swim: lives in water and stays there
//   shoot: { kind, every, n, spread, speed } fires at you; the shot is blocked
//          by DEX if it is ranged, MAG if it is magic
//   look: drawn from the person template instead of a creature grid
//   big: drawn double size
//   drops: [slug, chance] pairs, each rolled on its own
//   first: gear handed over on the first kill, as in the main game

export const ENEMIES = {
  // ------------------------------------------------------- Grassy Field
  rat: {
    name: 'Rat', sprite: 'rat', level: 1, hp: 3, att: 1, def: 1, type: 'melee',
    passive: true, ai: 'wander', speed: 0.4, gold: [0, 1], drops: [['raw-meat', 1]],
  },
  'sand-crab': {
    name: 'Sand Crab', sprite: 'crab', level: 2, hp: 3, att: 2, def: 2, type: 'melee',
    ai: 'sidle', speed: 0.55, gold: [1, 3], drops: [],
  },
  'giant-rat': {
    name: 'Giant Rat', sprite: 'giant_rat', level: 3, hp: 6, att: 3, def: 1, type: 'melee',
    ai: 'chase', speed: 0.6, gold: [1, 3], drops: [['raw-meat', 1]],
  },
  spider: {
    name: 'Spider', sprite: 'spider', level: 2, hp: 5, att: 3, def: 1, type: 'melee',
    ai: 'hop', speed: 0.5, gold: [1, 4], drops: [['scorpion-tail', 1]],
  },
  scorpion: {
    name: 'Scorpion', sprite: 'scorpion', level: 3, hp: 8, att: 5, def: 2, type: 'melee',
    ai: 'chase', speed: 0.5, gold: [2, 5], drops: [['scorpion-tail', 1]],
  },
  'giant-spider': {
    name: 'Giant Spider', sprite: 'giant_spider', level: 4, hp: 10, att: 6, def: 3, type: 'melee',
    ai: 'hop', speed: 0.55, gold: [3, 6], drops: [['scorpion-tail', 1]],
  },
  'alpha-scorpion': {
    name: 'Alpha Scorpion', sprite: 'alpha_scorpion', level: 5, hp: 20, att: 8, def: 5, type: 'melee',
    ai: 'chase', speed: 0.55, gold: [5, 10], drops: [['scorpion-tail', 1]], first: 'long-sword',
  },
  gator: {
    name: 'Gator', sprite: 'gator', level: 5, hp: 100, att: 8, def: 0, type: 'melee',
    boss: true, special: 'bite', ai: 'lunge', speed: 0.35, gold: [10, 30],
    drops: [['raw-meat', 1], ['raw-meat', 1], ['red-potion', 1], ['blue-potion', 1]],
    first: 'training-armor', restMinutes: 5,
  },
  bat: {
    name: 'Bat', sprite: 'bat', level: 2, hp: 3, att: 2, def: 2, type: 'melee',
    flying: true, ai: 'flutter', speed: 0.75, gold: [0, 2], drops: [['bat-wing', 1]],
  },
  salamander: {
    name: 'Salamander', sprite: 'salamander', level: 6, hp: 18, att: 10, def: 4, type: 'magic',
    ai: 'shooter', speed: 0.4, shoot: { kind: 'orb', every: 120, speed: 1.5 }, gold: [4, 9], drops: [],
  },
  goblin: {
    name: 'Goblin', look: 'goblin', level: 5, hp: 14, att: 8, def: 4, type: 'melee',
    ai: 'chase', speed: 0.6, gold: [4, 9], drops: [],
  },
  'goblin-chief': {
    name: 'Goblin Chief', look: 'goblin_chief', big: true, level: 10, hp: 110, att: 14, def: 3, type: 'melee',
    boss: true, special: 'power', ai: 'lunge', speed: 0.5, gold: [60, 120],
    drops: [['goblin-cloak', 1], ['red-potion', 1]], first: 'long-bow', restMinutes: 5,
  },

  // -------------------------------------------------------------- Forest
  snake: {
    name: 'Snake', sprite: 'snake', level: 5, hp: 14, att: 12, def: 3, type: 'melee',
    ai: 'hop', speed: 0.45, gold: [3, 8], drops: [],
  },
  wolf: {
    name: 'Wolf', sprite: 'wolf', level: 6, hp: 26, att: 12, def: 4, type: 'melee',
    ai: 'chase', speed: 0.85, gold: [4, 10], drops: [['raw-meat', 0.5]],
  },
  bear: {
    name: 'Bear', sprite: 'bear', level: 8, hp: 40, att: 20, def: 5, type: 'melee',
    ai: 'lunge', speed: 0.45, gold: [8, 16], drops: [['raw-meat', 1]],
  },
  ogre: {
    name: 'Ogre', look: 'ogre', big: true, level: 8, hp: 40, att: 18, def: 5, type: 'melee',
    ai: 'lunge', speed: 0.4, gold: [10, 20], drops: [],
  },
  'ogre-lieutenant': {
    name: 'Ogre Lieutenant', look: 'ogre_lieutenant', big: true, level: 13, hp: 240, att: 30, def: 8, type: 'melee',
    boss: true, special: 'power', ai: 'lunge', speed: 0.5, gold: [150, 250],
    drops: [['red-potion', 1], ['red-potion', 1]], restMinutes: 10,
  },
  kobold: {
    name: 'Kobold', look: 'kobold', level: 7, hp: 24, att: 14, def: 5, type: 'melee',
    ai: 'chase', speed: 0.7, gold: [6, 12], drops: [],
  },
  'kobold-warlock': {
    name: 'Kobold Warlock', look: 'kobold_warlock', level: 9, hp: 22, att: 16, def: 4, type: 'magic',
    ai: 'shooter', speed: 0.45, shoot: { kind: 'orb', every: 100, speed: 1.7 }, gold: [8, 16], drops: [['blue-potion', 0.25]],
  },
  'kobold-master': {
    name: 'Kobold Master', look: 'kobold_master', big: true, level: 13, hp: 150, att: 26, def: 6, type: 'magic',
    boss: true, ai: 'blink', speed: 0.3, shoot: { kind: 'orb', every: 70, n: 3, spread: 0.45, speed: 1.9 },
    gold: [150, 250], drops: [['blue-potion', 1], ['blue-potion', 1]], restMinutes: 10,
  },

  // ---------------------------------------------------------- Blue Ocean
  jellyfish: {
    name: 'Jellyfish', sprite: 'jellyfish', level: 10, hp: 30, att: 22, def: 6, type: 'melee',
    swim: true, ai: 'wander', speed: 0.3, gold: [8, 16], drops: [],
  },
  piranha: {
    name: 'Piranha', sprite: 'fish', level: 11, hp: 22, att: 24, def: 5, type: 'melee',
    swim: true, ai: 'chase', speed: 0.9, gold: [8, 16], drops: [],
  },
  squid: {
    name: 'Squid', sprite: 'squid', level: 13, hp: 45, att: 26, def: 8, type: 'ranged',
    swim: true, ai: 'shooter', speed: 0.4, shoot: { kind: 'spike', every: 110, speed: 1.8 }, gold: [12, 24], drops: [],
  },
  'great-white': {
    name: 'Great White', sprite: 'shark', level: 16, hp: 90, att: 40, def: 10, type: 'melee',
    ai: 'lunge', speed: 0.5, gold: [20, 40], drops: [['raw-meat', 1]],
  },
  kraken: {
    name: 'Kraken', sprite: 'kraken', big: true, level: 18, hp: 420, att: 34, def: 10, type: 'ranged',
    boss: true, ai: 'turret', speed: 0, shoot: { kind: 'spike', every: 80, n: 5, spread: 0.5, speed: 1.9 },
    gold: [300, 400], drops: [['purple-potion', 1]], first: 'steel-bow', restMinutes: 15,
  },

  // --------------------------------------------------------- Dark Forest
  bowman: {
    name: 'Bowman', look: 'bowman', level: 15, hp: 50, att: 40, def: 8, type: 'ranged',
    ai: 'shooter', speed: 0.5, shoot: { kind: 'spike', every: 95, speed: 2.2 }, gold: [15, 30], drops: [],
  },
  highwayman: {
    name: 'Highwayman', look: 'highwayman', level: 16, hp: 80, att: 45, def: 10, type: 'melee',
    special: 'power', ai: 'chase', speed: 0.75, gold: [30, 60], drops: [],
  },
  'toll-highwayman': {
    name: 'Highwayman', look: 'highwayman', big: true, level: 17, hp: 220, att: 50, def: 10, type: 'melee',
    boss: true, special: 'power', ai: 'lunge', speed: 0.55, gold: [200, 300], drops: [['red-potion', 1]], restMinutes: 9999,
    calmFlag: 'toll',   // pay him and he stands down
  },
  'troll-shaman': {
    name: 'Troll Shaman', look: 'troll_shaman', level: 16, hp: 55, att: 42, def: 8, type: 'magic',
    ai: 'shooter', speed: 0.4, shoot: { kind: 'orb', every: 100, speed: 1.8 }, gold: [18, 36], drops: [['blue-potion', 0.25]],
  },
  'troll-elder': {
    name: 'Troll Elder', look: 'troll', big: true, level: 18, hp: 110, att: 50, def: 12, type: 'melee',
    special: 'power', ai: 'lunge', speed: 0.45, gold: [25, 50], drops: [],
  },
  'troll-king': {
    name: 'Troll King', look: 'troll_king', big: true, level: 20, hp: 520, att: 60, def: 12, type: 'melee',
    boss: true, special: 'bite', ai: 'lunge', speed: 0.8, gold: [400, 600],
    drops: [['purple-potion', 1]], first: 'steel-sword', restMinutes: 15,
  },

  // ------------------------------------------------------------ Mountains
  'ice-troll': {
    name: 'Ice Troll', look: 'ice_troll', level: 18, hp: 100, att: 55, def: 12, type: 'melee',
    special: 'bite', ai: 'chase', speed: 0.65, gold: [25, 50], drops: [],
  },
  'mountain-giant': {
    name: 'Mountain Giant', look: 'giant', big: true, level: 19, hp: 140, att: 60, def: 14, type: 'melee',
    ai: 'lunge', speed: 0.4, gold: [30, 60], drops: [],
  },
  wyvern: {
    name: 'Wyvern', sprite: 'wyvern', big: true, level: 20, hp: 70, att: 55, def: 10, type: 'melee',
    flying: true, ai: 'flutter', speed: 0.8, gold: [30, 60], drops: [],
  },
  'giant-mountain-giant': {
    name: 'Giant Mountain Giant', look: 'giant_giant', big: true, level: 22, hp: 900, att: 75, def: 12, type: 'melee',
    boss: true, ai: 'lunge', speed: 0.35, shoot: { kind: 'rock', every: 150, n: 3, spread: 0.4, speed: 1.6, type: 'ranged' },
    gold: [500, 800], drops: [['purple-potion', 1], ['purple-potion', 1]], first: 'mithril-sword', restMinutes: 15,
  },
};
