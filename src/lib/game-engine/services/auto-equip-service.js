const { prisma } = require('../../db-client')
const { getPlayerInventory } = require('./inventory-service')
const { recomputeStatMods, PLAYER_SELECT } = require('./equipment-service')
const { SKILL_SELECT, projectSkillState } = require('./skill-service')
const { BUFF_SELECT, getStatBuffBonuses } = require('./buff-service')
const { MODES, MODE_IDS, SLOT_LABELS, isAutoEquipMode, planAutoEquip, describePlan } = require('../../game-data/auto-equip-plan')

/**
 * Auto-equip, the server half: load what the player owns, plan the loadout
 * with the shared planner (game-data/auto-equip-plan.js — the rules and the
 * reasoning live there), and apply the plan in one transaction: one
 * statement takes everything off, one puts everything on, and the stat mods
 * are recomputed from the rows as they now stand before the transaction
 * commits. Round trips do not grow with the number of slots that change.
 */

function describeRow(row) {
  if (!row) return null
  return { id: row.id, slug: row.template.slug, name: row.template.name }
}

/**
 * Write a plan's changes: one statement takes every outgoing item off, one
 * puts every incoming item on. Each is guarded on the rows still being the
 * player's and in the state the plan saw — worn for what comes off, held and
 * unworn for what goes on — and a count that comes up short throws, so a
 * drop or purchase that raced the plan rolls the whole loadout back rather
 * than half-dressing the player. Ids and slots are bound as parameters;
 * nothing from the client reaches the SQL text.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} playerId
 * @param {{ changes: Array<{ slot: string, from: any|null, to: any|null }> }} plan
 */
async function applyPlan(tx, playerId, plan) {
  const offIds = plan.changes.filter((change) => change.from).map((change) => change.from.id)
  const on = plan.changes.filter((change) => change.to).map((change) => ({ id: change.to.id, slot: change.slot }))

  if (offIds.length > 0) {
    const placeholders = offIds.map((_, index) => `$${index + 2}`).join(', ')
    const took = await tx.$executeRawUnsafe(
      `UPDATE "PlayerItem" SET "isEquipped" = false, slot = NULL, "updatedAt" = NOW()
       WHERE "playerId" = $1 AND "isEquipped" = true AND id IN (${placeholders})`,
      playerId,
      ...offIds
    )
    if (took !== offIds.length) throw new Error('auto-equip: something you were wearing changed in the meantime')
  }

  if (on.length > 0) {
    const values = on.map((_, index) => `($${index * 2 + 2}, $${index * 2 + 3})`).join(', ')
    const params = on.flatMap((row) => [row.id, row.slot])
    const put = await tx.$executeRawUnsafe(
      `UPDATE "PlayerItem" AS p SET "isEquipped" = true, slot = v.slot, "updatedAt" = NOW()
       FROM (VALUES ${values}) AS v(id, slot)
       WHERE p.id = v.id AND p."playerId" = $1 AND p."isEquipped" = false AND p.quantity >= 1`,
      playerId,
      ...params
    )
    if (put !== on.length) throw new Error('auto-equip: an item is no longer available')
  }
}

/**
 * The inventory as the plan leaves it, without a second read: the same rows
 * the transaction just verified, flipped the way it flipped them.
 */
function applyPlanToInventory(inventory, plan) {
  const flips = new Map()
  for (const { slot, from, to } of plan.changes) {
    if (from) flips.set(from.id, { isEquipped: false, slot: null })
    if (to) flips.set(to.id, { isEquipped: true, slot })
  }
  return inventory.map((row) => (flips.has(row.id) ? { ...row, ...flips.get(row.id) } : row))
}

/**
 * Plan and apply the loadout for a player.
 *
 * @param {string} playerId
 * @param {{ mode: AutoEquipMode, skipNegatives?: boolean }} options
 * @returns {Promise<{ success: boolean, message: string, changed?: boolean, label?: string, stat?: string, before?: number, after?: number, changes?: Array<{ slot: string, from: any, to: any }>, inventory?: Array, player?: Object }>}
 */
async function autoEquip(playerId, { mode, skipNegatives = false }) {
  if (!isAutoEquipMode(mode)) {
    return { success: false, message: 'Unknown auto-equip mode' }
  }

  const stat = MODES[mode].stat
  const [inventory, statRow] = await Promise.all([
    getPlayerInventory(playerId),
    prisma.user.findUnique({ where: { id: playerId }, select: { [stat]: true, ...BUFF_SELECT, ...SKILL_SELECT } }),
  ])
  if (!statRow) {
    return { success: false, message: 'Player not found' }
  }
  const skillLevels = projectSkillState(statRow).skills
  // Core plus running buffs: what the stat is with nothing worn.
  const base = (Number(statRow[stat]) || 0) + getStatBuffBonuses(statRow)[stat]

  const plan = planAutoEquip(inventory, { mode, skipNegatives: skipNegatives === true, skillLevels, base })
  const summary = {
    label: plan.label,
    stat: plan.stat,
    before: plan.before,
    after: plan.after,
    changes: plan.changes.map(({ slot, from, to }) => ({ slot, from: describeRow(from), to: describeRow(to) })),
  }

  if (plan.changes.length === 0) {
    const player = await prisma.user.findUnique({ where: { id: playerId }, select: PLAYER_SELECT })
    return { success: true, changed: false, message: describePlan(plan), inventory, player, ...summary }
  }

  // Everything lands or nothing does, and the mods are recomputed from the
  // rows as they stand inside the same transaction — the player view comes
  // back from that write, so nothing is read again afterwards.
  const player = await prisma.$transaction(async (tx) => {
    await applyPlan(tx, playerId, plan)
    return recomputeStatMods(playerId, { tx, select: PLAYER_SELECT })
  })

  return {
    success: true,
    changed: true,
    message: describePlan(plan),
    inventory: applyPlanToInventory(inventory, plan),
    player,
    ...summary,
  }
}

module.exports = {
  MODES,
  MODE_IDS,
  SLOT_LABELS,
  isAutoEquipMode,
  planAutoEquip,
  describePlan,
  applyPlan,
  applyPlanToInventory,
  autoEquip,
}
