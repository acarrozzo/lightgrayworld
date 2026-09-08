/**
 * Regeneration — the per-click HP/MP trickle, in one place for server and client.
 *
 * The original (function-statuseffects.php) ran once per click and summed
 * every regen source before touching the row:
 *
 *   - gear:   every equipped item's `metadata.regen: { hp?, mp? }` — the ring
 *             of health/mana regen ladder, the Shaman Necklace, the Sky Hawk;
 *   - tea:    +5 HP and +5 MP while a cup of tea counts down;
 *   - spell:  Regenerate, a flat HP amount a click while it counts down —
 *             rolled rand(lvl, 2×lvl) once at cast and locked for the duration.
 *
 * Regen only fills toward the max and never lowers an overcharge, and MP regen
 * skips the click a spell was cast on (the original's `noMPregen`). The server
 * rolls and writes (services/regen-service.js); the client reads the same
 * summary for the chip beside the bars, so the number shown is the number
 * the next click restores.
 *
 * Plain CommonJS with JSDoc like crafting-recipes.js, so the engine can
 * `require()` it and the TypeScript client imports it via allowJs.
 */

/** What a cup of tea restores each click while it lasts. */
const TEA_REGEN = { hp: 5, mp: 5 }

/**
 * The regen an item template declares, or zeros. Tolerates any metadata shape.
 * @param {any} metadata
 * @returns {{ hp: number, mp: number }}
 */
function readItemRegen(metadata) {
  const regen = metadata && typeof metadata === 'object' ? metadata.regen : null
  if (!regen || typeof regen !== 'object') return { hp: 0, mp: 0 }
  return {
    hp: typeof regen.hp === 'number' ? regen.hp : 0,
    mp: typeof regen.mp === 'number' ? regen.mp : 0,
  }
}

/**
 * Sum the regen across a set of item templates' metadata (the equipped set).
 * @param {any[]} metadatas
 * @returns {{ hp: number, mp: number }}
 */
function sumGearRegen(metadatas) {
  const totals = { hp: 0, mp: 0 }
  for (const metadata of metadatas || []) {
    const regen = readItemRegen(metadata)
    totals.hp += regen.hp
    totals.mp += regen.mp
  }
  return totals
}

/**
 * What Regenerate can lock in at a level: rand(lvl, 2×lvl), rolled once at cast.
 * @param {number} level
 * @returns {{ min: number, max: number }}
 */
function regenerateRange(level) {
  const lvl = Math.max(0, Math.floor(Number(level) || 0))
  return { min: lvl, max: lvl * 2 }
}

/**
 * @typedef {Object} RegenSummary
 * @property {{ hp: number, mp: number }} gear  From equipped items.
 * @property {boolean} tea                      A cup of tea is running.
 * @property {number} regenerateAmount          Regenerate's locked HP a click while it runs, else 0.
 * @property {number} hpMin                     HP a click restores.
 * @property {number} hpMax                     The same; kept so callers can describe a range if one ever returns.
 * @property {number} mp                        MP a click restores (before the spell-cast skip).
 * @property {boolean} any                      Whether anything at all is regenerating.
 */

/**
 * Everything regenerating right now, from the equipped set's regen and the
 * buff countdowns with their locked amounts. The same reading on both sides:
 * the tick applies it, the chip describes it. Nothing here is random — the
 * only roll (Regenerate's amount) happened at cast.
 *
 * @param {{ gear?: { hp?: number, mp?: number } | null, buffs?: Record<string, number> | null }} sources
 * @returns {RegenSummary}
 */
function regenSummary({ gear, buffs } = {}) {
  const gearRegen = { hp: Number(gear?.hp) || 0, mp: Number(gear?.mp) || 0 }
  const tea = (Number(buffs?.buffTeaClicks) || 0) > 0
  const regenerateAmount =
    (Number(buffs?.regenerateClicks) || 0) > 0 ? Math.max(0, Number(buffs?.regenerateAmount) || 0) : 0
  const hp = gearRegen.hp + (tea ? TEA_REGEN.hp : 0) + regenerateAmount
  const mp = gearRegen.mp + (tea ? TEA_REGEN.mp : 0)
  return { gear: gearRegen, tea, regenerateAmount, hpMin: hp, hpMax: hp, mp, any: hp > 0 || mp > 0 }
}

/**
 * One click's regen from a summary. Flat: the amounts are what they are.
 * @param {RegenSummary} summary
 * @returns {{ hp: number, mp: number }}
 */
function rollRegen(summary) {
  if (!summary || !summary.any) return { hp: 0, mp: 0 }
  return { hp: summary.hpMin, mp: summary.mp }
}

/**
 * "+3 HP · +5 MP / click", or "+1–2 HP / click" under Regenerate; '' with
 * nothing running. Shared by the item label and the header chip.
 * @param {{ hpMin?: number, hpMax?: number, hp?: number, mp?: number }} regen
 * @returns {string}
 */
function describeRegen(regen) {
  if (!regen) return ''
  const hpMin = typeof regen.hpMin === 'number' ? regen.hpMin : Number(regen.hp) || 0
  const hpMax = typeof regen.hpMax === 'number' ? regen.hpMax : hpMin
  const mp = Number(regen.mp) || 0
  const parts = []
  if (hpMax > 0) parts.push(hpMax > hpMin ? `+${hpMin}–${hpMax} HP` : `+${hpMin} HP`)
  if (mp > 0) parts.push(`+${mp} MP`)
  return parts.length ? `${parts.join(' · ')} / click` : ''
}

module.exports = {
  TEA_REGEN,
  readItemRegen,
  sumGearRegen,
  regenerateRange,
  regenSummary,
  rollRegen,
  describeRegen,
}
