/**
 * Per-click HP/MP regeneration from equipped gear.
 *
 * The original game's regen rings ticked "+N hp / click" rather than on a
 * timer, so regen rides the same click choke point the buff countdown does.
 * An item opts in by declaring `metadata.regen: { hp?: number, mp?: number }`
 * in the seed — no code change needed to add another regen item.
 */
const { prisma } = require('../../db-client')

/**
 * Sum the regen declared by everything the player currently has equipped.
 * @param {string} playerId
 * @returns {Promise<{hp: number, mp: number}>}
 */
async function getEquippedRegen(playerId) {
  const equipped = await prisma.playerItem.findMany({
    where: { playerId, isEquipped: true },
    select: { ItemTemplate: { select: { metadata: true } } },
  })

  const totals = { hp: 0, mp: 0 }
  for (const row of equipped) {
    const regen = row.ItemTemplate?.metadata?.regen
    if (!regen || typeof regen !== 'object') continue
    if (typeof regen.hp === 'number') totals.hp += regen.hp
    if (typeof regen.mp === 'number') totals.mp += regen.mp
  }
  return totals
}

/**
 * Apply one click's worth of regen, clamped to the player's maxima.
 *
 * Overcharged vitals (a fountain rest puts HP above hpMax) are left alone
 * rather than clamped back down: LEAST(max, cur + n) would strip the
 * overcharge, so the result is floored at the current value.
 *
 * @param {string} playerId
 * @param {{hp: number, mp: number}} regen
 * @returns {Promise<{hp: number, mp: number}|null>} new vitals, or null if nothing changed
 */
async function applyRegenTick(playerId, regen) {
  if (!regen || (regen.hp <= 0 && regen.mp <= 0)) return null

  const rows = await prisma.$queryRawUnsafe(
    `UPDATE "User"
     SET hp = GREATEST(hp, LEAST("hpMax", hp + $2)),
         mp = GREATEST(mp, LEAST("mpMax", mp + $3))
     WHERE id = $1
     RETURNING hp, mp`,
    playerId,
    Math.max(0, regen.hp || 0),
    Math.max(0, regen.mp || 0)
  )

  const row = rows[0]
  return row ? { hp: Number(row.hp), mp: Number(row.mp) } : null
}

module.exports = { getEquippedRegen, applyRegenTick }
