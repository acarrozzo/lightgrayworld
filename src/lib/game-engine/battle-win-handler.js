const { prisma } = require('../db-client')
const { rand } = require('./battle-calculator')
const { checkAndApplyLevelUp } = require('./services/leveling-service')
const { grantItemOnce, getPlayerInventory } = require('./services/inventory-service')
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
//   drops.always    — items that drop on every kill. Each entry is a slug string (qty 1),
//                     { itemSlug, qty } (fixed qty), or { itemSlug, min, max } (random qty in range).
//   drops.firstKill — every slug drops, but only on the player's first kill of this enemy.
// Returns a de-duplicated array (one item template can only be granted once per kill).
// Returns merged drops as [{ slug, qty }], with one row per distinct slug (quantities summed
// when the same item is granted by more than one source, e.g. the main roll and an `always` entry).
function resolveDrops(enemy, isFirstKill) {
  const drops = enemy.drops || {}
  // Preserve first-seen order while summing quantities per slug.
  const qtyBySlug = new Map()
  const add = (slug, qty) => {
    if (qty <= 0) return
    qtyBySlug.set(slug, (qtyBySlug.get(slug) || 0) + qty)
  }
  // A drop entry's quantity: `min`/`max` rolls a random range, `qty` is fixed, default 1.
  const rollQty = (entry) =>
    entry.min != null || entry.max != null
      ? rand(entry.min ?? 1, entry.max ?? entry.min ?? 1)
      : (entry.qty ?? 1)

  const main = drops.main || []
  if (main.length > 0) {
    const roll = Math.random()
    let cumulative = 0
    for (const entry of main) {
      cumulative += entry.chance
      if (roll < cumulative) {
        add(entry.itemSlug, rollQty(entry))
        break
      }
    }
    if (cumulative > 1.000001) {
      console.warn(`resolveDrops: main drop chances for "${enemy.slug}" sum to ${cumulative} (> 1.0); later entries may never roll`)
    }
  }

  // `always` entries may be a slug string, { itemSlug, qty }, or { itemSlug, min, max }.
  for (const entry of drops.always || []) {
    if (typeof entry === 'string') add(entry, 1)
    else add(entry.itemSlug, rollQty(entry))
  }

  if (isFirstKill) {
    for (const slug of drops.firstKill || []) add(slug, 1)
  }

  return [...qtyBySlug.entries()].map(([slug, qty]) => ({ slug, qty }))
}

// Pure calculation — no DB. Call this before any awaits to get rewards for immediate client emission.
// `isFirstKill` must be derived from getPriorKills() before this enemy's kill count is incremented.
function calcBattleWinRewards(battleState, isFirstKill = false) {
  const enemy = battleState.enemy
  const goldAwarded = rand(enemy.goldMin, enemy.goldMax)
  const xpAwarded = enemy.xpReward
  const drops = resolveDrops(enemy, isFirstKill)
  // Flat display strings for immediate client emit; qty > 1 gets an "xN" suffix.
  const droppedSlugs = drops.map((d) => (d.qty > 1 ? `${d.slug} x${d.qty}` : d.slug))
  return { xpAwarded, goldAwarded, drops, droppedSlugs }
}

// All DB writes for a battle win. Returns { droppedItems (names), levelUp, inventory }.
// `inventory` is the player's refreshed inventory after grants (null when nothing dropped),
// so callers can push it to the client — the battle:victory event is emitted before this
// background work commits, so the client's inventory would otherwise be stale.
// Fire this as a background promise — do not await before emitting battle:victory.
async function persistBattleWin(playerId, battleState, rewards) {
  const { xpAwarded, goldAwarded, drops } = rewards
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
  let inventory = null
  if (drops.length > 0) {
    const templates = await prisma.itemTemplate.findMany({
      where: { slug: { in: drops.map((d) => d.slug) } },
    })
    const templateBySlug = new Map(templates.map((t) => [t.slug, t]))

    // Grant drops through grantItemOnce so they merge into existing stacks
    // (respecting maxStack / maxPerPlayer) instead of creating duplicate rows.
    for (const { slug, qty } of drops) {
      const template = templateBySlug.get(slug)
      if (!template) {
        console.error(`persistBattleWin: item template not found for slug "${slug}"`)
        continue
      }
      const result = await grantItemOnce(playerId, slug, qty)
      if (result.granted) {
        droppedItems.push(qty > 1 ? `${template.name} x${qty}` : template.name)
      }
    }
    // Refresh once after all grants so the client can sync without a stale read.
    inventory = await getPlayerInventory(playerId)
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

  return { droppedItems, levelUp, inventory }
}

async function handleBattleWin(playerId, battleState) {
  const isFirstKill = (await getPriorKills(playerId, battleState.enemy.slug)) === 0
  const rewards = calcBattleWinRewards(battleState, isFirstKill)
  const { droppedItems, levelUp, inventory } = await persistBattleWin(playerId, battleState, rewards)
  return { xpAwarded: rewards.xpAwarded, goldAwarded: rewards.goldAwarded, droppedItems, levelUp, inventory }
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
