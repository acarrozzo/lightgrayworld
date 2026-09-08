/**
 * Everything a room hands a player for free, in one table.
 *
 * The original had two shapes for this, both per player: "one while held"
 * (a spare hatchet, a hammer, a rack weapon — `if ($hatchet >= 1) refuse`) and
 * "refill to N" (`SET arrows = 50`, `SET leather = 5`). Neither was a shared
 * pile: two players at the same crate each got their own, and a partial grab
 * could never strand a half-empty pile for the next visitor. This table keeps
 * that shape. Shared `RoomItem` rows now exist only for what players drop.
 *
 * Consumed by:
 *   - services/room-supply-service.js   (status per player, and the take itself)
 *   - scripts/validate-world.js         (rooms and slugs exist, caps are sane)
 *   - the World Tool's rooms and items pages (what a room provides, where an
 *     item can be had)
 *
 * Fields:
 *   roomId   Room.roomId
 *   slug     ItemTemplate.slug
 *   mode     'take'  — one each: hold `cap` (default 1) at a time, come back
 *                      for another when it is gone.
 *            'topUp' — refill: taking brings the player up to `cap`, never past.
 *   cap      the per-player, per-room line. Independent of ItemTemplate.max,
 *            which is the bag's own limit and only ever clamps.
 *   take     button label (default "Take"); the lake says "Fish".
 *   plural   how the feed names several ("bolts", "cups of tea"); defaults to a
 *            regular plural of the template name.
 *   message  (collected, total) => the sentence for a successful take. The
 *            feed appends the tally "[ +N x = total ]" itself.
 *   full     (held) => the refusal when already at the line.
 *
 * @typedef {{
 *   roomId: string,
 *   slug: string,
 *   mode: 'take' | 'topUp',
 *   cap?: number,
 *   take?: string,
 *   plural?: string,
 *   message?: (collected: number, total: number) => string,
 *   full?: (held: number) => string,
 * }} RoomSupplyEntry
 * @type {RoomSupplyEntry[]}
 */
const ROOM_SUPPLIES = [
  // ==================== GRASSY FIELD ====================
  { roomId: '001', slug: 'welcome-book', mode: 'take', message: () => 'You take the Welcome Book. Read it before you wander off.' },
  {
    roomId: '004',
    slug: 'flower',
    mode: 'take',
    message: () => 'You pick up a flower.',
    full: () => 'You already have a flower in your inventory.',
  },
  { roomId: '006', slug: 'shovel', mode: 'take', message: () => 'You take the shovel. The beach to the west is all sand.' },

  // Room 007 — the Young Soldier's training rack, one of each.
  { roomId: '007', slug: 'training-sword', mode: 'take' },
  { roomId: '007', slug: 'training-shield', mode: 'take' },
  { roomId: '007', slug: 'training-2h-sword', mode: 'take' },

  { roomId: '014', slug: 'pickaxe', mode: 'take', message: () => 'You take a pickaxe from the cache by the road. The Giant Rock to the west is worth a swing.' },
  { roomId: '019', slug: 'bo', mode: 'take', message: () => 'You pull a bo out of the crab shells and give it a spin.' },

  // Jack Lumber's cabin (024) and the Forest Gnome's hut (128): the spare
  // hatchet. "If you lose it come back here for another one."
  {
    roomId: '024',
    slug: 'hatchet',
    mode: 'take',
    message: () => 'You pick up a hatchet.',
    full: () => 'You already have a hatchet. If you lose it come back here for another one.',
  },
  {
    roomId: '128',
    slug: 'hatchet',
    mode: 'take',
    message: () => 'You take a hatchet from beside the Gnome\'s door.',
    full: () => 'You already have a hatchet. If you lose it come back here for another free one.',
  },

  // Room 028c — the crafting corner's tools. Hammer and string are the
  // original's "another free one"; the pickaxe is the modern cache.
  {
    roomId: '028c',
    slug: 'hammer',
    mode: 'take',
    message: () => 'You pick up a hammer and put it in your inventory.',
    full: () => 'You already have a hammer. If you lose it come back here for another free one.',
  },
  {
    roomId: '028c',
    slug: 'string',
    mode: 'take',
    message: () => 'You pick up a string and put it in your inventory.',
    full: () => 'You already have a string. If you lose it come back here for another free one.',
  },
  { roomId: '028c', slug: 'pickaxe', mode: 'take' },

  // Room 088 — the Solar Office. Soon a VIP room; the gear stays one each.
  { roomId: '088', slug: 'master-sword', mode: 'take' },
  { roomId: '088', slug: 'enchanted-orb', mode: 'take' },

  // ==================== FOREST ====================
  {
    roomId: '103',
    slug: 'hammer',
    mode: 'take',
    message: () => 'You take a hammer from the crate by the workshop door. You will need it to work leather.',
    full: () => 'You already have a hammer. If you lose it, come back here for another free one.',
  },
  {
    roomId: '103c',
    slug: 'wood',
    mode: 'topUp',
    cap: 5,
    plural: 'wood',
    message: (n) => `You grab a stack of ${n} wood from behind the fence.`,
    full: () => "You can't pick up more than 5 pieces of wood here. Come back if you run low.",
  },
  {
    roomId: '117',
    slug: 'leather',
    mode: 'topUp',
    cap: 5,
    plural: 'leather',
    message: (n) => `You pick up ${n} pieces of leather from the stack under the tree.`,
    full: () => 'You already have 5 leather. Come back if you run low — for more than 5 you will have to hunt for it.',
  },
  {
    roomId: '120',
    slug: 'ring-of-dexterity-iii',
    mode: 'take',
    message: () => "You pick a Ring of Dexterity III out of the silt at the river's edge. Somebody lost this a long time ago.",
    full: () => 'You already have a Ring of Dexterity III. If you lose it, come back here for another free one.',
  },
  {
    roomId: '124',
    slug: 'arrow',
    mode: 'topUp',
    cap: 50,
    message: () => 'You grab a bundle of arrows from the guard stores.',
    full: () => 'You already have 50 arrows. Come back if you run low.',
  },
  {
    roomId: '131',
    slug: 'bluefish',
    mode: 'topUp',
    cap: 10,
    take: 'Fish',
    plural: 'bluefish',
    message: (n) => `You fish in the lake and catch ${n} bluefish.`,
    full: () => 'There are no more fish left in the lake. Come back later.',
  },

  // ==================== RED TOWN ====================
  {
    roomId: '208',
    slug: 'veggies',
    mode: 'topUp',
    cap: 5,
    plural: 'veggies',
    message: () => "You grab some veggies from Rob's stand.",
    full: () => 'You already have some veggies! Come back if you run out.',
  },
  // The Red Guard Barracks weapon rack: one of each, off the rack.
  { roomId: '212', slug: 'mace', mode: 'take', message: () => 'You grab a mace off the weapon rack and place it in your pack.' },
  { roomId: '212', slug: 'long-sword', mode: 'take', message: () => 'You grab a long sword off the weapon rack and place it in your pack.' },
  { roomId: '212', slug: 'warhammer', mode: 'take', message: () => 'You grab a warhammer off the weapon rack and place it in your pack.' },
  {
    roomId: '213',
    slug: 'cooked-meat',
    mode: 'topUp',
    cap: 5,
    plural: 'cooked meat',
    message: () => 'You grab some cooked meat from the barracks table.',
    full: () => 'You already have 5 pieces of meat! Come back later if you eat them all.',
  },
  {
    roomId: '214',
    slug: 'ring-of-strength-iii',
    mode: 'take',
    message: () => 'You grab a Ring of Strength III out of the bowl.',
    full: () => 'You already have a Ring of Strength III. If you lose it, come back here for another free one.',
  },
  // The Red Dining Room spread: meat, veg and a pot of coffee, ten of each.
  { roomId: '223', slug: 'cooked-meat', mode: 'topUp', cap: 10, plural: 'cooked meat', full: () => 'You already have 10 cooked meat! Come back if you run out.' },
  { roomId: '223', slug: 'veggies', mode: 'topUp', cap: 10, plural: 'veggies', full: () => 'You already have 10 veggies! Come back if you run out.' },
  { roomId: '223', slug: 'coffee', mode: 'topUp', cap: 10, plural: 'coffee', full: () => 'You already have 10 coffee! Come back if you run out.' },
  // The Thieves' Den: the bolt stash in the corner, and a few red potions.
  { roomId: '232m', slug: 'crossbow-bolt', mode: 'topUp', cap: 25, plural: 'bolts', full: () => 'You already have 25 bolts! Come back if you run low.' },
  { roomId: '232m', slug: 'red-potion', mode: 'topUp', cap: 3 },
  // Across the sewer river: the wings potions that get you back.
  { roomId: '232y', slug: 'red-potion', mode: 'topUp', cap: 3 },
  { roomId: '232y', slug: 'wings-potion', mode: 'topUp', cap: 5, full: () => 'You already have 5 wings potions! Come back if you run out.' },

  // ==================== ROCKY FLATS ====================
  {
    roomId: '306',
    slug: 'arrow',
    mode: 'topUp',
    cap: 50,
    message: () => "You take a bundle of arrows from the guard's crate.",
    full: () => 'You already have 50 arrows. Come back if you run low.',
  },
  {
    roomId: '306',
    slug: 'crossbow-bolt',
    mode: 'topUp',
    cap: 50,
    plural: 'bolts',
    message: () => "You take a bundle of bolts from the guard's crate.",
    full: () => 'You already have 50 bolts. Come back if you run low.',
  },
  {
    roomId: '306',
    slug: 'polearm',
    mode: 'take',
    message: () => 'You take the spare polearm off the rack and stow it in your pack.',
    full: () => 'You already have a polearm. If you lose it, come back here for another free one.',
  },
  {
    roomId: '311',
    slug: 'pickaxe',
    mode: 'take',
    message: () => 'You take a pickaxe off the trestle. It will not survive the whole mine, but it will get you started.',
    full: () => 'You already have a pickaxe. Come back if you break it — and you will break it.',
  },
  { roomId: '311', slug: 'red-potion', mode: 'topUp', cap: 5, message: (n) => `You take ${n} red potions from the miners' stores.` },
  { roomId: '311', slug: 'blue-potion', mode: 'topUp', cap: 5, message: (n) => `You take ${n} blue potions from the miners' stores.` },
  {
    roomId: '321b',
    slug: 'grotto-gloves',
    mode: 'take',
    message: () => "You lift the magical Grotto Gloves out of the statue's open hands. Look at you go.",
    full: () => 'You already have the Grotto Gloves. The statue has nothing more to give you.',
  },

  // ==================== DARK FOREST ====================
  {
    roomId: '506',
    slug: 'tea',
    mode: 'topUp',
    cap: 5,
    plural: 'cups of tea',
    message: (n) => `You pick up ${n} cup${n === 1 ? '' : 's'} o' tea from the table!`,
    full: () => 'You already have five cups of tea. Drink one first.',
  },
  {
    roomId: '507',
    slug: 'iron-hatchet',
    mode: 'take',
    message: () => 'You pick up the iron hatchet. You are too cool.',
    full: () => 'You already have an iron hatchet. Come back here for another if you lose it.',
  },
]

const SUPPLY_MODES = new Set(['take', 'topUp'])

/** Every supply a room provides, in authored order. */
function getRoomSupplies(roomId) {
  return ROOM_SUPPLIES.filter((entry) => entry.roomId === roomId)
}

/** The per-player line for an entry: `cap`, or one for a plain take. */
function supplyCap(entry) {
  return typeof entry.cap === 'number' ? entry.cap : 1
}

module.exports = { ROOM_SUPPLIES, SUPPLY_MODES, getRoomSupplies, supplyCap }
