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
 *   requiresMembership
 *            a guild id (factions.js). Members only: anyone else sees the
 *            entry locked and is refused with `joinMessage` — the original's
 *            "Join the Warrior's Guild to get the Warrior's Pack".
 *   joinMessage
 *            the refusal (and the locked pill's hint) for a non-member.
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
 *   requiresMembership?: string,
 *   joinMessage?: string,
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

// ==================== MOUNTAINS ====================
// Chilly Pete's cabin: "There is some tea available for adventurers passing
// through." Five cups, topped up, exactly the Dark Elf's rule — and, Pete
// insists, way better than the Dark Elf's.
ROOM_SUPPLIES.push({
  roomId: '609',
  slug: 'tea',
  mode: 'topUp',
  cap: 5,
  plural: 'cups of tea',
  message: (n) => `You pick up ${n} cup${n === 1 ? '' : 's'} o' tea from Chilly Pete's table!`,
  full: () => 'You already have tea! Come back if you run out.',
})

// ==================== PACKS ====================
// The original's "grab pack" buttons: one click topped each of the pack's
// items up to a floor, with a line per item ("You now have 3 reds." / "You
// have 5 meatballs."). The pack is now laid out on the floor, one top-up
// entry per item with the floor as its cap. The floors are the original's.
// A guild's pack carries the guild's badge on every entry, so the Warrior's
// Pack is still the warriors' alone — there is just no button in front of it.

/**
 * @param {{ roomId: string, label: string, requiresMembership?: string, joinMessage?: string,
 *   items: Array<{ slug: string, floor: number, name: string, plural?: string }> }} pack
 * @returns {RoomSupplyEntry[]}
 */
function packEntries({ roomId, label, requiresMembership, joinMessage, items }) {
  return items.map(({ slug, floor, name, plural }) => {
    // A floor of one is the one-each rule, and reads better in its words
    // ("come back for another if you lose it") than as a top-up to 1.
    const single = floor === 1
    return {
      roomId,
      slug,
      mode: single ? 'take' : 'topUp',
      ...(single ? {} : { cap: floor }),
      plural: plural ?? `${name}s`,
      message: single ? () => `You take a ${name} from the ${label}.` : () => `You restock ${plural ?? `${name}s`} from the ${label}.`,
      ...(requiresMembership ? { requiresMembership, joinMessage } : {}),
    }
  })
}

const RED_TOWN_GUILD_HALLS = [
  // Wizard's Guild (225): the four slots in blue.
  packEntries({
    roomId: '225',
    label: "Wizard's Pack",
    requiresMembership: 'wizards-guild',
    joinMessage: 'Join the Wizard’s Guild to claim a Wizard’s Pack. Speak to the recruiter.',
    items: [
      { slug: 'blues', floor: 3, name: 'blue', plural: 'blues' },
      { slug: 'bluefish', floor: 5, name: 'bluefish', plural: 'bluefish' },
      { slug: 'blue-potion', floor: 5, name: 'blue potion' },
      { slug: 'blue-balm', floor: 1, name: 'blue balm' },
    ],
  }),
  // Warrior's Guild (226): the same four slots in red.
  packEntries({
    roomId: '226',
    label: "Warrior's Pack",
    requiresMembership: 'warriors-guild',
    joinMessage: 'Join the Warrior’s Guild to claim a Warrior’s Pack. Speak to the recruiter.',
    items: [
      { slug: 'reds', floor: 3, name: 'red', plural: 'reds' },
      { slug: 'meatball', floor: 5, name: 'meatball' },
      { slug: 'red-potion', floor: 5, name: 'red potion' },
      { slug: 'red-balm', floor: 1, name: 'red balm' },
    ],
  }),
]

const MINING_GUILD_HALL = packEntries({
  // Mining Guild (308): potions, food, and a pickaxe to break.
  roomId: '308',
  label: 'Mining Pack',
  requiresMembership: 'mining-guild',
  joinMessage: 'Join the Mining Guild to claim a Mining Pack. Speak to the recruiter.',
  items: [
    { slug: 'red-potion', floor: 5, name: 'red potion' },
    { slug: 'blue-potion', floor: 5, name: 'blue potion' },
    { slug: 'bluefish', floor: 5, name: 'bluefish', plural: 'bluefish' },
    { slug: 'meatball', floor: 5, name: 'meatball' },
    { slug: 'pickaxe', floor: 1, name: 'pickaxe' },
  ],
})

const OCEAN_PACKS = [
  // Crocodile Island (424): Jungle Jim's colours, no badge needed.
  packEntries({
    roomId: '424',
    label: "Jungle Jim's colours",
    items: [
      { slug: 'reds', floor: 5, name: 'red', plural: 'reds' },
      { slug: 'greens', floor: 5, name: 'green', plural: 'greens' },
      { slug: 'blues', floor: 5, name: 'blue', plural: 'blues' },
      { slug: 'yellows', floor: 5, name: 'yellow', plural: 'yellows' },
    ],
  }),
  // The Master Temple (425): three of each colour and each balm. The original
  // also refilled this from "bathe in glory"; here the floor is the only source.
  packEntries({
    roomId: '425',
    label: 'Master Pack',
    items: [
      { slug: 'reds', floor: 3, name: 'red', plural: 'reds' },
      { slug: 'greens', floor: 3, name: 'green', plural: 'greens' },
      { slug: 'blues', floor: 3, name: 'blue', plural: 'blues' },
      { slug: 'yellows', floor: 3, name: 'yellow', plural: 'yellows' },
      { slug: 'red-balm', floor: 3, name: 'red balm' },
      { slug: 'blue-balm', floor: 3, name: 'blue balm' },
    ],
  }),
]

const RANGERS_GUILD_LOBBY = packEntries({
  // Ranger's Guild Lobby (515a): a hundred arrows and the field kit.
  roomId: '515a',
  label: "Ranger's Pack",
  requiresMembership: 'rangers-guild',
  joinMessage: "Join the Ranger's Guild to claim a Ranger's Pack. Defeat a Dark Ranger and speak to the guard at the ladder.",
  items: [
    { slug: 'arrow', floor: 100, name: 'arrow' },
    { slug: 'greens', floor: 3, name: 'green', plural: 'greens' },
    { slug: 'red-balm', floor: 3, name: 'red balm' },
    { slug: 'blue-balm', floor: 3, name: 'blue balm' },
  ],
})

ROOM_SUPPLIES.push(...RED_TOWN_GUILD_HALLS.flat(), ...MINING_GUILD_HALL, ...OCEAN_PACKS.flat(), ...RANGERS_GUILD_LOBBY)

/** Every supply a room provides, in authored order. */
function getRoomSupplies(roomId) {
  return ROOM_SUPPLIES.filter((entry) => entry.roomId === roomId)
}

/** The per-player line for an entry: `cap`, or one for a plain take. */
function supplyCap(entry) {
  return typeof entry.cap === 'number' ? entry.cap : 1
}

module.exports = { ROOM_SUPPLIES, SUPPLY_MODES, getRoomSupplies, supplyCap }
