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
 *
 * @typedef {Object} RecipeUnlock
 * @property {string} questId  Quest that must have been started or completed.
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

/** Rooms where the crafting panel is available. */
const CRAFTING_ROOMS = ['003', '021', '024']

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
