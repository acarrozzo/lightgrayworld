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
 * @typedef {Object} Recipe
 * @property {string} id          Stable recipe id (sent from client → server).
 * @property {string} label       Display name shown on the recipe card.
 * @property {string} outputIcon  Icon name for the produced item.
 * @property {string} station     Crafting station this recipe belongs to (see CRAFTING_STATIONS).
 * @property {string} [blurb]     Optional one-line flavor / description.
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
    output: { slug: 'wooden-bow', qty: 1, name: 'Wooden Bow', effect: 'Ranged weapon', max: 1 },
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
