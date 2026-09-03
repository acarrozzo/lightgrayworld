/**
 * Crafting recipes — the single source of truth shared by the client crafting
 * sheet (which reads it to render availability) and the server `craft` action
 * handler (which re-validates and atomically consumes inputs / grants output).
 *
 * Authored as plain JS (with JSDoc types) so the Node game engine can
 * `require()` it directly, exactly like enemies.js / constants.js, while the
 * TypeScript client imports it for types via allowJs.
 *
 * What a recipe carries is deliberately thin: slugs and quantities, the family
 * it belongs to, and how it batches. Icons, stat lines, descriptions and stack
 * caps come from the ItemTemplate the slug names (the sheet fetches those once
 * from /api/game/recipes), so the row for a crafted bow reads exactly like the
 * row for the same bow in the bag or the shop, and nothing here can drift from
 * the item. Ingredient/output `name` is kept only as a fallback label while
 * templates are still loading.
 *
 * @typedef {Object} RecipeIngredient
 * @property {string} slug  Item template slug consumed.
 * @property {number} qty   Quantity consumed per craft.
 * @property {string} name  Fallback display name.
 *
 * @typedef {Object} RecipeOutput
 * @property {string} slug  Item template slug produced.
 * @property {number} qty   Quantity produced per craft.
 * @property {string} name  Fallback display name.
 *
 * @typedef {Object} RecipeTool
 * @property {string} slug  Item template slug that must be held (not consumed).
 * @property {string} name  Display name shown on the row and in the refusal.
 * @property {string[]} [anyOf] Slugs that satisfy the requirement in place of
 *                            `slug` — a better tool standing in for the named
 *                            one (a steel hammer works iron).
 *
 * @typedef {Object} RecipeUnlock
 * @property {string} questId  Quest that must have been started or completed.
 * @property {boolean} [requireCompleted] When true, merely accepting the quest is
 *                            not enough — it must be turned in.
 * @property {string} hint     One line telling the player where to unlock it.
 *
 * @typedef {'cook' | 'potions' | 'wood' | 'leather' | 'iron' | 'tools'} CraftingFamilyId
 *
 * @typedef {Object} Recipe
 * @property {string} id          Stable recipe id (sent from client → server).
 * @property {string} label       Display name of the recipe ("Arrows", not "Arrow").
 * @property {CraftingFamilyId} family  Material family the sheet groups it under.
 * @property {'all' | 'one'} batch  How the row's one button behaves: `all`
 *                            crafts as many as the bag allows in one tap (the
 *                            original's "craft all red potion"); `one` crafts a
 *                            single item, with a stepper in the drawer.
 * @property {'fire' | 'crafting-table' | 'forge'} station  What does the work:
 *                            a fire cooks, a table makes, a forge works iron.
 * @property {string} [effect]    Short row label for outputs whose template has
 *                            no stat mods or consumable effect to read (ammo,
 *                            mounts, tools).
 * @property {string} [blurb]     One line of flavour shown in the drawer.
 * @property {RecipeTool} [tool]  Tool that must be in the player's inventory to run it.
 * @property {RecipeUnlock} [unlock] Quest that has to be underway before it can be run.
 * @property {RecipeIngredient[]} inputs
 * @property {RecipeOutput} output
 *
 * @typedef {Object} CraftingFamily
 * @property {CraftingFamilyId} id
 * @property {string} label  Chip and section label.
 */

/**
 * Where crafting happens, and what each place works. The original let you build
 * a table and a fire in any room; here each station is authored, the way the
 * rooms describe themselves: the Old Man's cooking fire, the Shaman's potion
 * table, Jack's wood workshop, Freddie's leather bench, the Mining Guild forge,
 * and the Grand Square's all-purpose table and fire. (The seed's hasFire /
 * hasCraftingTable columns are not what gates this; this table is.)
 *
 * A recipe is available in a room when the room works its family AND has the
 * kind of station it needs (`recipe.station`): that is what keeps the iron
 * tools at the forge while the stone ones travel with the wood bench. Table
 * order matters — it is the order the sheet names a recipe's home when it is
 * made elsewhere, so the Grand Square comes last as the fallback mention.
 *
 * @typedef {Object} CraftingStation
 * @property {string} label    Sheet title ("Cooking Fire", "Forge").
 * @property {string} button   Room action label ("Cook", "Mix Potions").
 * @property {string} icon     Room action icon.
 * @property {string} where    How the sheet names the place: "the Old Man's cabin".
 * @property {string} made     Participle for the pointer line: "cooked at …".
 * @property {Array<'fire' | 'crafting-table' | 'forge'>} stations  What the room has.
 * @property {CraftingFamilyId[]} families  What the room works.
 *
 * @type {Record<string, CraftingStation>}
 */
const CRAFTING_STATIONS = {
  '003': { label: 'Cooking Fire', button: 'Cook', icon: 'fire', where: "the Old Man's cabin", made: 'cooked', stations: ['fire'], families: ['cook'] },
  '021': { label: 'Potion Table', button: 'Mix Potions', icon: 'red-potion', where: "the Pajama Shaman's tent", made: 'mixed', stations: ['crafting-table'], families: ['potions'] },
  '024': { label: 'Wood Workshop', button: 'Woodwork', icon: 'axelog', where: "Jack Lumber's workshop", made: 'made', stations: ['crafting-table'], families: ['wood', 'tools'] },
  '103': { label: 'Leather Bench', button: 'Work Leather', icon: 'craft', where: "Freddie's Cow Farm", made: 'worked', stations: ['crafting-table'], families: ['leather'] },
  '308': { label: 'Forge', button: 'Forge', icon: 'craft', where: 'the Mining Guild forge', made: 'forged', stations: ['forge', 'crafting-table'], families: ['iron', 'tools'] },
  '210': { label: 'Crafting Table', button: 'Open Crafting', icon: 'craft', where: "Red Town's Grand Square", made: 'made', stations: ['fire', 'crafting-table'], families: ['cook', 'potions', 'wood', 'leather', 'tools'] },
}

/**
 * Room ids with a station, in the order the sheet names a recipe's home when it
 * is made elsewhere. Spelled out rather than taken from the table's keys: JS
 * orders numeric-looking keys ('103', '210') ahead of zero-padded ones ('003').
 */
const CRAFTING_ROOMS = ['003', '021', '024', '103', '308', '210']

/**
 * Material families, in the order the original craft screen listed them:
 * Cook, Potions, Wood, Leather, Iron, Tools. The sheet groups rows under these
 * and collapses a family the player has not unlocked to one line.
 * @type {CraftingFamily[]}
 */
const CRAFTING_FAMILIES = [
  { id: 'cook', label: 'Cook' },
  { id: 'potions', label: 'Potions' },
  { id: 'wood', label: 'Wood' },
  { id: 'leather', label: 'Leather' },
  { id: 'iron', label: 'Iron' },
  { id: 'tools', label: 'Tools' },
]

/**
 * Jack Lumber's lesson. The original locked the whole craft screen until you
 * had met him ("What's craft? You should talk to Jack Lumber"); here cooking
 * and potions stay open from the start and it is gear, ammo, mounts and tools
 * that wait for him. His woodworking quest is started the moment his intro is
 * turned in, so "started" is the same instant as "met Jack".
 */
const JACK_UNLOCK = {
  questId: 'quest_jacklumber_001',
  hint: 'Talk to Jack Lumber at his cabin north of the Forest Gate to learn how to craft.',
}

/** Shared by every leather recipe — one tool, one unlock, declared once. */
const LEATHER_TOOL = { slug: 'hammer', name: 'Hammer' }
const LEATHER_UNLOCK = {
  questId: 'quest_freddie_intro',
  hint: "To craft with leather, find Freddie's Cow Farm on the Forest Path.",
}

/**
 * Shared by every iron recipe. `anyOf` is the original's own rule: the check was
 * `ironhammer >= 1 || steelhammer >= 1 || mithrilhammer >= 1`, so a better
 * hammer never stopped you working a softer metal.
 */
const IRON_HAMMER = {
  slug: 'iron-hammer',
  name: 'Iron Hammer',
  anyOf: ['steel-hammer', 'mithril-hammer'],
}
const IRON_UNLOCK = {
  questId: 'quest_miningguild_001',
  requireCompleted: true,
  hint: 'To craft with iron, defeat the Phoenix at Mine Level 10 for the Mining Guild.',
}

const WOOD = (qty) => ({ slug: 'wood', qty, name: 'Wood' })
const STONE = (qty) => ({ slug: 'stone', qty, name: 'Stone' })
const IRON = (qty) => ({ slug: 'iron', qty, name: 'Iron' })
const LEATHER = (qty) => ({ slug: 'leather', qty, name: 'Leather' })
const GRAY_MATTER = { slug: 'gray-matter', qty: 1, name: 'Gray Matter' }

/** @type {Recipe[]} */
const CRAFTING_RECIPES = [
  // ==================== COOK ====================
  {
    id: 'cook-meat',
    label: 'Cooked Meat',
    family: 'cook',
    batch: 'all',
    station: 'fire',
    blurb: 'Cook raw meat over the fire into a hearty meal.',
    inputs: [{ slug: 'raw-meat', qty: 1, name: 'Raw Meat' }],
    output: { slug: 'cooked-meat', qty: 1, name: 'Cooked Meat' },
  },
  {
    id: 'bread',
    label: 'Bread',
    family: 'cook',
    batch: 'all',
    station: 'fire',
    blurb: 'Grind wheat and bake it into bread.',
    inputs: [{ slug: 'wheat', qty: 2, name: 'Wheat' }],
    output: { slug: 'bread', qty: 1, name: 'Bread' },
  },
  {
    // The Town Hall Plaza chef's recipe. "Cookin up some Meat-a-balls" ends with
    // him walking you through it start to finish and the quest already says you
    // leave with the recipe in your head — this is that recipe. Five cooked meat
    // for one 400 HP meatball, as the original priced it, and locked until the
    // turn-in is done rather than merely accepted: he has not taught you anything
    // until you have handed the meat over.
    id: 'meatball',
    label: 'Meatball',
    family: 'cook',
    batch: 'all',
    station: 'fire',
    blurb: 'Roll and fry five pieces of cooked meat the way the Red Town chef showed you.',
    unlock: {
      questId: 'quest_townhallplaza_002',
      requireCompleted: true,
      hint: 'Find the Red Town chef in the Town Hall Plaza to learn how to cook meatballs.',
    },
    inputs: [{ slug: 'cooked-meat', qty: 5, name: 'Cooked Meat' }],
    output: { slug: 'meatball', qty: 1, name: 'Meatball' },
  },

  // ==================== POTIONS ====================
  // Purple potions and the three balms wait for their teachers (the Traveling
  // Wizard and the Stone Mountain shaman), neither of whom is ported yet.
  {
    id: 'red-potion',
    label: 'Red Potion',
    family: 'potions',
    batch: 'all',
    station: 'crafting-table',
    blurb: 'Crush redberries into a healing potion.',
    inputs: [{ slug: 'redberry', qty: 5, name: 'Redberry' }],
    output: { slug: 'red-potion', qty: 1, name: 'Red Potion' },
  },
  {
    id: 'blue-potion',
    label: 'Blue Potion',
    family: 'potions',
    batch: 'all',
    station: 'crafting-table',
    blurb: 'Crush blueberries into a mana potion.',
    inputs: [{ slug: 'blueberry', qty: 5, name: 'Blueberry' }],
    output: { slug: 'blue-potion', qty: 1, name: 'Blue Potion' },
  },

  // ==================== WOOD ====================
  // Jack Lumber's tier, in the order his original list ran: bo, bow, staff,
  // shield, arrows, boat. The bow takes five wood and a length of string as it
  // did in 2016 — the string lies in the Bat Cave's Abandoned Workshop, the same
  // room that stocked it then. Unlike the original, a plain hammer is only
  // needed for the boat.
  {
    id: 'wooden-bo',
    label: 'Wooden Bo',
    family: 'wood',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'A long staff of hardwood, cut and sanded to a fighting length.',
    unlock: JACK_UNLOCK,
    inputs: [WOOD(7)],
    output: { slug: 'wooden-bo', qty: 1, name: 'Wooden Bo' },
  },
  {
    id: 'wooden-bow',
    label: 'Wooden Bow',
    family: 'wood',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'Carve a simple bow from wood and string it. Effective against flying enemies.',
    unlock: JACK_UNLOCK,
    inputs: [WOOD(5), { slug: 'string', qty: 1, name: 'String' }],
    output: { slug: 'wooden-bow', qty: 1, name: 'Wooden Bow' },
  },
  {
    id: 'wooden-staff',
    label: 'Wooden Staff',
    family: 'wood',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'A walking staff with carvings that hum faintly when you hold it.',
    unlock: JACK_UNLOCK,
    inputs: [WOOD(7)],
    output: { slug: 'wooden-staff', qty: 1, name: 'Wooden Staff' },
  },
  {
    id: 'wooden-shield',
    label: 'Wooden Shield',
    family: 'wood',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'Planks pegged together and faced with stone.',
    unlock: JACK_UNLOCK,
    inputs: [WOOD(5), STONE(2)],
    output: { slug: 'wooden-shield', qty: 1, name: 'Wooden Shield' },
  },
  {
    id: 'arrow',
    label: 'Arrows',
    family: 'wood',
    batch: 'all',
    station: 'crafting-table',
    effect: 'Bow ammo',
    blurb: 'Shave a shaft and knap a tip. Ten arrows from one piece of each.',
    unlock: JACK_UNLOCK,
    inputs: [WOOD(1), STONE(1)],
    output: { slug: 'arrow', qty: 10, name: 'Arrow' },
  },
  {
    id: 'wooden-boat',
    label: 'Wooden Boat',
    family: 'wood',
    batch: 'one',
    station: 'crafting-table',
    effect: 'Mount · crosses the Blue Ocean',
    blurb: 'Twenty wood and a hammer. Ride it as your mount and the Blue Ocean is open, west of the beach.',
    unlock: JACK_UNLOCK,
    tool: { slug: 'hammer', name: 'Hammer' },
    inputs: [WOOD(20)],
    output: { slug: 'wooden-boat', qty: 1, name: 'Wooden Boat' },
  },

  // ==================== LEATHER ====================
  // Freddie's tier. Every piece needs a hammer in hand and his quest underway —
  // the original hid this whole block behind "To Craft w/ Leather find Freddie's
  // Cow Farm" and "Need Hammer!", which is what makes the cow farm a place you
  // have to find rather than a shop you can skip. Leather costs are the original's.
  {
    id: 'leather-hood',
    label: 'Leather Hood',
    family: 'leather',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'Cut and stitch a hood from cured hide.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [LEATHER(3)],
    output: { slug: 'leather-hood', qty: 1, name: 'Leather Hood' },
  },
  {
    id: 'leather-gloves',
    label: 'Leather Gloves',
    family: 'leather',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'A pair of working gloves, cut from the same hide.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [LEATHER(3)],
    output: { slug: 'leather-gloves', qty: 1, name: 'Leather Gloves' },
  },
  {
    id: 'leather-boots',
    label: 'Leather Boots',
    family: 'leather',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'Sole, upper, and enough stitching to walk a forest in.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [LEATHER(3)],
    output: { slug: 'leather-boots', qty: 1, name: 'Leather Boots' },
  },
  {
    id: 'leather-helmet',
    label: 'Leather Helmet',
    family: 'leather',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'Hardened hide, boiled and beaten into a helmet.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [LEATHER(5)],
    output: { slug: 'leather-helmet', qty: 1, name: 'Leather Helmet' },
  },
  {
    id: 'leather-vest',
    label: 'Leather Vest',
    family: 'leather',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'Light, supple, and cut to keep you moving.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [LEATHER(7)],
    output: { slug: 'leather-vest', qty: 1, name: 'Leather Vest' },
  },
  {
    id: 'leather-armor',
    label: 'Leather Armor',
    family: 'leather',
    batch: 'one',
    station: 'crafting-table',
    blurb: 'The full suit. Ten hides and most of an afternoon.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [LEATHER(10)],
    output: { slug: 'leather-armor', qty: 1, name: 'Leather Armor' },
  },

  // ==================== IRON ====================
  // The Mining Guild's tier, and the reason to join it. Unlocked by putting the
  // Phoenix down at Mine Level 10 — the Guild Leader hands you the iron hammer
  // with the technique, and a steel or mithril hammer works iron just as well.
  // Listed as the original's forge did: 1h, 2h, ranged, shields, armour.
  {
    id: 'iron-dagger',
    label: 'Iron Dagger',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(1), WOOD(1)],
    output: { slug: 'iron-dagger', qty: 1, name: 'Iron Dagger' },
  },
  {
    id: 'iron-sword',
    label: 'Iron Sword',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(7), WOOD(1)],
    output: { slug: 'iron-sword', qty: 1, name: 'Iron Sword' },
  },
  {
    id: 'iron-staff',
    label: 'Iron Staff',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(7), WOOD(1)],
    output: { slug: 'iron-staff', qty: 1, name: 'Iron Staff' },
  },
  {
    id: 'iron-maul',
    label: 'Iron Maul',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(10), WOOD(1)],
    output: { slug: 'iron-maul', qty: 1, name: 'Iron Maul' },
  },
  {
    id: 'iron-2h-sword',
    label: 'Iron 2H Sword',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(15), WOOD(1)],
    output: { slug: 'iron-2h-sword', qty: 1, name: 'Iron 2H Sword' },
  },
  {
    id: 'iron-battle-staff',
    label: 'Iron Battle Staff',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(15), WOOD(1)],
    output: { slug: 'iron-battle-staff', qty: 1, name: 'Iron Battle Staff' },
  },
  {
    id: 'iron-nunchaku',
    label: 'Iron Nunchaku',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(10), GRAY_MATTER],
    output: { slug: 'iron-nunchaku', qty: 1, name: 'Iron Nunchaku' },
  },
  {
    id: 'iron-boomerang',
    label: 'Iron Boomerang',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(5), WOOD(1)],
    output: { slug: 'iron-boomerang', qty: 1, name: 'Iron Boomerang' },
  },
  {
    id: 'iron-bow',
    label: 'Iron Bow',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(7), WOOD(1)],
    output: { slug: 'iron-bow', qty: 1, name: 'Iron Bow' },
  },
  {
    id: 'iron-crossbow',
    label: 'Iron Crossbow',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(10), WOOD(1)],
    output: { slug: 'iron-crossbow', qty: 1, name: 'Iron Crossbow' },
  },
  {
    id: 'iron-chakram',
    label: 'Iron Chakram',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(7), GRAY_MATTER],
    output: { slug: 'iron-chakram', qty: 1, name: 'Iron Chakram' },
  },
  {
    id: 'iron-shield',
    label: 'Iron Shield',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(10)],
    output: { slug: 'iron-shield', qty: 1, name: 'Iron Shield' },
  },
  {
    id: 'iron-kite-shield',
    label: 'Iron Kite Shield',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(15)],
    output: { slug: 'iron-kite-shield', qty: 1, name: 'Iron Kite Shield' },
  },
  {
    id: 'iron-helmet',
    label: 'Iron Helmet',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(5)],
    output: { slug: 'iron-helmet', qty: 1, name: 'Iron Helmet' },
  },
  {
    id: 'iron-hood',
    label: 'Iron Hood',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(3)],
    output: { slug: 'iron-hood', qty: 1, name: 'Iron Hood' },
  },
  {
    id: 'iron-armor',
    label: 'Iron Armor',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(10)],
    output: { slug: 'iron-armor', qty: 1, name: 'Iron Armor' },
  },
  {
    id: 'iron-cape',
    label: 'Iron Cape',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(7)],
    output: { slug: 'iron-cape', qty: 1, name: 'Iron Cape' },
  },
  {
    id: 'iron-gauntlets',
    label: 'Iron Gauntlets',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(5)],
    output: { slug: 'iron-gauntlets', qty: 1, name: 'Iron Gauntlets' },
  },
  {
    id: 'iron-gloves',
    label: 'Iron Gloves',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(3)],
    output: { slug: 'iron-gloves', qty: 1, name: 'Iron Gloves' },
  },
  {
    id: 'iron-boots',
    label: 'Iron Boots',
    family: 'iron',
    batch: 'one',
    station: 'forge',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(3)],
    output: { slug: 'iron-boots', qty: 1, name: 'Iron Boots' },
  },

  // ==================== TOOLS ====================
  // Three stone and a length of wood, once Jack has shown you how — they matter
  // more now that the Neverending Mine breaks a pickaxe roughly every fifty
  // swings. The iron tools follow the iron tier.
  {
    id: 'hatchet',
    label: 'Hatchet',
    family: 'tools',
    batch: 'one',
    station: 'crafting-table',
    effect: 'Chops wood',
    blurb: 'A stone-headed hatchet for felling trees.',
    unlock: JACK_UNLOCK,
    inputs: [STONE(3), WOOD(1)],
    output: { slug: 'hatchet', qty: 1, name: 'Hatchet' },
  },
  {
    id: 'pickaxe',
    label: 'Pickaxe',
    family: 'tools',
    batch: 'one',
    station: 'crafting-table',
    effect: 'Mines stone',
    blurb: 'Knap a stone head onto a haft. Mines stone, and nothing harder.',
    unlock: JACK_UNLOCK,
    inputs: [STONE(3), WOOD(1)],
    output: { slug: 'pickaxe', qty: 1, name: 'Pickaxe' },
  },
  {
    id: 'hammer',
    label: 'Hammer',
    family: 'tools',
    batch: 'one',
    station: 'crafting-table',
    effect: 'Works leather and builds the boat',
    blurb: 'A plain forge hammer. Needed to work leather.',
    unlock: JACK_UNLOCK,
    inputs: [STONE(3), WOOD(1)],
    output: { slug: 'hammer', qty: 1, name: 'Hammer' },
  },
  {
    id: 'iron-hatchet',
    label: 'Iron Hatchet',
    family: 'tools',
    batch: 'one',
    station: 'forge',
    effect: 'Chops twice the wood',
    blurb: 'Bites deeper than a plain hatchet, and brings back twice the wood.',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(3), WOOD(1)],
    output: { slug: 'iron-hatchet', qty: 1, name: 'Iron Hatchet' },
  },
  {
    id: 'iron-pickaxe',
    label: 'Iron Pickaxe',
    family: 'tools',
    batch: 'one',
    station: 'forge',
    effect: 'Mines iron and stone',
    blurb: 'Frees the iron a plain pick only scratches.',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [IRON(3), WOOD(1)],
    output: { slug: 'iron-pickaxe', qty: 1, name: 'Iron Pickaxe' },
  },
  {
    // The one iron recipe that asks for no hammer, so a player who loses theirs
    // can forge a replacement rather than being locked out of their own tier.
    id: 'iron-hammer',
    label: 'Iron Hammer',
    family: 'tools',
    batch: 'one',
    station: 'forge',
    effect: 'Works iron at a forge',
    blurb: 'A replacement forge hammer, in case the first one goes missing.',
    unlock: IRON_UNLOCK,
    inputs: [IRON(3), WOOD(1)],
    output: { slug: 'iron-hammer', qty: 1, name: 'Iron Hammer' },
  },
]

/** Fast lookup by recipe id. */
const RECIPE_BY_ID = CRAFTING_RECIPES.reduce((acc, recipe) => {
  acc[recipe.id] = recipe
  return acc
}, /** @type {Record<string, Recipe>} */ ({}))

/**
 * The station in a room, or null where there is none.
 * @param {string} roomId
 * @returns {CraftingStation | null}
 */
function getCraftingStation(roomId) {
  return Object.prototype.hasOwnProperty.call(CRAFTING_STATIONS, roomId) ? CRAFTING_STATIONS[roomId] : null
}

/**
 * Whether crafting is available in the given room.
 * @param {string} roomId
 * @returns {boolean}
 */
function isCraftingRoom(roomId) {
  return getCraftingStation(roomId) !== null
}

/**
 * Whether a room's station works this recipe: the family is one the room
 * works, and the room has the kind of station the recipe needs.
 * @param {Recipe} recipe
 * @param {string} roomId
 * @returns {boolean}
 */
function isRecipeAvailableInRoom(recipe, roomId) {
  const station = getCraftingStation(roomId)
  return station !== null && station.families.includes(recipe.family) && station.stations.includes(recipe.station)
}

/**
 * Recipes the given room can make.
 * @param {string} roomId
 * @returns {Recipe[]}
 */
function getRecipesForRoom(roomId) {
  return CRAFTING_RECIPES.filter((recipe) => isRecipeAvailableInRoom(recipe, roomId))
}

/**
 * Where a recipe is made, as the sheet's pointer line and the server's refusal
 * say it: "Mixed at the Pajama Shaman's tent." The first station in table
 * order that works it, so a recipe's own room is named before the Grand Square.
 * @param {Recipe} recipe
 * @returns {string | null}
 */
function whereToCraft(recipe) {
  for (const roomId of CRAFTING_ROOMS) {
    if (!isRecipeAvailableInRoom(recipe, roomId)) continue
    const station = CRAFTING_STATIONS[roomId]
    return `${station.made.charAt(0).toUpperCase()}${station.made.slice(1)} at ${station.where}.`
  }
  return null
}

/**
 * Rooms that work a family, in table order.
 * @param {CraftingFamilyId} familyId
 * @returns {string[]}
 */
function getFamilyRooms(familyId) {
  return CRAFTING_ROOMS.filter((roomId) => CRAFTING_STATIONS[roomId].families.includes(familyId))
}

/**
 * Look up a single recipe by id.
 * @param {string} recipeId
 * @returns {Recipe | null}
 */
function getRecipeById(recipeId) {
  return RECIPE_BY_ID[recipeId] || null
}

/**
 * Recipes that consume or require the given item, in list order. The bag uses
 * this so a material's row can say what it makes.
 * @param {string} slug
 * @returns {Recipe[]}
 */
function getRecipesUsing(slug) {
  return CRAFTING_RECIPES.filter(
    (recipe) =>
      recipe.inputs.some((input) => input.slug === slug) ||
      (recipe.tool != null && (recipe.tool.slug === slug || (recipe.tool.anyOf ?? []).includes(slug)))
  )
}

/**
 * Every item template slug a recipe refers to — inputs, outputs and tools — so
 * the sheet can fetch their templates in one request.
 * @returns {string[]}
 */
function getRecipeSlugs() {
  const slugs = new Set()
  for (const recipe of CRAFTING_RECIPES) {
    for (const input of recipe.inputs) slugs.add(input.slug)
    slugs.add(recipe.output.slug)
    if (recipe.tool) {
      slugs.add(recipe.tool.slug)
      for (const slug of recipe.tool.anyOf ?? []) slugs.add(slug)
    }
  }
  return [...slugs]
}

/** Item names that do not take a plural: "12 Wood", "4 Cooked Meat". */
const MASS_NOUNS = new Set([
  'wood', 'stone', 'leather', 'iron', 'wheat', 'bread', 'cooked meat', 'raw meat',
  'gray matter', 'coal', 'sand', 'mud', 'water', 'mithril', 'steel', 'glass',
])

/**
 * "10 Arrows", "1 Wood", "3 Red Potions", "5 Redberries". Shared by the feed
 * line the server writes and the row labels the sheet renders.
 * @param {number} qty
 * @param {string} name
 * @returns {string}
 */
function countNoun(qty, name) {
  const lower = name.toLowerCase()
  if (qty === 1 || MASS_NOUNS.has(lower) || /[sx]$/i.test(name)) return `${qty} ${name}`
  if (/[^aeiou]y$/i.test(name)) return `${qty} ${name.slice(0, -1)}ies`
  return `${qty} ${name}s`
}

/**
 * The feed line for a finished craft, naming what went in as the original's
 * messages did ("You craft a WOODEN BOW out of 5 wood and 1 string").
 * @param {Recipe} recipe
 * @param {string} outputName   Template name of what was made.
 * @param {number} crafted      Total items produced.
 * @param {number} batches      How many times the recipe ran.
 * @param {{ name: string, qty: number }[]} consumed  Per-batch inputs by template name.
 * @returns {string}
 */
function describeCraft(recipe, outputName, crafted, batches, consumed) {
  const inputs = consumed.map(({ name, qty }) => countNoun(qty * batches, name)).join(' and ')
  if (recipe.family === 'cook') {
    return `You cook ${inputs} over the fire into ${countNoun(crafted, outputName)}.`
  }
  return `You craft ${countNoun(crafted, outputName)} from ${inputs}.`
}

/**
 * The typed `craft list` command: one line per family with where it is made
 * and every recipe's cost, the way the original's help command printed it.
 * @returns {string[]}
 */
function formatRecipeList() {
  return CRAFTING_FAMILIES.map((family) => {
    const where = getFamilyRooms(family.id).map((roomId) => CRAFTING_STATIONS[roomId].where).join(' or ')
    const entries = CRAFTING_RECIPES.filter((recipe) => recipe.family === family.id).map((recipe) => {
      const cost = recipe.inputs.map((input) => countNoun(input.qty, input.name.toLowerCase())).join(' + ')
      const tool = recipe.tool ? ` (needs ${recipe.tool.name.toLowerCase()})` : ''
      return `${recipe.label}: ${cost}${tool}`
    })
    return `${family.label} (${where}) — ${entries.join('; ')}`
  })
}

module.exports = {
  CRAFTING_ROOMS,
  CRAFTING_STATIONS,
  CRAFTING_FAMILIES,
  CRAFTING_RECIPES,
  getCraftingStation,
  isCraftingRoom,
  isRecipeAvailableInRoom,
  getRecipesForRoom,
  whereToCraft,
  getFamilyRooms,
  getRecipeById,
  getRecipesUsing,
  getRecipeSlugs,
  countNoun,
  describeCraft,
  formatRecipeList,
}
