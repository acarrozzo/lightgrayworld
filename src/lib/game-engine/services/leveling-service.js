const { prisma } = require('../../db-client')

const MAX_SP_PER_LEVEL = 20

function getNextLevelXP(level) {
  return ((level + 1) ** 3) * 2
}

function getPrevLevelXP(level) {
  return (level ** 3) * 2
}

/**
 * Checks if userId has enough XP to level up, applies all pending level-ups,
 * and returns a summary. Returns { leveled: false } if no level-up occurred.
 *
 * @param {string} userId
 * @param {any} [tx] - transaction client; pass one to fold the level-up into a
 *   caller's transaction (battle rewards, quest turn-ins) so XP and the level it
 *   earns commit together.
 */
async function checkAndApplyLevelUp(userId, tx = null) {
  const client = tx || prisma
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      level: true,
      xp: true,
      // hpMax/mpMax are read because levelling restores the player to full and
      // needs the post-level totals. CP/TP/SP are not: they are applied as
      // increments below, so their current values never enter the calculation.
      hpMax: true,
      mpMax: true,
      physicalTraining: true,
      mentalTraining: true,
    },
  })

  if (!user) return { leveled: false }

  let { level, hpMax, mpMax } = user
  const { xp, physicalTraining, mentalTraining } = user
  let cpGained = 0
  let tpGained = 0
  let spGained = 0
  let hpGained = 0
  let mpGained = 0

  while (xp >= getNextLevelXP(level)) {
    level += 1
    const spThisLevel = Math.min(level, MAX_SP_PER_LEVEL)
    const hpThisLevel = 1 + (physicalTraining * 2)
    const mpThisLevel = 1 + (mentalTraining * 2)
    hpMax += hpThisLevel
    mpMax += mpThisLevel
    cpGained += 1
    tpGained += 1
    spGained += spThisLevel
    hpGained += hpThisLevel
    mpGained += mpThisLevel
  }

  if (cpGained === 0) return { leveled: false }

  // Guarded on the level we read, so two award paths that overlap (a battle win
  // and a quest turn-in, say) cannot both apply the same level-up: the second
  // finds the level already moved and reports no level-up rather than granting
  // the points twice. The point gains are increments rather than absolute writes
  // for the same reason — an absolute write would clobber a CP or SP grant that
  // landed between the read above and this write.
  const applied = await client.user.updateMany({
    where: { id: userId, level: user.level },
    data: {
      level,
      cp: { increment: cpGained },
      tp: { increment: tpGained },
      sp: { increment: spGained },
      hpMax: { increment: hpGained },
      mpMax: { increment: mpGained },
      // Levelling restores the player to full.
      hp: hpMax,
      mp: mpMax,
    },
  })

  if (applied.count === 0) return { leveled: false }

  return {
    leveled: true,
    newLevel: level,
    cpGained,
    tpGained,
    spGained,
    hpGained,
    mpGained,
  }
}

module.exports = { checkAndApplyLevelUp, getNextLevelXP, getPrevLevelXP }
