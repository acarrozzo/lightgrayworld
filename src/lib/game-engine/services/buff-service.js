/**
 * Click-counted player buffs.
 *
 * The original game measured every temporary effect in *clicks* rather than
 * wall-clock time: a wings potion let you fly "for 100 clicks", reds gave
 * "+20 str / 100 clicks". That is preserved here — each buff is a countdown
 * stored on the User row and decremented once per counted action (chat
 * excluded, exactly like the click counter it rides along with).
 *
 * Two families share the same countdown shape:
 *   - Ability buffs (`wings`, `gills`) gate movement. Room gates already read
 *     `User.wings` / `User.gills`, so a non-zero counter *is* the ability.
 *   - Stat buffs (`buffStrClicks` and friends) add a flat bonus to a core stat
 *     while they last. The bonus is applied where the stat is consumed
 *     (BattleState), NOT by writing into `strMod` — that column is derived
 *     purely from equipped items and is recomputed on every equip change,
 *     which would silently wipe a buff.
 */

/**
 * Buff field -> what it boosts while it runs. Drives BattleState's bonus lookup.
 *
 * A field declares its own stats and its own magnitude because the original's
 * buffs are not uniform: the reds/greens/blues/yellows capsules are +20 to a
 * single stat for 100 clicks, while a cup of coffee is +10 to *all four* for 10.
 * Duration still lives in the countdown column; this is the magnitude.
 *
 * @type {Record<string, { stats: string[], amount: number }>}
 */
const STAT_BUFF_FIELDS = {
  buffStrClicks: { stats: ['str'], amount: 20 },
  buffDexClicks: { stats: ['dex'], amount: 20 },
  buffMagClicks: { stats: ['mag'], amount: 20 },
  buffDefClicks: { stats: ['def'], amount: 20 },
  buffCoffeeClicks: { stats: ['str', 'dex', 'mag', 'def'], amount: 10 },
  // Bathing in the Master Water Temple's glory: +30 to everything for 100
  // clicks, the strongest standing buff in the original.
  buffGloryClicks: { stats: ['str', 'dex', 'mag', 'def'], amount: 30 },
}

/** Every countdown field, ability and stat alike. Order is not significant. */
const BUFF_FIELDS = ['wings', 'gills', ...Object.keys(STAT_BUFF_FIELDS)]

/**
 * Standing bonuses: learned once and never counted down. The original's auras
 * were this — the Silver Shaman's Silver Aura, "+20 all stats" for as long as
 * you had it switched on, and with only one aura in the game it is simply on.
 * Kept out of BUFF_FIELDS so tickBuffs never decrements them; applied in the
 * same place the click-counted buffs are, for the same reason they are not
 * folded into the derived *Mod columns.
 *
 * @type {Record<string, { stats: string[], amount: number }>}
 */
const STANDING_BONUS_FIELDS = {
  silverAura: { stats: ['str', 'dex', 'mag', 'def'], amount: 20 },
}

/** Prisma `select` covering every buff countdown and standing bonus. */
const BUFF_SELECT = Object.fromEntries(
  [...BUFF_FIELDS, ...Object.keys(STANDING_BONUS_FIELDS)].map((field) => [field, true])
)

/**
 * Flat stat bonuses from whatever buffs are currently running, plus any
 * standing bonus the player has learned.
 * @param {Object} row - a User row (or partial) carrying the buff countdowns
 * @returns {{str: number, dex: number, mag: number, def: number}}
 */
function getStatBuffBonuses(row) {
  const bonuses = { str: 0, dex: 0, mag: 0, def: 0 }
  if (!row) return bonuses
  for (const [field, { stats, amount }] of Object.entries(STAT_BUFF_FIELDS)) {
    if ((row[field] || 0) <= 0) continue
    for (const stat of stats) bonuses[stat] += amount
  }
  for (const [field, { stats, amount }] of Object.entries(STANDING_BONUS_FIELDS)) {
    if (!row[field]) continue
    for (const stat of stats) bonuses[stat] += amount
  }
  return bonuses
}

/**
 * Decrement every running buff by one click.
 *
 * Written as a single clamped UPDATE so it costs one round trip and can never
 * drive a counter below zero, whatever else is touching the row concurrently.
 * Returns the post-decrement counters plus the fields that hit zero on this
 * click, so the caller can tell the player their wings just gave out.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} playerId
 * @returns {Promise<{buffs: Object, expired: string[]}>}
 */
async function tickBuffs(prisma, playerId) {
  const setClause = BUFF_FIELDS.map((f) => `"${f}" = GREATEST(0, "${f}" - 1)`).join(', ')
  const prevClause = BUFF_FIELDS.map((f) => `"${f}" AS "prev_${f}"`).join(', ')
  const returnClause = BUFF_FIELDS.map((f) => `"${f}"`).join(', ')

  // Field names come from the module-level BUFF_FIELDS allow-list, never input.
  const rows = await prisma.$queryRawUnsafe(
    `WITH prev AS (SELECT ${prevClause} FROM "User" WHERE id = $1)
     UPDATE "User" SET ${setClause}
     WHERE id = $1
     RETURNING ${returnClause}, (SELECT row_to_json(prev) FROM prev) AS "prev"`,
    playerId
  )

  const row = rows[0]
  if (!row) return { buffs: {}, expired: [] }

  const prev = row.prev || {}
  const buffs = {}
  const expired = []
  for (const field of BUFF_FIELDS) {
    const value = Number(row[field] ?? 0)
    buffs[field] = value
    if (value === 0 && Number(prev[`prev_${field}`] ?? 0) > 0) expired.push(field)
  }

  return { buffs, expired }
}

/**
 * Start (or refresh) a buff. Refreshing takes the longer of the two remaining
 * durations rather than stacking, so drinking a second wings potion early can
 * never shorten the one already running.
 *
 * @param {import('@prisma/client').PrismaClient|Object} db - prisma client or tx
 * @param {string} playerId
 * @param {string} field - one of BUFF_FIELDS
 * @param {number} clicks - duration in clicks
 * @returns {Promise<number>} the buff's remaining clicks after the write
 */
async function applyBuff(db, playerId, field, clicks) {
  if (!BUFF_FIELDS.includes(field)) {
    throw new Error(`applyBuff: unknown buff field "${field}"`)
  }
  const duration = Math.max(0, Math.floor(Number(clicks) || 0))

  const rows = await db.$queryRawUnsafe(
    `UPDATE "User" SET "${field}" = GREATEST("${field}", $2) WHERE id = $1 RETURNING "${field}" AS "value"`,
    playerId,
    duration
  )
  return Number(rows[0]?.value ?? 0)
}

/** Human-readable label for a buff field, used in feed messages. */
const BUFF_LABELS = {
  wings: 'Wings',
  gills: 'Gills',
  buffStrClicks: 'Strength',
  buffDexClicks: 'Dexterity',
  buffMagClicks: 'Magic',
  buffDefClicks: 'Defense',
  buffCoffeeClicks: 'Coffee',
  buffGloryClicks: 'Glory',
}

/**
 * Zero every running buff at once — what death does, as it did in the
 * original ("reset most buffs"). Returns the all-zero counters in the same
 * shape tickBuffs reports, so the caller can hand them straight to the client.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} playerId
 * @returns {Promise<Object>}
 */
async function clearBuffs(prisma, playerId) {
  const setClause = BUFF_FIELDS.map((f) => `"${f}" = 0`).join(', ')
  const returnClause = BUFF_FIELDS.map((f) => `"${f}"`).join(', ')
  // Field names come from the module-level BUFF_FIELDS allow-list, never input.
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "User" SET ${setClause} WHERE id = $1 RETURNING ${returnClause}`,
    playerId
  )
  const row = rows[0] || {}
  return Object.fromEntries(BUFF_FIELDS.map((f) => [f, Number(row[f] ?? 0)]))
}

module.exports = {
  STANDING_BONUS_FIELDS,
  STAT_BUFF_FIELDS,
  BUFF_FIELDS,
  BUFF_SELECT,
  BUFF_LABELS,
  getStatBuffBonuses,
  tickBuffs,
  applyBuff,
  clearBuffs,
}
