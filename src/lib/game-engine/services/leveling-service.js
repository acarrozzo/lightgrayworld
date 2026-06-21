const { prisma } = require('../../db-client')

const MAX_SP_PER_LEVEL = 20

function getNextLevelXP(level) {
  return ((level + 1) ** 3) * 2
}

function getPrevLevelXP(level) {
  return (level ** 3) * 2
}

// Checks if userId has enough XP to level up, applies all pending level-ups,
// and returns a summary. Returns { leveled: false } if no level-up occurred.
async function checkAndApplyLevelUp(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      level: true,
      xp: true,
      cp: true,
      tp: true,
      sp: true,
      hpMax: true,
      mpMax: true,
      physicalTraining: true,
      mentalTraining: true,
    },
  })

  if (!user) return { leveled: false }

  let { level, xp, cp, tp, sp, hpMax, mpMax } = user
  const { physicalTraining, mentalTraining } = user
  let cpGained = 0
  let tpGained = 0
  let spGained = 0
  let hpGained = 0
  let mpGained = 0

  while (xp >= getNextLevelXP(level)) {
    level += 1
    const spThisLevel = Math.min(level, MAX_SP_PER_LEVEL)
    cp += 1
    tp += 1
    sp += spThisLevel
    hpMax += physicalTraining
    mpMax += mentalTraining
    cpGained += 1
    tpGained += 1
    spGained += spThisLevel
    hpGained += physicalTraining
    mpGained += mentalTraining
  }

  if (cpGained === 0) return { leveled: false }

  await prisma.user.update({
    where: { id: userId },
    data: {
      level,
      cp,
      tp,
      sp,
      hpMax,
      mpMax,
      hp: hpMax,
      mp: mpMax,
    },
  })

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
