// Light Gray Mini: the rooms. Each one is a single screen, 16 tiles by 12, and
// keeps the id and name of the room it stands for in Light Gray RPG.
//
// Tiles:  . grass   , flowers   " tall grass   : path   _ stone floor   s sand
//         T tree    b bush (cut it)   o rock   # wall   ~ water   f fence
//         u stump   = bridge   v stairs down   ^ stairs up   (space) nothing
//
// `at` places a room on its sheet; rooms side by side on a sheet are joined
// wherever both edges are open. Everything else is a warp.
//
// Conditions (gates, warps): { quest }, { flag }, { sword: true },
// { all: [...] }, { never: true }.
//
// Sign and blocked-gate text is the main game's unless marked DRAFT.

import { MORE_ROOMS } from './rooms2.js';

export const START = { room: '000', cx: 7, cy: 8, dir: 'up' };

export const ROOMS = {
  // ------------------------------------------------------------ Room Zero
  '000': {
    name: 'Room Zero', sub: '000', sheet: 'zero', at: [0, 0], theme: 'zero', music: 'zero', safe: true,
    map: [
      '################',
      '################',
      '##____________##',
      '##____________##',
      '##____________##',
      '##____________##',
      '##____________##',
      '##____________##',
      '##____________##',
      '##____________##',
      '################',
      '################',
    ],
    things: [
      {
        t: 'pillar', x: 7, y: 5, sprite: 'pillar',
        text: 'The bright blue light emanating from the pillar seems to be a button. Press it to teleport to the grassy field.',
        ask: 'Press the button?', to: '001', cx: 7, cy: 7,
      },
      { t: 'sign', x: 9, y: 5, text: 'Welcome to Room Zero, the first room ever made. It is unlike the others. I allow you to access here, for now.' },
      { t: 'read', x: 4, y: 8, sprite: 'paper', text: 'It looks like a map of Room Zero. A gray square with a star in the center.' },
    ],
  },

  // The Plane of Rebirth: where the fallen wake.
  999: {
    name: 'Plane of Rebirth', sub: '999', sheet: 'rebirth', at: [0, 0], theme: 'rebirth', music: 'rebirth', safe: true,
    offMap: true,     // you can't walk here, so finding every room does not ask for it
    map: [
      '                ',
      '                ',
      '    ________    ',
      '   __________   ',
      '   __________   ',
      '   __________   ',
      '   __________   ',
      '   __________   ',
      '   __________   ',
      '    ________    ',
      '                ',
      '                ',
    ],
    things: [
      {
        t: 'pillar', x: 8, y: 4, sprite: 'pillar',
        text: 'DRAFT|A pillar. The light on it is the same blue. It goes back down.',
        ask: 'Go back down?', to: 'hub',
      },
      { t: 'rest', x: 5, y: 6, sprite: 'restStone', text: 'DRAFT|You rest. It mends more than it should.' },
    ],
  },

  // ---------------------------------------------------------- Grassy Field
  '001': {
    name: 'Grassy Field Crossroads', sub: 'This is it. The world is yours.',
    sheet: 'field', at: [1, 1], theme: 'field', music: 'field', safe: true, hub: true,
    map: [
      '.......::.......',
      '.......::.......',
      '....,..::..,....',
      '.......::.......',
      '...,...::.......',
      '::::::::::::::::',
      '::::::::::::::::',
      '.......::...,...',
      '.......::.......',
      '...,...::.......',
      '.......::.......',
      '.......::.......',
    ],
    things: [
      {
        t: 'sign', x: 10, y: 3,
        text: [
          'DRAFT|GRASSY FIELD DIRECTORY',
          'DRAFT|North: blueberries. Past them, the Academy. What is left of it.',
          'DRAFT|South: redberries. West: flowers, then the beach. East: a shop.',
          'DRAFT|The cabin is southwest. Start there.',
        ],
      },
      {
        t: 'chest', x: 10, y: 4, id: 'chest1', gold: true, key: 'gold-key',
        locked: 'The gold chest is locked. You need a Gold Key to open it. You can get one from the Young Soldier.',
        loot: { xp: 50, gold: [100, 200], items: [['red-potion', 3], ['cooked-meat', 5], ['boomerang', 1]] },
      },
      {
        t: 'read', x: 5, y: 3, sprite: 'book', solid: true,
        text: [
          'DRAFT|WELCOME BOOK',
          // {a}, {b} and the rest become the names on whatever you are playing with.
          'DRAFT|{move} {a} swings and talks. {b} throws. {y} casts. {x} eats.',
          'DRAFT|{start} is your bag. {map} is your map. That is all the help you get.',
        ],
      },
      { t: 'hub', x: 4, y: 8, sprite: 'hubPillar' },
    ],
  },

  '002': {
    name: 'Grassy Field South', sub: 'Redberry Patch', sheet: 'field', at: [1, 2], theme: 'field', music: 'field',
    map: [
      '.......::.......',
      '.......::.......',
      '.......::.......',
      '.......::.......',
      '..o....::....o..',
      '.......::.......',
      '...o...::.......',
      '.......::..o....',
      '.......::.......',
      'T.o....::......T',
      'TT.....::...o.TT',
      'TTTTTTT::TTTTTTT',
    ],
    things: [
      { t: 'take', x: 11, y: 3, sprite: 'redberryBush', item: 'redberry', upTo: 5, text: 'DRAFT|You pick redberries.', full: 'DRAFT|You have enough redberries.' },
    ],
    spawns: [['rat', 1]],
    gates: [
      {
        edge: 'S', need: { flag: 'chest1' },
        msg: 'The stone path south is locked. Get the gold key from the Young Soldier and open the gold chest to claim the boomerang.',
      },
    ],
  },

  '003': {
    name: 'Old Man', sub: 'Wood Cabin', sheet: 'field', at: [0, 2], theme: 'field', music: 'field', safe: true,
    map: [
      'TTTT............',
      'TT..............',
      'T...............',
      'T.....v.........',
      'T...............',
      '................',
      '................',
      'T...............',
      'T...............',
      'T..............T',
      'TTT..........TTT',
      'TTTTTTTTTTTTTTTT',
    ],
    things: [
      { t: 'decor', x: 3, y: 2, w: 3, h: 2, sprite: 'cabin', text: 'DRAFT|The cabin is warm and cozy. You are not invited in.' },
      { t: 'npc', x: 5, y: 5, who: 'old_man' },
      { t: 'cook', x: 8, y: 6, sprite: 'fire' },
    ],
    warps: [
      {
        x: 6, y: 3, to: '003b', cx: 3, cy: 4, dir: 'down',
        need: { all: [{ quest: 'oldman_001' }, { sword: true }] },
        msg: "The Old Man warns you the basement is overrun with rats. Help him with his wife's flower first, then he'll let you head down.",
      },
    ],
    gates: [
      {
        edge: 'W', need: { quest: 'oldman_002' },
        msg: "The marsh path is overgrown and treacherous. The Old Man says he'll clear the way once you've dealt with his rat problem.",
      },
    ],
  },

  '004': {
    name: 'Grassy Field West', sub: 'Flower Patch', sheet: 'field', at: [0, 1], theme: 'field', music: 'field',
    map: [
      'TTTT............',
      'TT...,..,.......',
      'T..,.,,.,,.,....',
      'T...,,.,,,.,....',
      'T..,,.,,.,,.....',
      '::::::::::::::::',
      '::::::::::::::::',
      'T...,.,,.,......',
      'T....,..,.......',
      'T...............',
      'TT..............',
      'TTTT............',
    ],
    things: [
      { t: 'take', x: 6, y: 3, sprite: 'flower', item: 'flower', upTo: 1, solid: false, hideWhenHeld: true, text: 'DRAFT|You pick a yellow flower.' },
    ],
    spawns: [['rat', 1]],
    gates: [
      {
        edge: 'W', need: { sword: true },
        msg: 'You know there are aggressive sand crabs down there right?! You need a weapon equipped if you want to go to the beach.',
      },
    ],
  },

  '005': {
    name: 'Grassy Field North', sub: 'Blueberry Patch', sheet: 'field', at: [1, 0], theme: 'field', music: 'field',
    map: [
      'TTTTTTT::TTTTTTT',
      'TTT....::....TTT',
      'T..bb..::..b...T',
      '...bb..::.......',
      '.......::.......',
      '.......::.......',
      '.,.....::.......',
      '.......::...,...',
      '.......::.......',
      '.......::.......',
      '.......::.......',
      '.......::.......',
    ],
    things: [
      { t: 'take', x: 12, y: 4, sprite: 'blueberryBush', item: 'blueberry', upTo: 5, text: 'DRAFT|You pick blueberries.', full: 'DRAFT|You have enough blueberries.' },
    ],
  },

  '006': {
    name: 'Grassy Field East', sub: 'Basic Shop', sheet: 'field', at: [2, 1], theme: 'field', music: 'field', safe: true,
    map: [
      '............TTTT',
      '..............TT',
      '...............T',
      '...............T',
      '...............T',
      '::::::::::::::::',
      '::::::::::::::::',
      '...............T',
      '.....,.........T',
      '...............T',
      '..............TT',
      '............TTTT',
    ],
    things: [
      { t: 'npc', x: 10, y: 2, look: 'shopkeeper', silent: true },
      { t: 'shop', x: 10, y: 3, sprite: 'counter', shop: 'basic' },
    ],
    gates: [
      {
        edge: 'E', need: { flag: 'chest1' },
        msg: "The road east is closed until you've opened the Gold Chest at the Crossroads. Get the Gold Key from the Young Soldier and crack it open first.",
      },
    ],
  },

  '007': {
    name: 'Young Soldier', sub: 'Weapons Training', sheet: 'field', at: [2, 2], theme: 'field', music: 'field', safe: true,
    map: [
      '............TTTT',
      '..............TT',
      '...............T',
      '...............T',
      '...............T',
      '...............T',
      '...............T',
      '.......::......T',
      '......o::o.....T',
      'T.....o:vo.....T',
      'TT....oooo....TT',
      'TTTTTTTTTTTTTTTT',
    ],
    things: [
      { t: 'npc', x: 9, y: 4, who: 'young_soldier' },
      { t: 'take', x: 11, y: 2, sprite: 'swordRack', item: 'training-sword', once: 'rack-sword', text: 'DRAFT|You take a Training Sword. +3 STR.', full: 'DRAFT|One sword each.' },
      { t: 'take', x: 13, y: 2, sprite: 'shieldRack', item: 'training-shield', once: 'rack-shield', text: 'DRAFT|You take a Training Shield. +3 DEF.', full: 'DRAFT|One shield each.' },
      {
        t: 'sign', x: 4, y: 7,
        text: 'Beware the spiders and scorpions that live in the cave to the south. You will need a weapon if you want to survive. If you do not have one, speak to the Young Soldier here.',
      },
    ],
    warps: [
      {
        x: 8, y: 9, to: '008', cx: 5, cy: 3, dir: 'down',
        need: { quest: 'oldman_002' },
        msg: 'Whoa, slow down killer. Help the Old Man with his rat problem before you head into the Spider Cave!',
      },
    ],
  },

  '020': {
    name: 'Healing Springs', sub: 'Mountain Waterfall', sheet: 'field', at: [0, 0], theme: 'field', music: 'field', safe: true,
    map: [
      '#####~~#########',
      '#####~~#########',
      '##.~~~~~~~..TTTT',
      '#..~~~~~~~......',
      'T..~~~~~~~......',
      'T...~~~~~.......',
      'T....,..........',
      'T...........,...',
      'T...............',
      'T..,............',
      'TT..............',
      'TTTT............',
    ],
    things: [
      { t: 'rest', x: 6, y: 6, sprite: 'restStone', text: 'DRAFT|You rest at the waterfall. Everything is full again.' },
      {
        t: 'door', x: 2, y: 2, sprite: 'sign', need: { has: 'wings' }, ask: 'Fly up the waterfall?', to: '610', cx: 5, cy: 8,
        text: 'The water comes down out of the mountains from somewhere very high up; with wings you could follow it.',
        msg: 'You will not be able to go northwest unless you are flying.',
      },
    ],
  },

  '021': {
    name: 'Pajama Shaman', sub: 'Shop & Skills', sheet: 'field', at: [2, 0], theme: 'field', music: 'field', safe: true,
    map: [
      'TTTTTTTTTTTTTTTT',
      'TTT..........TTT',
      'T..............T',
      '...............T',
      '...............T',
      '......,........T',
      '...............T',
      '...........,...T',
      '...............T',
      '...............T',
      '..............TT',
      '............TTTT',
    ],
    things: [
      { t: 'decor', x: 8, y: 2, w: 2, h: 2, sprite: 'tent', text: 'DRAFT|A strange tent. It smells like sleep.' },
      { t: 'npc', x: 10, y: 5, who: 'shaman' },
    ],
  },

  '029': {
    name: 'Guardian Angel', sub: 'Destroyed Academy', sheet: 'field', at: [1, -1], theme: 'field', music: 'field', safe: true,
    map: [
      'TTTTTTTTTTTTTTTT',
      'T.###.####.###.T',
      'T.#__________#.T',
      'T.#__________#.T',
      'T..__________..T',
      'T.#__________#.T',
      'T.#__________#.T',
      'T.###__::__###.T',
      'T......::......T',
      'T..o...::...o..T',
      'TT.....::.....TT',
      'TTTTTTT::TTTTTTT',
    ],
    things: [
      { t: 'decor', x: 8, y: 4, sprite: 'grandPillar', tall: true, text: 'DRAFT|A tall pillar. Five names are carved into it. None of them are yours. Yet.' },
      { t: 'npc', x: 6, y: 4, who: 'guardian_angel' },
    ],
  },

  '017': {
    name: 'On the Beach', sub: 'Rats spotted nearby', sheet: 'field', at: [-1, 1], theme: 'beach', music: 'ocean', sea: true,
    map: [
      'oooooooooooTTTTT',
      '~~~~sssssssssTTT',
      '~~~~~sssosssssTT',
      '~~~~sssssssssssT',
      '~~~~~ssssssssssT',
      '~~~~ssssssss::::',
      '~~~~~sssssss::::',
      '~~~~sssssosssssT',
      '~~~~~ssssssssssT',
      '~~~~ssssssssssTT',
      '~~~~~sosssssssTT',
      'oooooooooooTTTTT',
    ],
    things: [
      {
        t: 'sign', x: 11, y: 3,
        text: 'DRAFT|The Blue Ocean. A boat could put out from here. One built from twenty wood. Or a pair of wings.',
      },
    ],
    spawns: [['sand-crab', 3], ['rat', 1]],
  },

  '013': {
    name: 'Marsh Behind the Cabin', sub: 'Gator Territory', sheet: 'field', at: [-1, 2], theme: 'marsh', music: 'cave',
    map: [
      'TTTTTTTTTTTTTTTT',
      'TT~~~.."....~~TT',
      'T~~~..."".....~T',
      'T~~..".....~~..T',
      'T...."....~~~~.T',
      'T.."......~~~...',
      'T.....".....~...',
      'T.~~....."."...T',
      'T~~~~....."....T',
      'T~~~~~..."...~~T',
      'TT~~~...."..~~TT',
      'TTTTTTTTTTTTTTTT',
    ],
    things: [
      { t: 'sign', x: 14, y: 4, text: 'A gross swampy marsh. You see some gator tracks in the mud.' },
    ],
    boss: { slug: 'gator', cx: 6, cy: 6 },
  },

  // ------------------------------------------------------- under the field
  '003b': {
    name: 'Cabin Basement', sub: 'Underground', sheet: 'basement', at: [0, 0], theme: 'cave', music: 'cave',
    map: [
      '################',
      '################',
      '##.....###....##',
      '##.^...###....##',
      '##............##',
      '##...~~.......##',
      '##..~~~....o..##',
      '##...~........##',
      '##.......~~...##',
      '##..o....~~...##',
      '################',
      '################',
    ],
    warps: [{ x: 3, y: 3, to: '003', cx: 6, cy: 4, dir: 'down' }],
    spawns: [['rat', 2], ['giant-rat', 3]],
  },

  '008': {
    name: 'Spider Cave', sub: 'Exit', sheet: 'spidercave', at: [0, 0], theme: 'spidercave', music: 'cave',
    map: [
      '################',
      '################',
      '##...^....######',
      '##........######',
      '##..........####',
      '###.............',
      '###.............',
      '##....o.....####',
      '##..........####',
      '####....o...####',
      '################',
      '################',
    ],
    warps: [{ x: 5, y: 2, to: '007', cx: 7, cy: 8, dir: 'up' }],
    spawns: [['spider', 3]],
  },

  '010': {
    name: 'Spider Cave', sub: '#010', sheet: 'spidercave', at: [1, 0], theme: 'spidercave', music: 'cave',
    map: [
      '################',
      '################',
      '####......o...##',
      '###...........##',
      '###....##.....##',
      '.......##.....##',
      '..............##',
      '###...........##',
      '###..o......####',
      '####........####',
      '################',
      '################',
    ],
    things: [
      { t: 'chest', x: 12, y: 3, id: 'chest-010', loot: { gold: [40, 60], items: [['red-potion', 1]] } },
    ],
    spawns: [['scorpion', 2], ['giant-spider', 1], ['alpha-scorpion', 1]],
  },
};

Object.assign(ROOMS, MORE_ROOMS);
