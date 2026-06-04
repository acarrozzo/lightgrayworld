const { prisma } = require('../db-client')
const { rand } = require('./battle-calculator')
const { randomUUID } = require('crypto')
const { checkAndApplyLevelUp } = require('./services/leveling-service')
const { RESPAWN_ROOM_ID } = require('../game-data/constants')

// Read the player's existing kill count for an enemy. 0 means this is their first kill.
// Must be called BEFORE persistBattleWin increments the kill count.
async function getPriorKills(playerId, slug) {
  const record = await prisma.killList.findUnique({
    where: { userId_monster: { userId: playerId, monster: slug } },
    select: { kills: true },
  })
  return record?.kills ?? 0
}

// Resolve which item slugs drop from a single kill.
//   drops.main      — mutually-exclusive weighted roll: at most ONE item. `chance` values are
//                     laid end-to-end as bands; if they sum to < 1.0 the remainder is "no drop".
//   drops.always    — every slug drops on every kill.
//   drops.firstKill — every slug drops, but only on the player's first kill of this enemy.
// Returns a de-duplicated array (one item template can only be granted once per kill).
function resolveDrops(enemy, isFirstKill) {
  const drops = enemy.drops || {}
  const slugs = []

  const main = drops.main || []
  if (main.length > 0) {
    const roll = Math.random()
    let cumulative = 0
    for (const entry of main) {
      cumulative += entry.chance
      if (roll < cumulative) {
        slugs.push(entry.itemSlug)
        break
      }
    }
    if (cumulative > 1.000001) {
      console.warn(`resolveDrops: main drop chances for "${enemy.slug}" sum to ${cumulative} (> 1.0); later entries may never roll`)
    }
  }

  for (const slug of drops.always || []) slugs.push(slug)
  if (isFirstKill) {
    for (const slug of drops.firstKill || []) slugs.push(slug)
  }

  return [...new Set(slugs)]
}

// Pure calculation — no DB. Call this before any awaits to get rewards for immediate client emission.
// `isFirstKill` must be derived from getPriorKills() before this enemy's kill count is incremented.
function calcBattleWinRewards(battleState, isFirstKill = false) {
  const enemy = battleState.enemy
  const goldAwarded = rand(enemy.goldMin, enemy.goldMax)
  const xpAwarded = enemy.xpReward
  const droppedSlugs = resolveDrops(enemy, isFirstKill)
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
  const isFirstKill = (await getPriorKills(playerId, battleState.enemy.slug)) === 0
  const rewards = calcBattleWinRewards(battleState, isFirstKill)
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

module.exports = { calcBattleWinRewards, resolveDrops, getPriorKills, persistBattleWin, handleBattleWin, handleBattleDefeat }
