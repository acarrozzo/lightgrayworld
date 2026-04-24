const { prisma } = require('../db-client')
const { rand } = require('./battle-calculator')
const { randomUUID } = require('crypto')
const { checkAndApplyLevelUp } = require('./services/leveling-service')

async function handleBattleWin(playerId, battleState) {
  const enemy = battleState.enemy
  const goldAwarded = rand(enemy.goldMin, enemy.goldMax)
  const xpAwarded = enemy.xpReward

  // Roll drops
  const droppedSlugs = []
  for (const drop of enemy.drops) {
    if (Math.random() <= drop.chance) {
      droppedSlugs.push(drop.itemSlug)
    }
  }

  // Persist XP, gold, clear fight flag
  await prisma.user.update({
    where: { id: playerId },
    data: {
      xp: { increment: xpAwarded },
      currency: { increment: goldAwarded },
      inFight: false,
    },
  })

  // Record kill
  await prisma.killList.upsert({
    where: { userId_monster: { userId: playerId, monster: enemy.slug } },
    update: { kills: { increment: 1 } },
    create: { userId: playerId, monster: enemy.slug, kills: 1 },
  })

  // Add item drops (respects maxPerPlayer)
  const droppedItems = []
  for (const slug of droppedSlugs) {
    const template = await prisma.itemTemplate.findUnique({ where: { slug } })
    if (!template) {
      console.error(`handleBattleWin: item template not found for slug "${slug}"`)
      continue
    }

    if (template.maxPerPlayer !== null) {
      const existing = await prisma.playerItem.findFirst({
        where: { playerId, templateId: template.id },
      })
      if (existing) continue
    }

    await prisma.playerItem.create({
      data: { id: randomUUID(), playerId, templateId: template.id, quantity: 1 },
    })
    droppedItems.push(template.name)
  }

  await prisma.battleLog.create({
    data: {
      userId: playerId,
      enemySlug: battleState.enemySlug,
      enemyName: battleState.enemyName,
      outcome: 'WIN',
      turnsCount: battleState.turnCount,
      totalDamageDealt: battleState.totalDamageDealt,
      totalDamageReceived: battleState.totalDamageReceived,
      maxSingleHit: battleState.maxSingleHit,
      xpEarned: xpAwarded,
      goldEarned: goldAwarded,
      itemsDropped: droppedItems,
      multiplayerBonus: battleState.multiplayerBonusUsed,
    },
  })

  const levelUp = await checkAndApplyLevelUp(playerId)

  return { xpAwarded, goldAwarded, droppedItems, levelUp }
}

async function handleBattleDefeat(playerId, battleState) {
  await prisma.user.update({
    where: { id: playerId },
    data: {
      hp: 1,
      inFight: false,
      deaths: { increment: 1 },
      currentRoom: '999',
    },
  })

  await prisma.battleLog.create({
    data: {
      userId: playerId,
      enemySlug: battleState.enemySlug,
      enemyName: battleState.enemyName,
      outcome: 'LOSS',
      turnsCount: battleState.turnCount,
      totalDamageDealt: battleState.totalDamageDealt,
      totalDamageReceived: battleState.totalDamageReceived,
      maxSingleHit: battleState.maxSingleHit,
      xpEarned: 0,
      goldEarned: 0,
      itemsDropped: [],
      multiplayerBonus: battleState.multiplayerBonusUsed,
    },
  })
}

module.exports = { handleBattleWin, handleBattleDefeat }
