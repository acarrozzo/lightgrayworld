const { prisma } = require('../db-client')
const { rand } = require('./battle-calculator')
const { randomUUID } = require('crypto')
const { checkAndApplyLevelUp } = require('./services/leveling-service')
const { RESPAWN_ROOM_ID } = require('../game-data/constants')

// Pure calculation — no DB. Call this before any awaits to get rewards for immediate client emission.
function calcBattleWinRewards(battleState) {
  const enemy = battleState.enemy
  const goldAwarded = rand(enemy.goldMin, enemy.goldMax)
  const xpAwarded = enemy.xpReward
  const droppedSlugs = []
  for (const drop of enemy.drops) {
    if (Math.random() <= drop.chance) droppedSlugs.push(drop.itemSlug)
  }
  return { xpAwarded, goldAwarded, droppedSlugs }
}

// All DB writes for a battle win. Returns { droppedItems (names), levelUp }.
// Fire this as a background promise — do not await before emitting battle:victory.
async function persistBattleWin(playerId, battleState, rewards) {
  const { xpAwarded, goldAwarded, droppedSlugs } = rewards
  const enemy = battleState.enemy

  await prisma.user.update({
    where: { id: playerId },
    data: {
      xp: { increment: xpAwarded },
      currency: { increment: goldAwarded },
      inFight: false,
    },
  })

  await prisma.killList.upsert({
    where: { userId_monster: { userId: playerId, monster: enemy.slug } },
    update: { kills: { increment: 1 } },
    create: { userId: playerId, monster: enemy.slug, kills: 1 },
  })


  const droppedItems = []
  if (droppedSlugs.length > 0) {
    const templates = await prisma.itemTemplate.findMany({
      where: { slug: { in: droppedSlugs } },
    })
    const templateBySlug = new Map(templates.map((t) => [t.slug, t]))

    const cappedTemplateIds = templates
      .filter((t) => t.maxPerPlayer !== null)
      .map((t) => t.id)

    const existingCapped = cappedTemplateIds.length > 0
      ? await prisma.playerItem.findMany({
          where: { playerId, templateId: { in: cappedTemplateIds } },
          select: { templateId: true },
        })
      : []
    const ownedTemplateIds = new Set(existingCapped.map((i) => i.templateId))

    const toCreate = []
    for (const slug of droppedSlugs) {
      const template = templateBySlug.get(slug)
      if (!template) {
        console.error(`persistBattleWin: item template not found for slug "${slug}"`)
        continue
      }
      if (template.maxPerPlayer !== null && ownedTemplateIds.has(template.id)) continue
      toCreate.push(template)
    }

    if (toCreate.length > 0) {
      await prisma.playerItem.createMany({
        data: toCreate.map((t) => ({ id: randomUUID(), playerId, templateId: t.id, quantity: 1 })),
        skipDuplicates: true,
      })
      toCreate.forEach((t) => droppedItems.push(t.name))
    }
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

  return { droppedItems, levelUp }
}

async function handleBattleWin(playerId, battleState) {
  const rewards = calcBattleWinRewards(battleState)
  const { droppedItems, levelUp } = await persistBattleWin(playerId, battleState, rewards)
  return { xpAwarded: rewards.xpAwarded, goldAwarded: rewards.goldAwarded, droppedItems, levelUp }
}

async function handleBattleDefeat(playerId, battleState) {
  await prisma.user.update({
    where: { id: playerId },
    data: {
      hp: 1,
      inFight: false,
      deaths: { increment: 1 },
      currentRoom: RESPAWN_ROOM_ID,
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

module.exports = { calcBattleWinRewards, persistBattleWin, handleBattleWin, handleBattleDefeat }
