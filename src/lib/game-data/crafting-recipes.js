/**
 * Crafting recipes — the single source of truth shared by the client crafting
 * panel (which reads it to render availability) and the server `craft` action
 * handler (which re-validates and atomically consumes inputs / grants output).
 *
 * Authored as plain JS (with JSDoc types) so the Node game engine can
 * `require()` it directly, exactly like enemies.js / constants.js, while the
 * TypeScript client imports it for types via allowJs.
 *
 * Ingredient/output `name` + `icon` are duplicated here (rather than read from
 * the DB) so the panel can render a recipe — including its missing inputs —
 * without an inventory entry or a server round-trip. Quantities and slugs are
 * what the server validates against; name/icon are display-only.
 *
 * @typedef {Object} RecipeIngredient
 * @property {string} slug  Item template slug consumed.
 * @property {number} qty   Quantity consumed per craft.
 * @property {string} name  Display name.
 * @property {string} icon  Icon name.
 *
 * @typedef {Object} RecipeOutput
 * @property {string} slug    Item template slug produced.
 * @property {number} qty     Quantity produced per craft.
 * @property {string} name    Display name.
 * @property {string} [effect] Short effect line shown on the card (e.g. "Restores 50 HP").
 * @property {number} [max]   Output's stack cap (mirrors the seed) so the client
 *                            can clamp the "Craft All" count; the server clamps too.
 *
 * @typedef {Object} RecipeTool
 * @property {string} slug  Item template slug that must be held (not consumed).
 * @property {string} name  Display name shown on the card and in the refusal.
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
 * @typedef {Object} Recipe
 * @property {string} id          Stable recipe id (sent from client → server).
 * @property {string} label       Display name shown on the recipe card.
 * @property {string} outputIcon  Icon name for the produced item.
 * @property {string} station     Crafting station this recipe belongs to (see CRAFTING_STATIONS).
 * @property {string} [blurb]     Optional one-line flavor / description.
 * @property {RecipeTool} [tool]  Tool that must be in the player's inventory to run it.
 * @property {RecipeUnlock} [unlock] Quest that has to be underway before it can be run.
 * @property {RecipeIngredient[]} inputs
 * @property {RecipeOutput} output
 *
 * @typedef {Object} CraftingStation
 * @property {string} id     Station id matched against Recipe.station.
 * @property {string} label  Minimal section header shown above its recipes.
 * @property {string} icon   Icon name for the section header.
 */

/**
 * Rooms where the crafting panel is available.
 *
 * 210 is Red Town's Grand Square, which seeds `hasFire` and `hasCraftingTable`,
 * renders an "Open Crafting" button and registers a `craft` handler — but was
 * missing from this list, so every craft attempted there was refused with "You
 * cannot craft that here."
 *
 * 308 is the Mining Guild forge in the Rocky Flats. Any crafting fire works iron
 * once the Guild Leader has taught you how, exactly as in the original — the
 * guild's own forge is simply the one you are standing next to when he does.
 */
const CRAFTING_ROOMS = ['003', '021', '024', '210', '308']

/**
 * Crafting stations, in display order. Recipes are grouped under these as
 * sections in the panel; each recipe declares its `station`.
 * @type {CraftingStation[]}
 */
const CRAFTING_STATIONS = [
  { id: 'fire', label: 'Fire', icon: 'fire' },
  { id: 'crafting-table', label: 'Crafting Table', icon: 'craft' },
]

/** Shared by every leather recipe — one tool, one unlock, declared once. */
const LEATHER_TOOL = { slug: 'hammer', name: 'Hammer' }

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
const LEATHER_UNLOCK = {
  questId: 'quest_freddie_intro',
  hint: "To craft with leather, find Freddie's Cow Farm on the Forest Path.",
}

/** @type {Recipe[]} */
const CRAFTING_RECIPES = [
  {
    id: 'red-potion',
    label: 'Red Potion',
    outputIcon: 'red-potion',
    station: 'crafting-table',
    blurb: 'Crush redberries into a healing potion.',
    inputs: [{ slug: 'redberry', qty: 5, name: 'Redberry', icon: 'redberry' }],
    output: { slug: 'red-potion', qty: 1, name: 'Red Potion', effect: 'Restores 100 HP', max: 99 },
  },
  {
    id: 'blue-potion',
    label: 'Blue Potion',
    outputIcon: 'blue-potion',
    station: 'crafting-table',
    blurb: 'Crush blueberries into a mana potion.',
    inputs: [{ slug: 'blueberry', qty: 5, name: 'Blueberry', icon: 'blueberry' }],
    output: { slug: 'blue-potion', qty: 1, name: 'Blue Potion', effect: 'Restores 100 MP', max: 99 },
  },
  {
    id: 'cook-meat',
    label: 'Cooked Meat',
    outputIcon: 'cooked-meat',
    station: 'fire',
    blurb: 'Cook raw meat over the fire into a hearty meal.',
    inputs: [{ slug: 'raw-meat', qty: 1, name: 'Raw Meat', icon: 'uncooked-meat' }],
    output: { slug: 'cooked-meat', qty: 1, name: 'Cooked Meat', effect: 'Restores 50 HP', max: 999 },
  },
  {
    id: 'wooden-bow',
    label: 'Wooden Bow',
    outputIcon: 'wooden-bow',
    station: 'crafting-table',
    blurb: 'Carve a simple bow from wood. Effective against flying enemies.',
    inputs: [{ slug: 'wood', qty: 3, name: 'Wood', icon: 'wood' }],
    output: { slug: 'wooden-bow', qty: 1, name: 'Wooden Bow', effect: 'Ranged weapon', max: 999 },
  },
  {
    id: 'arrow',
    label: 'Arrows',
    outputIcon: 'arrow',
    station: 'crafting-table',
    blurb: 'Shave a shaft and knap a tip. Ten arrows from one piece of each.',
    inputs: [
      { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' },
      { slug: 'stone', qty: 1, name: 'Stone', icon: 'stone' },
    ],
    output: { slug: 'arrow', qty: 10, name: 'Arrow', effect: 'Bow ammo', max: 999 },
  },
  {
    id: 'bread',
    label: 'Bread',
    outputIcon: 'meatball',
    station: 'fire',
    blurb: 'Grind wheat and bake it into bread.',
    inputs: [{ slug: 'wheat', qty: 2, name: 'Wheat', icon: 'flower' }],
    output: { slug: 'bread', qty: 1, name: 'Bread', effect: 'Restores 15 HP', max: 999 },
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
    outputIcon: 'steak',
    station: 'fire',
    blurb: "Roll and fry five pieces of cooked meat the way the Red Town chef showed you.",
    unlock: {
      questId: 'quest_townhallplaza_002',
      requireCompleted: true,
      hint: 'Find the Red Town chef in the Town Hall Plaza to learn how to cook meatballs.',
    },
    inputs: [{ slug: 'cooked-meat', qty: 5, name: 'Cooked Meat', icon: 'cooked-meat' }],
    output: { slug: 'meatball', qty: 1, name: 'Meatball', effect: 'Restores 400 HP', max: 99 },
  },

  // ---- Leather working ----
  // Freddie's tier. Every piece needs a hammer in hand and his quest underway —
  // the original hid this whole block behind "To Craft w/ Leather find Freddie's
  // Cow Farm" and "Need Hammer!", which is what makes the cow farm a place you
  // have to find rather than a shop you can skip. Leather costs and stat lines
  // are the original's.
  {
    id: 'leather-hood',
    label: 'Leather Hood',
    outputIcon: 'leather-hood',
    station: 'crafting-table',
    blurb: 'Cut and stitch a hood from cured hide.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [{ slug: 'leather', qty: 3, name: 'Leather', icon: 'leather' }],
    output: { slug: 'leather-hood', qty: 1, name: 'Leather Hood', effect: '+4 DEX, +4 DEF', max: 999 },
  },
  {
    id: 'leather-gloves',
    label: 'Leather Gloves',
    outputIcon: 'leather-gloves',
    station: 'crafting-table',
    blurb: 'A pair of working gloves, cut from the same hide.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [{ slug: 'leather', qty: 3, name: 'Leather', icon: 'leather' }],
    output: { slug: 'leather-gloves', qty: 1, name: 'Leather Gloves', effect: '+3 DEX, +3 DEF', max: 999 },
  },
  {
    id: 'leather-boots',
    label: 'Leather Boots',
    outputIcon: 'leather-boots',
    station: 'crafting-table',
    blurb: 'Sole, upper, and enough stitching to walk a forest in.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [{ slug: 'leather', qty: 3, name: 'Leather', icon: 'leather' }],
    output: { slug: 'leather-boots', qty: 1, name: 'Leather Boots', effect: '+3 DEX, +3 DEF', max: 999 },
  },
  {
    id: 'leather-helmet',
    label: 'Leather Helmet',
    outputIcon: 'leather-helmet',
    station: 'crafting-table',
    blurb: 'Hardened hide, boiled and beaten into a helmet.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [{ slug: 'leather', qty: 5, name: 'Leather', icon: 'leather' }],
    output: { slug: 'leather-helmet', qty: 1, name: 'Leather Helmet', effect: '+2 STR, +10 DEF', max: 999 },
  },
  {
    id: 'leather-vest',
    label: 'Leather Vest',
    outputIcon: 'leather-vest',
    station: 'crafting-table',
    blurb: 'Light, supple, and cut to keep you moving.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [{ slug: 'leather', qty: 7, name: 'Leather', icon: 'leather' }],
    output: { slug: 'leather-vest', qty: 1, name: 'Leather Vest', effect: '+6 DEX', max: 999 },
  },
  {
    id: 'leather-armor',
    label: 'Leather Armor',
    outputIcon: 'leather-armor',
    station: 'crafting-table',
    blurb: 'The full suit. Ten hides and most of an afternoon.',
    tool: LEATHER_TOOL,
    unlock: LEATHER_UNLOCK,
    inputs: [{ slug: 'leather', qty: 10, name: 'Leather', icon: 'leather' }],
    output: { slug: 'leather-armor', qty: 1, name: 'Leather Armor', effect: '+4 STR, +10 DEF', max: 999 },
  },

  // ==================== BASIC TOOLS ====================
  // Three stone and a length of wood, no tool and no unlock — the original had
  // these from the moment you could craft at all, and they matter more now that
  // the Neverending Mine breaks a pickaxe roughly every fifty swings.
  {
    id: 'pickaxe',
    label: 'Pickaxe',
    outputIcon: 'pickaxe',
    station: 'crafting-table',
    blurb: 'Knap a stone head onto a haft. Mines stone, and nothing harder.',
    inputs: [{ slug: 'stone', qty: 3, name: 'Stone', icon: 'stone' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'pickaxe', qty: 1, name: 'Pickaxe', effect: 'Mines stone', max: 10 },
  },
  {
    id: 'hammer',
    label: 'Hammer',
    outputIcon: 'craft',
    station: 'crafting-table',
    blurb: 'A plain forge hammer. Needed to work leather.',
    inputs: [{ slug: 'stone', qty: 3, name: 'Stone', icon: 'stone' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'hammer', qty: 1, name: 'Hammer', effect: 'Crafting tool', max: 1 },
  },
  {
    id: 'hatchet',
    label: 'Hatchet',
    outputIcon: 'axelog',
    station: 'crafting-table',
    blurb: 'A stone-headed hatchet for felling trees.',
    inputs: [{ slug: 'stone', qty: 3, name: 'Stone', icon: 'stone' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'hatchet', qty: 1, name: 'Hatchet', effect: 'Chops wood', max: 1 },
  },


  // ==================== IRON ====================
  // The Mining Guild's tier, and the reason to join it. Unlocked by putting the
  // Phoenix down at Mine Level 10 — the Guild Leader hands you the iron hammer
  // with the technique, and a steel or mithril hammer works iron just as well.
  //
  // The iron hammer itself is the one exception: it asks for no hammer, so a
  // player who loses theirs can forge a replacement rather than being locked out
  // of their own tier.
  {
    id: 'iron-hammer',
    label: 'Iron Hammer',
    outputIcon: 'craft',
    station: 'crafting-table',
    blurb: 'A replacement forge hammer, in case the first one goes missing.',
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 3, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-hammer', qty: 1, name: 'Iron Hammer', effect: 'Works iron at a forge', max: 1 },
  },

  {
    id: 'iron-pickaxe',
    label: 'Iron Pickaxe',
    outputIcon: 'pickaxe',
    station: 'crafting-table',
    blurb: 'Frees the iron a plain pick only scratches.',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 3, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-pickaxe', qty: 1, name: 'Iron Pickaxe', effect: 'Mines iron and stone', max: 999 },
  },
  {
    id: 'iron-hatchet',
    label: 'Iron Hatchet',
    outputIcon: 'axelog',
    station: 'crafting-table',
    blurb: 'Bites deeper than a plain hatchet, and brings back twice the wood.',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 3, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-hatchet', qty: 1, name: 'Iron Hatchet', effect: 'Chops twice the wood', max: 999 },
  },
  {
    id: 'iron-dagger',
    label: 'Iron Dagger',
    outputIcon: 'equipment-irondagger',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 1, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-dagger', qty: 1, name: 'Iron Dagger', effect: '+8 STR', max: 999 },
  },
  {
    id: 'iron-boomerang',
    label: 'Iron Boomerang',
    outputIcon: 'equipment-ironboomerang',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 5, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-boomerang', qty: 1, name: 'Iron Boomerang', effect: '+15 DEX', max: 999 },
  },
  {
    id: 'iron-sword',
    label: 'Iron Sword',
    outputIcon: 'equipment-ironsword',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 7, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-sword', qty: 1, name: 'Iron Sword', effect: '+14 STR', max: 999 },
  },
  {
    id: 'iron-staff',
    label: 'Iron Staff',
    outputIcon: 'equipment-ironstaff',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 7, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-staff', qty: 1, name: 'Iron Staff', effect: '+10 MAG, +3 STR', max: 999 },
  },
  {
    id: 'iron-bow',
    label: 'Iron Bow',
    outputIcon: 'equipment-ironbow',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 7, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-bow', qty: 1, name: 'Iron Bow', effect: '+18 DEX', max: 999 },
  },
  {
    id: 'iron-chakram',
    label: 'Iron Chakram',
    outputIcon: 'equipment-ironchakram',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 7, name: 'Iron', icon: 'iron' }, { slug: 'gray-matter', qty: 1, name: 'Gray Matter', icon: 'gray-matter' }],
    output: { slug: 'iron-chakram', qty: 1, name: 'Iron Chakram', effect: '+15 DEX, +15 MAG', max: 999 },
  },
  {
    id: 'iron-maul',
    label: 'Iron Maul',
    outputIcon: 'equipment-ironmaul',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 10, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-maul', qty: 1, name: 'Iron Maul', effect: '+22 STR, +10 DEF', max: 999 },
  },
  {
    id: 'iron-crossbow',
    label: 'Iron Crossbow',
    outputIcon: 'equipment-ironcrossbow',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 10, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-crossbow', qty: 1, name: 'Iron Crossbow', effect: '+30 DEX', max: 999 },
  },
  {
    id: 'iron-nunchaku',
    label: 'Iron Nunchaku',
    outputIcon: 'equipment-ironnunchaku',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 10, name: 'Iron', icon: 'iron' }, { slug: 'gray-matter', qty: 1, name: 'Gray Matter', icon: 'gray-matter' }],
    output: { slug: 'iron-nunchaku', qty: 1, name: 'Iron Nunchaku', effect: '+25 STR, +25 MAG', max: 999 },
  },
  {
    id: 'iron-2h-sword',
    label: 'Iron 2H Sword',
    outputIcon: 'equipment-iron2hsword',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 15, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-2h-sword', qty: 1, name: 'Iron 2H Sword', effect: '+25 STR', max: 999 },
  },
  {
    id: 'iron-battle-staff',
    label: 'Iron Battle Staff',
    outputIcon: 'equipment-ironbattlestaff',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 15, name: 'Iron', icon: 'iron' }, { slug: 'wood', qty: 1, name: 'Wood', icon: 'wood' }],
    output: { slug: 'iron-battle-staff', qty: 1, name: 'Iron Battle Staff', effect: '+12 MAG, +12 STR', max: 999 },
  },
  {
    id: 'iron-hood',
    label: 'Iron Hood',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 3, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-hood', qty: 1, name: 'Iron Hood', effect: '+3 STR, +3 DEX, +3 DEF', max: 999 },
  },
  {
    id: 'iron-gloves',
    label: 'Iron Gloves',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 3, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-gloves', qty: 1, name: 'Iron Gloves', effect: '+5 STR, +10 DEF', max: 999 },
  },
  {
    id: 'iron-boots',
    label: 'Iron Boots',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 3, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-boots', qty: 1, name: 'Iron Boots', effect: '+20 DEF', max: 999 },
  },
  {
    id: 'iron-helmet',
    label: 'Iron Helmet',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 5, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-helmet', qty: 1, name: 'Iron Helmet', effect: '+20 DEF', max: 999 },
  },
  {
    id: 'iron-gauntlets',
    label: 'Iron Gauntlets',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 5, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-gauntlets', qty: 1, name: 'Iron Gauntlets', effect: '+20 DEF', max: 999 },
  },
  {
    id: 'iron-cape',
    label: 'Iron Cape',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 7, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-cape', qty: 1, name: 'Iron Cape', effect: '+15 STR', max: 999 },
  },
  {
    id: 'iron-armor',
    label: 'Iron Armor',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 10, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-armor', qty: 1, name: 'Iron Armor', effect: '+30 DEF', max: 999 },
  },
  {
    id: 'iron-shield',
    label: 'Iron Shield',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 10, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-shield', qty: 1, name: 'Iron Shield', effect: '+25 DEF', max: 999 },
  },
  {
    id: 'iron-kite-shield',
    label: 'Iron Kite Shield',
    outputIcon: 'iron',
    station: 'crafting-table',
    tool: IRON_HAMMER,
    unlock: IRON_UNLOCK,
    inputs: [{ slug: 'iron', qty: 15, name: 'Iron', icon: 'iron' }],
    output: { slug: 'iron-kite-shield', qty: 1, name: 'Iron Kite Shield', effect: '+40 DEF', max: 999 },
  },
]

/** Fast lookup by recipe id. */
const RECIPE_BY_ID = CRAFTING_RECIPES.reduce((acc, recipe) => {
  acc[recipe.id] = recipe
  return acc
}, /** @type {Record<string, Recipe>} */ ({}))

/**
 * Whether crafting is available in the given room.
 * @param {string} roomId
 * @returns {boolean}
 */
function isCraftingRoom(roomId) {
  return CRAFTING_ROOMS.includes(roomId)
}

/**
 * Recipes available in a given room. Currently every crafting room offers the
 * full list; kept as a function so per-room recipe sets can be introduced later
 * without touching call sites.
 * @param {string} roomId
 * @returns {Recipe[]}
 */
function getRecipesForRoom(roomId) {
  return isCraftingRoom(roomId) ? CRAFTING_RECIPES : []
}

/**
 * Look up a single recipe by id.
 * @param {string} recipeId
 * @returns {Recipe | null}
 */
function getRecipeById(recipeId) {
  return RECIPE_BY_ID[recipeId] || null
}

module.exports = {
  CRAFTING_ROOMS,
  CRAFTING_RECIPES,
  CRAFTING_STATIONS,
  isCraftingRoom,
  getRecipesForRoom,
  getRecipeById,
}
