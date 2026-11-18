// Light Gray Mini: characters, creatures, objects and effects.
// Grids are rows of palette keys (see gfx.js). Rows may stop early; the rest
// of the row is empty. People share one body template and differ by a color
// map and a few overlay pixels, the way 16-bit games did it.

import { Buf, bake, flipH, rotate, scale2, tint } from './gfx.js';

// ------------------------------------------------------------ the person
// Roles: O outline, H hair/hood, h its shade, F face, f face shade, E eyes,
// T torso, t torso shade, C clasp/belt, A hands, L legs, l boots.

const HUMAN = {
  downA: [
    '',
    '.....OOOOOO',
    '....OHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHHHHHO',
    '...OHhFFFFhHO',
    '...OHFEFFEFHO',
    '...OhFFFFFFhO',
    '....OfFFFFfO',
    '...OOTTCCTTOO',
    '..OATTTTTTTTAO',
    '..OATtTTTTtTAO',
    '...OOtTTTTtOO',
    '....OLLOOLLO',
    '....OllOOllO',
    '.....OO..OO',
  ],
  downB: [
    '',
    '.....OOOOOO',
    '....OHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHHHHHO',
    '...OHhFFFFhHO',
    '...OHFEFFEFHO',
    '...OhFFFFFFhO',
    '....OfFFFFfO',
    '...OOTTCCTTOO',
    '..OATTTTTTTTAO',
    '..OOTtTTTTtTAO',
    '...OOtTTTTtOO',
    '....OLLOOllO',
    '....OllO.OO',
    '.....OO',
  ],
  upA: [
    '',
    '.....OOOOOO',
    '....OHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHHHHHO',
    '...OHhHHHHhHO',
    '...OhhHHHHhhO',
    '....OhhhhhhO',
    '...OOTTTTTTOO',
    '..OATTTTTTTTAO',
    '..OATtTTTTtTAO',
    '...OOtTTTTtOO',
    '....OLLOOLLO',
    '....OllOOllO',
    '.....OO..OO',
  ],
  upB: [
    '',
    '.....OOOOOO',
    '....OHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHHHHHO',
    '...OHhHHHHhHO',
    '...OhhHHHHhhO',
    '....OhhhhhhO',
    '...OOTTTTTTOO',
    '..OATTTTTTTTAO',
    '..OATtTTTTtTOO',
    '...OOtTTTTtOO',
    '....OllOOLLO',
    '.....OO.OllO',
    '.........OO',
  ],
  sideA: [
    '',
    '.....OOOOOO',
    '....OHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHhFFFO',
    '...OHHHhFFEFO',
    '...OhHHhFFFFO',
    '....OhhfFFFO',
    '....OOTTTTOO',
    '....OTTATTTO',
    '....OTtAATTO',
    '....OOtTTTOO',
    '.....OLLLLO',
    '.....OllllO',
    '......OOOO',
  ],
  sideB: [
    '',
    '.....OOOOOO',
    '....OHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHHHHHO',
    '...OHHHHhFFFO',
    '...OHHHhFFEFO',
    '...OhHHhFFFFO',
    '....OhhfFFFO',
    '....OOTTTTOO',
    '....OTATTTTO',
    '....OTAATtTO',
    '....OOtTTTOO',
    '....OLLOOLLO',
    '...OllO..OllO',
    '....OO....OO',
  ],
};

// A look is a color for every role, plus optional overlays stamped on top:
// `over.down`, `over.up`, `over.side`, each a list of [x, y, key].
const row = (y, x, keys) => [...keys].map((k, i) => [x + i, y, k]).filter((p) => p[2] !== '.');

export const LOOKS = {
  // The Wanderer wears light gray. Of course.
  hero: { O: '0', H: '7', h: '5', F: 's', f: 'S', E: '0', T: '6', t: '4', C: 'J', A: 's', L: '3', l: '2' },
  // Bald on top, white at the sides, and a beard he is proud of.
  old_man: {
    O: '0', H: 's', h: 'S', F: 's', f: 'S', E: '0', T: 'n', t: 'B', C: 'N', A: 's', L: 'B', l: 'b',
    over: {
      down: [...row(4, 4, '8......8'), ...row(5, 4, '88....88'), ...row(6, 4, '8......8'),
        ...row(7, 5, '888888'), ...row(8, 5, '878878'), ...row(9, 6, '8778')],
      up: [...row(5, 4, '88888888'), ...row(6, 4, '88888888'), ...row(7, 4, '88888888'), ...row(8, 5, '888888')],
      side: [...row(5, 4, '888'), ...row(6, 4, '888'), ...row(7, 4, '88'),
        ...row(7, 9, '888'), ...row(8, 8, '8788'), ...row(9, 9, '88')],
    },
  },
  young_soldier: {
    O: '0', H: '6', h: '4', F: 's', f: 'S', E: '0', T: 'w', t: 'U', C: 'Y', A: 's', L: '3', l: '1',
    over: { down: [...row(1, 7, 'ww'), ...row(4, 4, '44444444')], up: [...row(1, 7, 'ww')], side: [...row(1, 7, 'ww')] },
  },
  green_guard: {
    O: '0', H: '6', h: '4', F: 's', f: 'S', E: '0', T: 'G', t: 'g', C: 'Y', A: 's', L: '3', l: '1',
    over: { down: [...row(1, 7, 'GG'), ...row(4, 4, '44444444')], up: [...row(1, 7, 'GG')], side: [...row(1, 7, 'GG')] },
  },
  shopkeeper: { O: '0', H: 'n', h: 'B', F: 's', f: 'S', E: '0', T: 'C', t: 'c', C: '8', A: 's', L: 'B', l: 'b' },
  shaman: {
    O: '0', H: 'P', h: 'p', F: 's', f: 'S', E: '0', T: 'W', t: 'w', C: '8', A: 's', L: 'W', l: 'w',
    over: {
      down: [...row(10, 4, '8.8.8.8.'), ...row(12, 5, '.8.8.8'), ...row(0, 10, 'V8')],
      side: [...row(10, 5, '8.8.8.'), ...row(12, 6, '8.8.'), ...row(0, 4, '8V')],
      up: [...row(10, 4, '8.8.8.8.'), ...row(0, 10, 'V8')],
    },
  },
  angel: {
    O: '0', H: 'Y', h: 'y', F: 'k', f: 's', E: 'U', T: '8', t: '7', C: 'Y', A: 'k', L: '8', l: '7',
    over: {
      down: [
        ...row(0, 5, 'llllll'),
        ...row(8, 0, '88'), ...row(9, 0, '888'), ...row(10, 0, '87'), ...row(11, 1, '8'),
        ...row(8, 14, '88'), ...row(9, 13, '888'), ...row(10, 14, '78'), ...row(11, 14, '8'),
        ...row(15, 2, '55'), ...row(15, 12, '55'),
      ],
    },
  },
  goblin: {
    O: '0', H: 'h', h: 'G', F: 'h', f: 'G', E: 'R', T: 'B', t: 'b', C: 'N', A: 'h', L: 'n', l: 'b',
    over: {
      down: [...row(5, 1, 'hh'), ...row(6, 2, 'h'), ...row(5, 13, 'hh'), ...row(6, 13, 'h')],
      up: [...row(5, 1, 'hh'), ...row(6, 2, 'h'), ...row(5, 13, 'hh'), ...row(6, 13, 'h')],
      side: [...row(5, 2, 'h'), ...row(4, 2, 'h')],
    },
  },
};

const HELM = (k) => ({ down: [...row(1, 7, k + k), ...row(4, 4, '44444444')], up: [...row(1, 7, k + k)], side: [...row(1, 7, k + k)] });
const TUSKS = { down: [...row(8, 5, '8....8')], side: [...row(8, 11, '8')] };
const CROWN = { down: [...row(1, 5, 'Y.YY.Y'), ...row(2, 5, 'YYYYYY')], up: [...row(1, 5, 'Y.YY.Y'), ...row(2, 5, 'YYYYYY')], side: [...row(1, 5, 'Y.YY.Y'), ...row(2, 5, 'YYYYYY')] };
const both = (a, b) => ({ down: [...(a.down || []), ...(b.down || [])], up: [...(a.up || []), ...(b.up || [])], side: [...(a.side || []), ...(b.side || [])] });
const SKIN = { O: '0', F: 's', f: 'S', E: '0', A: 's' };

Object.assign(LOOKS, {
  // ---- people along the road
  jack: {
    ...SKIN, H: 'B', h: 'b', T: 'R', t: 'r', C: 'b', L: 'U', l: 'b',
    over: {
      down: [...row(8, 5, 'BBBBBB'), ...row(10, 4, 'r.r.r.r.'), ...row(11, 5, '.r.r.r')],
      side: [...row(8, 9, 'BBB'), ...row(10, 5, 'r.r.r.')],
      up: [...row(10, 4, 'r.r.r.r.')],
    },
  },
  red_guard: { ...SKIN, H: '6', h: '4', T: 'R', t: 'r', C: 'Y', L: '3', l: '1', over: HELM('R') },
  hector: { ...SKIN, H: '6', h: '4', T: 'U', t: 'u', C: 'Y', L: '3', l: '1', over: HELM('Y') },
  dwarf_guard: {
    ...SKIN, H: '5', h: '3', T: '4', t: '2', C: 'Y', L: 'B', l: 'b',
    over: {
      down: [...row(7, 4, 'oooooooo'), ...row(8, 4, 'oOooooOo'), ...row(9, 5, 'oooooo'), ...row(10, 6, 'oooo')],
      side: [...row(7, 8, 'oooo'), ...row(8, 8, 'oooo'), ...row(9, 9, 'ooo')],
    },
  },
  wizard: {
    ...SKIN, H: 'U', h: 'u', T: 'U', t: 'u', C: 'Y', L: 'U', l: 'u',
    over: { down: [...row(0, 7, 'UU'), ...row(8, 5, '888888'), ...row(9, 6, '8888')], up: [...row(0, 7, 'UU')], side: [...row(0, 7, 'UU'), ...row(8, 9, '888')] },
  },
  warrior: { ...SKIN, H: 'n', h: 'B', T: 'R', t: 'r', C: '6', A: '6', L: '4', l: '2' },
  merchant: { ...SKIN, H: 'B', h: 'b', T: 'Y', t: 'y', C: 'B', L: 'B', l: 'b' },
  innkeeper: { ...SKIN, H: 'O', h: 'o', T: '8', t: '7', C: 'n', L: 'n', l: 'B' },
  pirate: { O: '0', H: 'R', h: 'r', F: 'S', f: 'n', E: '0', T: '8', t: '7', C: 'R', A: 'S', L: 'U', l: 'b' },
  hunter: { ...SKIN, H: 'G', h: 'g', T: 'n', t: 'B', C: 'G', L: 'B', l: 'b' },
  ranger: { ...SKIN, H: 'g', h: 'f', T: 'g', t: 'f', C: 'N', L: 'B', l: 'b' },
  dark_elf: { O: '0', H: '8', h: '6', F: 'v', f: 'P', E: '8', T: '2', t: '1', C: 'V', A: 'v', L: '2', l: '1' },
  rigel: {
    ...SKIN, H: '7', h: '5', T: '7', t: '5', C: 'w', A: '6', L: '5', l: '3',
    over: { down: [...row(0, 7, 'ww'), ...row(1, 7, 'ww'), ...row(4, 4, '55555555')], up: [...row(0, 7, 'ww'), ...row(1, 7, 'ww')], side: [...row(0, 7, 'ww'), ...row(1, 7, 'ww')] },
  },
  pax: { O: '0', H: 'l', h: 'Y', F: 'k', f: 's', E: 'w', T: '8', t: '7', C: 'Y', A: 'k', L: '8', l: 'Y' },

  // ---- things that fight, drawn on the same body
  goblin_chief: { ...LOOKS.goblin, T: 'R', t: 'r', C: 'Y', over: both(LOOKS.goblin.over, CROWN) },
  ogre: { O: '0', H: 'D', h: 'n', F: 'D', f: 'n', E: '0', T: 'D', t: 'n', C: 'B', A: 'D', L: 'B', l: 'b', over: TUSKS },
  ogre_lieutenant: {
    O: '0', H: 'D', h: 'n', F: 'D', f: 'n', E: 'R', T: '3', t: '2', C: 'R', A: 'D', L: '2', l: '1',
    over: both(TUSKS, { down: [...row(1, 5, '444444'), ...row(2, 4, '44444444')], up: [...row(1, 5, '444444'), ...row(2, 4, '44444444')], side: [...row(1, 5, '444444'), ...row(2, 4, '44444444')] }),
  },
  kobold: {
    O: '0', H: 'o', h: 'R', F: 'o', f: 'R', E: 'Y', T: 'n', t: 'B', C: 'N', A: 'o', L: 'B', l: 'b',
    over: { down: [...row(0, 4, 'o......o'), ...row(1, 4, 'o......o')], up: [...row(0, 4, 'o......o'), ...row(1, 4, 'o......o')], side: [...row(0, 5, 'o'), ...row(1, 5, 'o')] },
  },
  bowman: { ...SKIN, H: 'g', h: 'f', T: 'B', t: 'b', C: 'g', L: '3', l: '2' },
  highwayman: {
    ...SKIN, H: '2', h: '1', T: '2', t: '1', C: 'R', A: '3', L: '2', l: '1',
    over: { down: [...row(7, 5, '222222'), ...row(8, 5, '222222')], side: [...row(7, 9, '222'), ...row(8, 9, '22')] },
  },
  troll: { O: '0', H: 'C', h: 'c', F: 'C', f: 'c', E: 'Y', T: 'B', t: 'b', C: 'N', A: 'C', L: 'B', l: 'b', over: TUSKS },
  ice_troll: { O: '0', H: 'i', h: 'W', F: 'i', f: 'W', E: 'U', T: 'W', t: 'w', C: '8', A: 'i', L: 'w', l: 'U', over: TUSKS },
  giant: { ...SKIN, H: 'n', h: 'B', T: '5', t: '3', C: 'n', L: '3', l: '2' },
});
LOOKS.kobold_warlock = { ...LOOKS.kobold, T: 'P', t: 'p', C: 'V', L: 'P', l: 'p' };
LOOKS.kobold_master = { ...LOOKS.kobold, H: 'V', h: 'v', T: 'p', t: 'z', C: 'Y', L: 'p', l: 'z' };
LOOKS.troll_shaman = { ...LOOKS.troll, T: 'P', t: 'p', C: 'V' };
LOOKS.troll_king = { ...LOOKS.troll, T: 'R', t: 'r', C: 'Y', over: both(TUSKS, CROWN) };
LOOKS.giant_giant = { ...LOOKS.giant, H: '8', h: '6', T: 'P', t: 'p', C: 'Y' };

// -------------------------------------------------------------- creatures
// `half: true` grids are the left half of a symmetric creature; the right half
// is its mirror. Side-view creatures face right.

const CREATURES = {
  rat: {
    frames: [
      [
        '', '', '', '', '',
        '.........MM',
        '....nnnn.nMn',
        '...nnnnnnnnnnn',
        '..nnnnnnnnnn0nn',
        '..nBnnnnnnnnnnM',
        '.MnBBnnnnnnnnn',
        'M..BBNNNNNNN',
        'M..nn....nn',
        '.MM',
      ],
      [
        '', '', '', '', '',
        '.........MM',
        '....nnnn.nMn',
        '...nnnnnnnnnnn',
        '..nnnnnnnnnn0nn',
        '..nBnnnnnnnnnnM',
        'MMnBBnnnnnnnnn',
        '...BBNNNNNNN',
        '....nn..nn',
      ],
    ],
  },
  bunny: {
    frames: [
      [
        '', '', '', '',
        '.........8.8',
        '.........8.8',
        '.........878',
        '.........8888',
        '....8888.8808',
        '...888888888M',
        '..8888888888',
        '.88888888888',
        '.8788888888',
        '..88...888',
      ],
      [
        '', '', '',
        '.........8.8',
        '.........8.8',
        '.........878',
        '.........8888',
        '....8888.8808',
        '...888888888M',
        '..8888888888',
        '.88888888888',
        '.878888888',
        '.88......88',
      ],
    ],
  },
  spider: {
    half: true,
    frames: [
      ['', '', '', '..2', '...2..pP', '.2..2pPR', '..2..PPP', '...22pPP', '....pPPP', '..22PPvP', '.2..PPPP', '2...pPPP', '.....pPP', '......pp'],
      ['', '', '', '.2', '..2...pP', '..2.2pPR', '.2...PPP', '...22pPP', '....pPPP', '..22PPvP', '..2.PPPP', '.2..pPPP', '.....pPP', '......pp'],
    ],
  },
  scorpion: {
    half: true,
    frames: [
      ['', '.......r', '......rY', '.......r', '.oo....R', 'oRRo...R', 'oR.o..rR', '.oR..RRR', '..oRRR0R', '....RRRR', '..r.rRRR', '.r..rRRR', '....r.RR', '...r...r'],
      ['', '.......r', '......rY', '.......r', '..oo...R', '.oRRo..R', '.oR.o.rR', '..oR.RRR', '..oRRR0R', '....RRRR', '.r..rRRR', '..r.rRRR', '...r..RR', '....r..r'],
    ],
  },
  crab: {
    half: true,
    frames: [
      ['', '', '', '', '..RR', '.RRRR', '.RR.R.8', '..RR..0', '...R.ooo', '...Roooo', '..r.oooo', '.r..oOoo', '..r..ooo', '.r...r'],
      ['', '', '', '.RR', 'RRRR', 'RR.R', '.RR...8', '..R...0', '...R.ooo', '...Roooo', '.r..oooo', '..r.oOoo', '.r...ooo', '..r...r'],
    ],
  },
  bat: {
    half: true,
    frames: [
      ['', '', 'P', 'PP....p', 'PPP...pp', 'PvPP.ppp', 'PvvPPpYp', '.PvvPppp', '..PPPpp8', '....Pppp', '......pp'],
      ['', '', '', '......p', '......pp', '.....ppp', '.PPPPpYp', 'PvvvPppp', 'PvvPPpp8', 'PvP.pppp', 'PP....pp', 'P'],
    ],
  },
  gator: {
    w: 32,
    frames: [
      [
        '', '', '', '',
        '......................gg',
        '.........g.g.g.g.g...gYgg',
        '........gGgGgGgGgGggggGGGgggg',
        '.......gGGGGGGGGGGGGGGGGGGGGGGg',
        '.....ggGGGGGGGGGGGGGGGGGGGhGhGGg',
        '...ggGGGGGGGGGGGGGGGGGGG8.8.8.8',
        '.ggGGGGgGGGGGGGGGGGGGGtt',
        'gGGGgg.ttttttttttttttttt8.8.8',
        '.gg....gGg.tttttt.gGgttGGGGGGg',
        '.......gGg........gGg..gggggg',
        '......ggGgg......ggGgg',
      ],
      [
        '', '', '', '',
        '......................gg',
        '.........g.g.g.g.g...gYgg',
        '........gGgGgGgGgGggggGGGgggg',
        '.......gGGGGGGGGGGGGGGGGGGGGGGg',
        '.....ggGGGGGGGGGGGGGGGGGGGhGhGGg',
        '...ggGGGGGGGGGGGGGGGGGGGGGGGGGg',
        'gggGGGGgGGGGGGGGGGGGGGt8t8t8t8',
        '.gGGgg.ttttttttttttttttGGGGGGg',
        '.......gGg.tttttt.gGg..gggggg',
        '......ggGg.......ggGg',
        '.......gg.........gg',
      ],
    ],
  },
  salamander: {
    frames: [
      ['', '', '', '', '', '', '...........ooo', '..........oOOYo', '...oooooooOOO0O', '.ooOOlOOlOOOOoo', 'oO.oOOOOOOOo', 'o..oo....oo', '..o.o...o.o'],
      ['', '', '', '', '', '', '...........ooo', '..........oOOYo', '...oooooooOOO0O', 'oooOOlOOlOOOOoo', '.O.oOOOOOOOo', '...oo....oo', '...oo....oo'],
    ],
  },
  wolf: {
    frames: [
      ['', '', '', '', '............5.5', '...........5555', '..5........5505', '.55..55555555558', '.5.555555555555', '.5555555555554', '..555555555554', '..5544...4455', '..55......55', '..44......44'],
      ['', '', '', '', '............5.5', '...........5555', '..5........5505', '.55..55555555558', '.5.555555555555', '.5555555555554', '..555555555554', '..5544...4455', '...55....55', '....44..44'],
    ],
  },
  bear: {
    frames: [
      ['', '', '', '...........n.n', '..........nnnnn', '....nnnnnnnn0nn', '..nnnnnnnnnnnnNN', '.nnnnnnnnnnnnnN0', '.nnnnnnnnnnnnnn', '.nnnBnnnnnnBnn', '.nnnBBnnnnBBnn', '.nnn.BB..BBnnn', '.nn...B..B.nnn', '.BB........BBB'],
      ['', '', '', '...........n.n', '..........nnnnn', '....nnnnnnnn0nn', '..nnnnnnnnnnnnNN', '.nnnnnnnnnnnnnN0', '.nnnnnnnnnnnnnn', '.nnnBnnnnnnBnn', '.nnnBBnnnnBBnn', '..nnnBB..BBnn', '..nn..B..B.nn', '..BB.......BB'],
    ],
  },
  snake: {
    frames: [
      ['', '', '', '', '', '', '..........GG', '.........GhhG', '.........Gh0G.R', '....GGG..GhGRR', '...GhhhG.GhG', '..GhGGGhGGhG', '.GhG...GhhG', '.GG.....GG'],
      ['', '', '', '', '', '', '..........GG', '.........GhhG', '.........Gh0GR', '...GGG...GhG.R', '..GhhhG..GhG', '.GhGGGhGGGhG', 'GhG....GhhG', 'GG......GG'],
    ],
  },
  jellyfish: {
    half: true,
    frames: [
      ['', '', '.....MMM', '...MMMMM', '..MMkMMM', '..MMMMMM', '..MmMMmM', '..mMmmMm', '..m.m..m', '..m.m..m', '.m..m.m.', '.m...m.m', '..m..m..'],
      ['', '', '', '.....MMM', '...MMMMM', '..MMkMMM', '.MMMMMMM', '.MmMMmMm', '.mMm.mMm', '..m.m..m', '..m..m.m', '...m.m..', '...m..m.'],
    ],
  },
  fish: {
    frames: [
      ['', '', '', '', '', '.......CCCC', '.C...CCCCCCCC', '.CC.CCCCCCCC0C', '.CCCCCCCCCCCCC8', '.CC.CRRRRRRR8.8', '.C...RRRRRRR', '.......RRR'],
      ['', '', '', '', '', '.......CCCC', '..C..CCCCCCCC', '..CCCCCCCCCC0C', '..CCCCCCCCCCCC8', '..CCCRRRRRRR8.8', '..C..RRRRRRR', '.......RRR'],
    ],
  },
  squid: {
    half: true,
    frames: [
      ['', '......oo', '.....ooo', '....oooo', '....oOoo', '....oooo', '....o80o', '....oooo', '...ooooo', '..o.o.oo', '..o.o..o', '.o..o..o', '.o...o..', '..o..o..'],
      ['', '', '......oo', '.....ooo', '....oooo', '....oOoo', '....oooo', '....o80o', '....oooo', '...ooooo', '...oo.oo', '...o.o.o', '...o.o.o', '....o..o'],
    ],
  },
  shark: {
    w: 32,
    frames: [
      ['', '', '', '..............55', '.............555', '.5..........5555', '.55....5555555555555555', '.555.555555555555555550555', '..5555555555555555555555555', '..555558888888888888888.8.8', '.555...888888888888888888', '.55.......55....8888', '.5.........5'],
      ['', '', '', '..............55', '.............555', '............5555', '55.....5555555555555555', '.555.555555555555555550555', '..5555555555555555555555555', '..555558888888888888888.8.8', '.555...888888888888888888', '55........55....8888', '...........5'],
    ],
  },
  kraken: {
    half: true,
    frames: [
      ['.....RRR', '...RRRRR', '..RRRRRR', '..RRmRRR', '.RRRRRRR', '.RRRRYYR', '.RRRRY0R', '.RRRRRRR', '..RRRRRR', '.R.RR8R8', 'R..R.RRR', 'R.R..R.R', '.R.R.R.R', '.R.R..R.', 'R...R.R.', '....R...'],
      ['.....RRR', '...RRRRR', '..RRRRRR', '..RRmRRR', '.RRRRRRR', '.RRRRYYR', '.RRRRY0R', '.RRRRRRR', '..RRRRRR', 'R..RR8R8', '.R.R.RRR', '.R.R.R.R', 'R..R.R.R', 'R.R...R.', '..R.R.R.', '..R.....'],
    ],
  },
};

// Recolors of a creature: [from, to] palette keys.
const RECOLOR = {
  wyvern: ['bat', { p: 'g', P: 'G', v: 'h', Y: 'R' }],
  giant_rat: ['rat', { n: '4', B: '2', N: '5', 0: 'R' }],
  giant_spider: ['spider', { p: 'r', P: 'R', v: 'O', R: 'Y' }],
  alpha_scorpion: ['scorpion', { R: 'P', r: 'p', o: 'v', Y: 'e' }],
};

// ---------------------------------------------------------------- objects

const THINGS = {
  sign: [
    '', '',
    '..BBBBBBBBBBBB',
    '..BNNNNNNNNNNB',
    '..BNbbbNbbbbNB',
    '..BNNNNNNNNNNB',
    '..BNbbbbbNbbNB',
    '..BNNNNNNNNNNB',
    '..BBBBBBBBBBBB',
    '.......BB',
    '.......nB',
    '.......nB',
    '.......nB',
    '.......nB',
    '......bBBb',
  ],
  chest: [
    '', '', '',
    '...BBBBBBBBBB',
    '..BnNNNNNNNNnB',
    '..BnNNNNNNNNnB',
    '..BnnnnnnnnnnB',
    '..BBBBBYYBBBBB',
    '..BnNNNYYNNNnB',
    '..BnNNNNNNNNnB',
    '..BnNNNNNNNNnB',
    '..BnnnnnnnnnnB',
    '..BBBBBBBBBBBB',
  ],
  chestOpen: [
    '',
    '...BBBBBBBBBB',
    '..BnNNNNNNNNnB',
    '..BnnnnnnnnnnB',
    '..BBBBBBBBBBBB',
    '..B0000000000B',
    '..B0000000000B',
    '..BBBBBBBBBBBB',
    '..BnNNNNNNNNnB',
    '..BnNNNNNNNNnB',
    '..BnNNNNNNNNnB',
    '..BnnnnnnnnnnB',
    '..BBBBBBBBBBBB',
  ],
  flower: [
    '', '', '',
    '.......YY',
    '......YYYY',
    '.....YYOOYY',
    '.....YYOOYY',
    '......YYYY',
    '.......YY',
    '.......g',
    '......hg',
    '.....hhg.h',
    '......hgGh',
    '.......gh',
    '.......g',
  ],
  fire: [
    '', '', '',
    '.......O',
    '......OOO',
    '......OYO..O',
    '.....OOYOO.O',
    '.....OYYYOOO',
    '....OOYlYYOO',
    '....OYYllYYO',
    '....OOYllYOO',
    '....BB.YY.BB',
    '...BnnBBBBnnB',
    '..BnnnnnnnnnnB',
    '...BBBBBBBBBB',
  ],
  swordRack: [
    '', '',
    '...6....6....6',
    '...6....6....6',
    '...6....6....6',
    '...6....6....6',
    '...6....6....6',
    '..YYY..YYY..YYY',
    '...n....n....n',
    '.BBBBBBBBBBBBBB',
    '.BnnnnnnnnnnnnB',
    '.BBBBBBBBBBBBBB',
    '..B..........B',
    '..B..........B',
    '.BBB........BBB',
  ],
  shieldRack: [
    '', '',
    '..555555..555555',
    '..5wwww5..5wwww5',
    '..5wYYw5..5wYYw5',
    '..5wYYw5..5wYYw5',
    '..5wwww5..5wwww5',
    '...5ww5....5ww5',
    '....55......55',
    '.BBBBBBBBBBBBBB',
    '.BnnnnnnnnnnnnB',
    '.BBBBBBBBBBBBBB',
    '..B..........B',
    '..B..........B',
    '.BBB........BBB',
  ],
  counter: [
    '', '', '',
    '..R..YY...W',
    '.RRR.YY..WWW',
    '.RRR.....WWW',
    'BBBBBBBBBBBBBBBB',
    'BNNNNNNNNNNNNNNB',
    'BNNNNNNNNNNNNNNB',
    'BBBBBBBBBBBBBBBB',
    'BnnnnnnnnnnnnnnB',
    'BnnnnnnnnnnnnnnB',
    'BnnnnnnnnnnnnnnB',
    'BBBBBBBBBBBBBBBB',
  ],
  book: [
    '', '', '', '', '', '',
    '....BBBBBBBB',
    '...BRRRRRRRRB',
    '...BRRlllRRRB',
    '...BRRRRRRRRB',
    '...BRRllllRRB',
    '...B88888888B',
    '....BBBBBBBB',
  ],
  paper: [
    '', '', '', '', '', '', '',
    '....888888',
    '....844448',
    '....888888',
    '....844848',
    '....888888',
    '.....77777',
  ],
  restStone: [
    '', '', '', '',
    '......iiii',
    '.....iWWWWi',
    '....5iWiiWi5',
    '...56iWWWWi65',
    '...566iiii665',
    '...5666666665',
    '...4566666654',
    '....44555544',
    '.....444444',
  ],
  bench: [
    '', '', '',
    '....66......nn',
    '....n6.....nBBn',
    '....n.......nn',
    'BBBBBBBBBBBBBBBB',
    'BNNNNNNNNNNNNNNB',
    'BNNNNNNNNNNNNNNB',
    'BBBBBBBBBBBBBBBB',
    '.Bn..........nB',
    '.Bn..........nB',
    '.Bn..........nB',
    '.BB..........BB',
  ],
  tea: [
    '', '', '', '', '',
    '......8..8',
    '.......8.8',
    '....5555555',
    '...5NNNNNNN5.55',
    '...5NNNNNNN55.5',
    '...5NNNNNNN5.5',
    '....5NNNNN555',
    '.....55555',
    '...555555555',
  ],
};

const FX = {
  arrow: ['.....8', 'NNNNN88', '.....8'],
  rock: ['.5555', '566665', '566655', '565555', '.5555'],
  eorb: ['..VV', '.VllV', 'VlllvV', 'VllvvV', '.VvvV', '..VV'],
  // Points up. Rotated for the other three directions.
  sword: [
    '..8',
    '.686',
    '.686',
    '.686',
    '.686',
    '.686',
    '.686',
    '.686',
    'YYYYY',
    '.YnY',
    '..n',
    '..n',
  ],
  // Points up, the same size as the sword, so it swings from the same hand.
  hatchet: [
    '.n66.',
    '.n668',
    '.n668',
    '.n668',
    '.n66.',
    '.n...',
    '.n...',
    '.n...',
    '.n...',
    '.n...',
    '.n...',
    '.B...',
  ],
  // The arc of a swing, across the top. Rotated for the other directions.
  slash: [
    '....88888888',
    '..888......888',
    '.88..........88',
    '88............88',
    '8..............8',
  ],
  boomerang: [
    'NN',
    'NNN',
    '.NNn',
    '..NNn',
    '..NNn',
    '.NNn',
    'NNn',
    'Nn',
  ],
  coin: [
    '..YYYY',
    '.YYllYY',
    'YYlYYyY',
    'YYlYYyY',
    'YYlYYyY',
    'YYlYYyY',
    '.YYyyYY',
    '..YYYY',
  ],
  orb: [
    '..WW',
    '.WiiW',
    'WiiiiW',
    'WiiiiW',
    '.WiiW',
    '..WW',
  ],
  spike: ['..8', '.868', '86068', '.868', '..8'],
};

// Small pictures for the HUD slots and menus. 10x10.
const ICONS = {
  sword: ['........88', '.......886', '......886', '.....886', '.Y..886', '.YY886', '..YY6', '.nYYY', 'nn..Y', 'n'],
  boomerang: ['', '.NNNNNN', '.NNNNNNN', '.NN', '.NN', '.NN', '.NN', '.nn', '.nn'],
  shield: ['', '.55555555', '.5wwwwww5', '.5wwYYww5', '.5wwYYww5', '.5wwwwww5', '..5wwww5', '...5ww5', '....55'],
  armor: ['', '.55....55', '5665..5665', '56666666665'.slice(0, 10), '.56666665', '.56644665', '.56666665', '.56666665', '.55555555'],
  staff: ['.......WW', '......WiiW', '......WiiW', '.......WW', '......n', '.....n', '....n', '...n', '..n', '.n'],
  redberry: ['', '....g', '...gg', '..RRRR', '.RRoRRR', '.RRRRRR', '.RRRRRR', '..RRRR'],
  blueberry: ['', '....g', '...gg', '..wwww', '.wwWwww', '.wwwwww', '.wwwwww', '..wwww'],
  meat: ['', '..OOOO', '.OooooO', '.OooooO8', '.Oooooo8', '..OOOO.88', '.......8'],
  cooked: ['', '..BBBB', '.BnnnnB', '.BnnnnB8', '.Bnnnnn8', '..BBBB.88', '.......8'],
  potion: ['...88', '...BB', '...55', '..5RR5', '.5RRRR5', '.5RoRR5', '.5RRRR5', '.5RRRR5', '..5555'],
  bluepotion: ['...88', '...BB', '...55', '..5ww5', '.5wwww5', '.5wWww5', '.5wwww5', '.5wwww5', '..5555'],
  key: ['', '.YYY', 'Y...Y', 'Y...Y', '.YYY', '..Y', '..Y', '..YY', '..Y', '..YY'],
  tail: ['', '......RR', '.....R.YR', '.....R', '....RR', '...RR', '..RR', '.RR', 'RR'],
  flower: ['', '...YY', '..YYYY', '..YOOY', '..YYYY', '...YY', '...g', '..hg', '...gh', '...g'],
  spell: ['', '...WW', '..WiiW', '.WiiiiW', '.WiiiiW', '..WiiW', '...WW'],
  bow: ['...nn', '..n..8', '.n...8', '.n...8', 'NNNNN8', '.n...8', '.n...8', '..n..8', '...nn'],
  purplepotion: ['...88', '...BB', '...55', '..5vv5', '.5vvvv5', '.5vVvv5', '.5vvvv5', '.5vvvv5', '..5555'],
  wing: ['', '.......88', '.....8887', '...888877', '.8888877', '8888777', '.87777', '..777'],
  cloak: ['', '..RRRRRR', '.RRYYRRR', '.RRRRRRRR', '.RRRRRRRR', '.RrRRRRrR', '.RrRRRRrR', '.r.rRRr.r'],
  hatchet: ['', '.8666', '866666', '86666n', '.866Nn', '....NNn', '.....NNn', '......NNn', '.......Nn'],
  wood: ['', '', '..BBBBBB', '.BnNNNNnB', '.BnNNNNnB', '..BBBBBB', '.BnNNNNnB', '.BnNNNNnB', '..BBBBBB'],
  boat: ['', '', '....8', '....88', '....888', '....B', 'BBBBBBBBBB', '.BnnnnnnB', '..BBBBBB'],
  gills: ['', '..WW..WW', '.W..WW..W', '..WW..WW', '.W..WW..W', '..WW..WW', '.W..WW..W'],
  none: [],
};

// --------------------------------------------------------- big set pieces

function paintPillar(glow) {
  const b = new Buf(16, 32);
  b.rect(2, 26, 12, 5, '4');            // base
  b.rect(3, 25, 10, 2, '5');
  b.hline(2, 26, 12, '6');
  b.rect(4, 4, 8, 22, '6');             // shaft
  b.vline(4, 4, 22, '7');
  b.vline(5, 4, 22, '7');
  b.vline(10, 4, 22, '5');
  b.vline(11, 4, 22, '4');
  b.rect(2, 1, 12, 4, '6');             // cap
  b.hline(2, 1, 12, '8');
  b.hline(2, 4, 12, '4');
  if (glow) {
    const [dark, mid, lit] = glow === 'gold' ? ['y', 'Y', 'l'] : ['w', 'W', 'i'];
    b.rect(6, 12, 4, 4, dark);          // the button
    b.rect(7, 13, 2, 2, lit);
    b.px(6, 12, mid); b.px(9, 12, mid); b.px(6, 15, mid); b.px(9, 15, mid);
  } else {
    for (const y of [8, 11, 14, 17, 20]) b.hline(6, y, 4, '4'); // five carved names
  }
  b.outline('1');
  return b;
}

/** A young pine: the kind of tree a hatchet can take down. */
function paintPine() {
  const b = new Buf(16, 24);
  b.rect(7, 19, 2, 5, 'B');
  b.vline(8, 19, 5, 'b');
  const tier = (y0, y1, wmax) => {
    for (let y = y0; y <= y1; y++) {
      const hw = Math.max(1, Math.round(1 + (wmax - 1) * ((y - y0) / (y1 - y0))));
      for (let x = 8 - hw; x <= 7 + hw; x++) {
        const k = (x - 7.5) / hw;
        b.px(x, y, y === y1 ? 'f' : k < -0.35 ? 'h' : k > 0.3 ? 'g' : 'G');
      }
    }
  };
  tier(13, 20, 7);
  tier(7, 15, 6);
  tier(1, 9, 4);
  b.px(7, 0, 'G');
  b.px(8, 0, 'g');
  b.outline('x');
  return b;
}

/** What a pine leaves behind, with a few chips around it. */
function paintPineStump() {
  const b = new Buf(16, 16);
  b.rect(5, 10, 6, 5, 'B');
  b.vline(5, 10, 5, 'n');
  b.vline(10, 10, 5, 'b');
  b.ellipse(7.5, 9.6, 3.2, 1.8, 'b');
  b.ellipse(7.5, 9.4, 2.5, 1.2, 'T');
  b.px(7, 9, 'd');
  b.px(3, 15, 'B'); b.px(4, 15, 'B'); b.px(11, 15, 'b'); b.px(12, 15, 'b');
  b.px(12, 13, 'T'); b.px(13, 14, 'd'); b.px(2, 13, 'T');
  return b;
}

/** A chopping block and two split logs, with or without the hatchet left in it. */
function paintBlock(hatchet) {
  const b = new Buf(16, 24);
  b.rect(10, 19, 6, 3, 'n'); b.hline(10, 19, 6, 'N'); b.rect(14, 19, 2, 3, 'T'); b.px(15, 21, 'd'); b.hline(10, 22, 6, 'b');
  b.rect(0, 20, 5, 3, 'n'); b.hline(0, 20, 5, 'N'); b.rect(0, 20, 2, 3, 'T'); b.px(0, 22, 'd'); b.hline(0, 23, 5, 'b');
  b.rect(3, 13, 10, 9, 'B');
  b.vline(3, 13, 9, 'n'); b.vline(4, 13, 9, 'n'); b.vline(12, 13, 9, 'b');
  b.vline(7, 15, 6, 'b'); b.vline(10, 16, 5, 'b');
  b.hline(4, 22, 8, 'b');
  b.ellipse(7.5, 12.5, 5, 2.6, 'b');
  b.ellipse(7.5, 12.3, 4.2, 1.9, 'T');
  b.px(6, 12, 'd'); b.px(8, 13, 'd'); b.px(9, 12, 'd'); b.px(7, 12, 'N');
  if (!hatchet) { b.hline(5, 12, 4, 'd'); return b; }   // the cut it left
  for (let i = 0; i < 8; i++) { b.px(8 + i, 9 - i, 'N'); b.px(9 + i, 9 - i, 'n'); }
  b.px(15, 1, 'b');
  b.rect(4, 7, 5, 5, '5');
  b.hline(4, 7, 5, '7'); b.vline(4, 7, 5, '8'); b.vline(8, 8, 4, '4'); b.hline(5, 12, 3, '3');
  b.px(4, 12, '8');
  return b;
}

function paintFountain() {
  const b = new Buf(32, 28);
  b.ellipse(15.5, 18, 15, 9, '4');
  b.ellipse(15.5, 17, 14, 8, '6');
  b.ellipse(15.5, 17, 12, 6.4, 'w');
  b.ellipse(15.5, 16.5, 9, 4, 'W');
  b.rect(14, 4, 4, 13, '6');
  b.vline(14, 4, 13, '7');
  b.vline(17, 4, 13, '4');
  b.rect(11, 2, 10, 3, '6');
  b.hline(11, 2, 10, '8');
  for (const [x, y] of [[9, 7], [22, 7], [8, 10], [23, 10], [12, 5], [19, 5]]) b.px(x, y, 'i');
  b.outline('1');
  return b;
}

/** A building front. Walls are wood or stone; the roof color says whose it is. */
function paintHouse(w, roof, roofDark, stone, mark) {
  const b = new Buf(w, 34);
  const wall = stone ? '5' : 'n';
  const seam = stone ? '4' : 'B';
  b.rect(3, 14, w - 6, 19, wall);
  for (let y = 17; y < 33; y += 4) b.hline(3, y, w - 6, seam);
  if (stone) for (let y = 14; y < 33; y += 4) for (let x = 6 + (y % 8 ? 4 : 0); x < w - 4; x += 8) b.vline(x, y, 3, seam);
  b.vline(3, 14, 19, seam);
  b.vline(w - 4, 14, 19, seam);
  for (let y = 1; y < 15; y++) {
    const inset = Math.max(0, 6 - y);
    b.hline(inset, y, w - inset * 2, y % 3 === 0 ? roofDark : roof);
  }
  b.hline(0, 14, w, roofDark);
  const dx = Math.floor(w / 2) - 4;
  b.rect(dx, 21, 8, 12, 'b');
  b.rect(dx + 1, 22, 6, 11, 'B');
  b.px(dx + 6, 28, 'Y');
  b.rect(7, 20, 7, 6, 'b');
  b.rect(8, 21, 5, 4, 'l');
  b.rect(w - 14, 20, 7, 6, 'b');
  b.rect(w - 13, 21, 5, 4, 'l');
  if (mark) {            // a hanging sign over the door, in the owner's color
    b.rect(dx - 1, 15, 10, 5, 'b');
    b.rect(dx, 16, 8, 3, mark);
  }
  b.outline('0');
  return b;
}

function paintBoat() {
  const b = new Buf(22, 10);
  b.rect(1, 3, 20, 4, 'n');
  b.hline(2, 7, 18, 'B');
  b.hline(4, 8, 14, 'B');
  b.hline(1, 3, 20, 'N');
  b.rect(0, 3, 1, 3, 'B');
  b.rect(21, 3, 1, 3, 'B');
  b.outline('0');
  return b;
}

function paintWhirl(i) {
  const b = new Buf(16, 16);
  for (let a = 0; a < 26; a++) {
    const t = a / 26;
    const ang = t * 9.4 + i * 1.6;
    const r = 1 + t * 6.5;
    b.px(8 + Math.cos(ang) * r, 8 + Math.sin(ang) * r * 0.8, a % 3 === 0 ? 'i' : 'W');
  }
  b.rect(7, 7, 2, 2, 'u');
  return b;
}

/** The Blue Gate: many moving pieces, none of them moving for you yet. */
function paintGate() {
  const b = new Buf(32, 32);
  b.rect(0, 2, 32, 30, 'U');
  b.rect(2, 4, 28, 28, 'w');
  for (let y = 6; y < 30; y += 6) b.hline(2, y, 28, 'U');
  b.vline(15, 4, 28, 'u');
  b.vline(16, 4, 28, 'u');
  for (const [x, y] of [[8, 10], [23, 10], [8, 22], [23, 22]]) { b.ellipse(x, y, 2.5, 2.5, 'W'); b.px(x, y, 'i'); }
  for (const x of [11, 15, 19]) { b.rect(x, 15, 3, 4, 'Y'); b.px(x + 1, 16, 'y'); }
  b.rect(0, 0, 32, 3, '6');
  b.hline(0, 0, 32, '8');
  b.outline('0');
  return b;
}

function paintBerryBush(berry) {
  const b = new Buf(16, 16);
  b.ellipse(7.5, 9, 6.5, 5.5, (x, y, dx, dy) => (dx * 0.6 + dy * 0.8 < -0.35 ? 'h' : dx * 0.6 + dy * 0.8 > 0.4 ? 'f' : 'g'));
  for (const [x, y] of [[5, 7], [9, 6], [7, 10], [11, 9], [4, 10], [8, 8]]) {
    b.px(x, y, berry);
    b.px(x + 1, y, berry);
    b.px(x, y + 1, berry);
  }
  b.outline('x');
  return b;
}

function paintTent() {
  const b = new Buf(32, 32);
  for (let y = 4; y < 30; y++) {
    const half = Math.round(((y - 4) / 26) * 14) + 1;
    for (let x = 16 - half; x < 16 + half; x++) {
      const stripe = Math.floor((x + 64) / 4) % 2 === 0;
      b.px(x, y, stripe ? 'P' : 'v');
    }
  }
  for (let y = 16; y < 30; y++) {           // the way in
    const half = Math.round(((y - 16) / 14) * 4) + 1;
    for (let x = 16 - half; x < 16 + half; x++) b.px(x, y, '0');
  }
  b.rect(15, 1, 2, 4, 'n');                 // pole and a little flag
  b.rect(17, 1, 4, 2, 'Y');
  b.outline('0');
  return b;
}

function paintCabin() {
  const b = new Buf(48, 34);
  b.rect(3, 14, 42, 19, 'n');               // log walls
  for (let y = 17; y < 33; y += 4) b.hline(3, y, 42, 'B');
  b.vline(3, 14, 19, 'B');
  b.vline(44, 14, 19, 'B');
  for (let y = 1; y < 15; y++) {            // roof
    const inset = Math.max(0, 6 - y);
    b.hline(inset, y, 48 - inset * 2, y % 3 === 0 ? 'r' : 'R');
  }
  b.hline(0, 14, 48, 'r');
  b.rect(20, 21, 8, 12, 'b');               // door
  b.rect(21, 22, 6, 11, 'B');
  b.px(26, 28, 'Y');
  b.rect(8, 20, 7, 6, 'b');                 // windows
  b.rect(9, 21, 5, 4, 'l');
  b.rect(33, 20, 7, 6, 'b');
  b.rect(34, 21, 5, 4, 'l');
  b.rect(36, 0, 5, 6, '4');                 // chimney
  b.hline(36, 0, 5, '6');
  b.outline('0');
  return b;
}

function paintPoof(i) {
  const b = new Buf(16, 16);
  const r = 3 + i * 2;
  for (let a = 0; a < 8; a++) {
    const x = 8 + Math.cos((a / 8) * 6.283) * r;
    const y = 8 + Math.sin((a / 8) * 6.283) * r;
    b.ellipse(x, y, 2.2 - i * 0.6, 2.2 - i * 0.6, i === 0 ? '8' : '7');
  }
  return b;
}

// ------------------------------------------------------------------ bake

function grid(rows, w, h) {
  const out = [];
  for (let y = 0; y < h; y++) {
    const r = rows[y] || '';
    if (r.length > w) throw new Error(`row ${y} is ${r.length} wide, limit ${w}: "${r}"`);
    out.push(r.padEnd(w, '.'));
  }
  return out;
}

function mirrorHalf(rows, h) {
  return grid(rows, 8, h).map((r) => r + [...r].reverse().join(''));
}

/** Can this enemy definition be drawn? */
export function hasArt(def) {
  return !!(CREATURES[def.sprite] || RECOLOR[def.sprite] || LOOKS[def.look]);
}

/** Every object sprite a room may name. */
export const THING_SPRITES = new Set([
  ...Object.keys(THINGS), 'goldChest', 'goldChestOpen', 'fire2', 'pillar', 'grandPillar', 'hubPillar',
  'redberryBush', 'blueberryBush', 'tent', 'cabin', 'fountain', 'gate', 'boat', 'whirl',
  'pine', 'pineStump', 'block', 'blockHatchet',
  'houseWood', 'houseRed', 'houseBlue', 'houseShop', 'housePub',
]);

/** Check every grid for width and palette mistakes without drawing anything. */
export function checkArt(PAL) {
  const errors = [];
  const check = (name, rows, swap = null) => {
    rows.forEach((r, y) => {
      for (const ch of r) {
        const k = swap && swap[ch] !== undefined ? swap[ch] : ch;
        if (k !== '.' && k !== ' ' && !PAL[k]) errors.push(`${name}: unknown color '${k}' on row ${y}`);
      }
    });
  };
  const tryGrid = (name, fn) => { try { return fn(); } catch (e) { errors.push(`${name}: ${e.message}`); return null; } };
  for (const [name, rows] of Object.entries(HUMAN)) {
    const g = tryGrid(`human.${name}`, () => grid(rows, 16, 16));
    if (g) for (const [who, look] of Object.entries(LOOKS)) check(`${who}.${name}`, g, look);
  }
  for (const [name, c] of Object.entries(CREATURES)) {
    c.frames.forEach((f, i) => {
      const g = tryGrid(`${name}[${i}]`, () => (c.half ? mirrorHalf(f, 16) : grid(f, c.w || 16, 16)));
      if (g) check(`${name}[${i}]`, g);
    });
  }
  for (const [name, rows] of Object.entries(THINGS)) { const g = tryGrid(name, () => grid(rows, 16, 16)); if (g) check(name, g); }
  for (const [name, rows] of Object.entries(ICONS)) { const g = tryGrid(`icon.${name}`, () => grid(rows, 10, 10)); if (g) check(`icon.${name}`, g); }
  for (const [name, rows] of Object.entries(FX)) check(`fx.${name}`, rows);
  return errors;
}

function bakePerson(look) {
  const make = (name, dir) => {
    const b = new Buf(16, 16);
    b.stamp(grid(HUMAN[name], 16, 16), 0, 0, look);
    const over = look.over && look.over[dir];
    if (over) for (const [x, y, k] of over) b.px(x, y, k);
    b.outline(look.O || '0');
    return b.toCanvas(name);
  };
  const downA = make('downA', 'down');
  const downB = make('downB', 'down');
  const upA = make('upA', 'up');
  const upB = make('upB', 'up');
  const rightA = make('sideA', 'side');
  const rightB = make('sideB', 'side');
  return {
    down: [downA, downB, downA, flipH(downB)],
    up: [upA, upB, upA, flipH(upB)],
    right: [rightA, rightB, rightA, rightB],
    left: [flipH(rightA), flipH(rightB), flipH(rightA), flipH(rightB)],
  };
}

function bakeCreature(def, swap = null, big = false) {
  const frames = def.frames.map((f, i) => {
    const rows = def.half ? mirrorHalf(f, 16) : grid(f, def.w || 16, 16);
    const b = new Buf(def.w || 16, 16);
    b.stamp(rows, 0, 0, swap);
    b.outline('0');
    const c = b.toCanvas(`creature ${i}`);
    return big ? scale2(c) : c;
  });
  return {
    right: frames,
    left: frames.map(flipH),
    white: frames.map((f) => tint(f, '8')),
    whiteLeft: frames.map((f) => tint(flipH(f), '8')),
    w: frames[0].width,
    h: frames[0].height,
  };
}

/** Build every sprite. Browser only. */
export function buildSprites() {
  const S = { people: {}, creatures: {}, things: {}, fx: {}, icons: {} };

  for (const [who, look] of Object.entries(LOOKS)) S.people[who] = bakePerson(look);

  for (const [name, def] of Object.entries(CREATURES)) S.creatures[name] = bakeCreature(def);
  for (const [name, [from, swap]] of Object.entries(RECOLOR)) S.creatures[name] = bakeCreature(CREATURES[from], swap);
  // Anything drawn on the person template can also fight like a creature.
  for (const [who, set] of Object.entries(S.people)) {
    if (S.creatures[who]) continue;
    S.creatures[who] = {
      right: [set.right[0], set.right[1]], left: [set.left[0], set.left[1]],
      white: [tint(set.right[0], '8'), tint(set.right[1], '8')],
      whiteLeft: [tint(set.left[0], '8'), tint(set.left[1], '8')],
      w: 16, h: 16,
    };
  }
  /** The sprite set for an enemy definition; big ones are doubled once and kept. */
  S.creatureFor = (def) => {
    const base = def.sprite || def.look;
    if (!def.big) return S.creatures[base];
    const key = `${base}@2`;
    if (!S.creatures[key]) {
      const from = S.creatures[base];
      const up = (list) => list.map(scale2);
      S.creatures[key] = { right: up(from.right), left: up(from.left), white: up(from.white), whiteLeft: up(from.whiteLeft), w: from.w * 2, h: from.h * 2 };
    }
    return S.creatures[key];
  };

  for (const [name, rows] of Object.entries(THINGS)) {
    S.things[name] = bake(grid(rows, 16, 16), null, name);
  }
  S.things.goldChest = bake(grid(THINGS.chest, 16, 16), { N: 'Y', n: 'y', B: 'b', Y: '8' }, 'goldChest');
  S.things.goldChestOpen = bake(grid(THINGS.chestOpen, 16, 16), { N: 'Y', n: 'y', B: 'b' }, 'goldChestOpen');
  S.things.fire2 = flipH(S.things.fire);
  S.things.pillar = paintPillar(true).toCanvas('pillar');
  S.things.grandPillar = paintPillar(false).toCanvas('grandPillar');
  S.things.redberryBush = paintBerryBush('R').toCanvas('redberryBush');
  S.things.blueberryBush = paintBerryBush('w').toCanvas('blueberryBush');
  S.things.tent = paintTent().toCanvas('tent');
  S.things.cabin = paintCabin().toCanvas('cabin');
  S.things.hubPillar = paintPillar('gold').toCanvas('hubPillar');
  S.things.fountain = paintFountain().toCanvas('fountain');
  S.things.pine = paintPine().toCanvas('pine');
  S.things.pineStump = paintPineStump().toCanvas('pineStump');
  S.things.block = paintBlock(false).toCanvas('block');
  S.things.blockHatchet = paintBlock(true).toCanvas('blockHatchet');
  S.things.gate = paintGate().toCanvas('gate');
  S.things.boat = paintBoat().toCanvas('boat');
  S.things.whirl = [0, 1, 2].map((i) => paintWhirl(i).toCanvas('whirl'));
  S.things.houseWood = paintHouse(48, 'G', 'g', false, null).toCanvas('houseWood');
  S.things.houseRed = paintHouse(48, 'R', 'r', true, 'A').toCanvas('houseRed');
  S.things.houseBlue = paintHouse(48, 'U', 'u', true, 'L').toCanvas('houseBlue');
  S.things.houseShop = paintHouse(48, 'n', 'B', true, 'J').toCanvas('houseShop');
  S.things.housePub = paintHouse(64, 'o', 'r', true, 'I').toCanvas('housePub');

  const sword = bake(FX.sword.map((r) => r.padEnd(5, '.')), null, 'sword');
  S.fx.sword = { up: sword, right: rotate(sword, 1), down: rotate(sword, 2), left: rotate(sword, 3) };
  const slash = bake(FX.slash.map((r) => r.padEnd(16, '.')), null, 'slash');
  S.fx.slash = { up: slash, right: rotate(slash, 1), down: rotate(slash, 2), left: rotate(slash, 3) };
  const hatchet = bake(FX.hatchet.map((r) => r.padEnd(5, '.')), null, 'hatchet');
  S.fx.hatchet = { up: hatchet, right: rotate(hatchet, 1), down: rotate(hatchet, 2), left: rotate(hatchet, 3) };
  const boom = bake(FX.boomerang.map((r) => r.padEnd(8, '.')), null, 'boomerang');
  S.fx.boomerang = [boom, rotate(boom, 1), rotate(boom, 2), rotate(boom, 3)];
  S.fx.coin = bake(FX.coin.map((r) => r.padEnd(8, '.')), null, 'coin');
  S.fx.orb = bake(FX.orb.map((r) => r.padEnd(6, '.')), null, 'orb');
  S.fx.spike = bake(FX.spike.map((r) => r.padEnd(5, '.')), null, 'spike');
  S.fx.rock = bake(FX.rock.map((r) => r.padEnd(6, '.')), null, 'rock');
  S.fx.eorb = bake(FX.eorb.map((r) => r.padEnd(6, '.')), null, 'eorb');
  const arrow = bake(FX.arrow.map((r) => r.padEnd(7, '.')), null, 'arrow');
  S.fx.arrow = { right: arrow, down: rotate(arrow, 1), left: rotate(arrow, 2), up: rotate(arrow, 3) };
  S.fx.poof = [0, 1, 2].map((i) => paintPoof(i).toCanvas('poof'));
  S.fx.heroWhite = {};
  for (const dir of ['down', 'up', 'left', 'right']) S.fx.heroWhite[dir] = S.people.hero[dir].map((f) => tint(f, '8'));

  for (const [name, rows] of Object.entries(ICONS)) S.icons[name] = bake(grid(rows, 10, 10), null, `icon ${name}`);

  return S;
}
