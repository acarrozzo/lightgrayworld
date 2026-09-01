const { prisma } = require('../db-client')
const { rand } = require('./battle-calculator')
const { checkAndApplyLevelUp } = require('./services/leveling-service')
const { grantItemOnce, getPlayerInventory } = require('./services/inventory-service')
const { RESPAWN_ROOM_ID } = require('../game-data/constants')
const { grantTeleport } = require('./teleport-grants')
const partyStore = require('../services/party-store')

// Of this enemy's firstKill slugs, return the set the player already owns (equipped copies
// included). firstKill items only drop for slugs NOT in this set, so a player who lost a piece
// can re-earn it. Returns an empty set when the enemy has no firstKill drops.
async function getOwnedFirstKillSlugs(playerId, enemy) {
  const slugs = (enemy.drops && enemy.drops.firstKill) || []
  if (slugs.length === 0) return new Set()
  const rows = await prisma.playerItem.findMany({
    where: { playerId, ItemTemplate: { slug: { in: slugs } } },
    select: { ItemTemplate: { select: { slug: true } } },
  })
  return new Set(rows.map((r) => r.ItemTemplate.slug))
}

// Resolve which item slugs drop from a single kill.
//   drops.main      — mutually-exclusive weighted roll: at most ONE item. `chance` values are
//                     laid end-to-end as bands; if they sum to < 1.0 the remainder is "no drop".
//   drops.always    — items that drop on every kill. Each entry is a slug string (qty 1),
//                     { itemSlug, qty } (fixed qty), or { itemSlug, min, max } (random qty in range).
//   drops.firstKill — every slug drops, but only while the player does not already own the item.
//                     `ownedSlugs` is the set of firstKill slugs the player currently has
//                     (including equipped copies). This is an ownership failsafe rather than a
//                     strict first-kill gate: a piece that was sold or dropped will drop again
//                     on the next kill, and stops dropping once the player holds it.
// Returns a de-duplicated array (one item template can only be granted once per kill).
// Returns merged drops as [{ slug, qty }], with one row per distinct slug (quantities summed
// when the same item is granted by more than one source, e.g. the main roll and an `always` entry).
function resolveDrops(enemy, ownedSlugs = new Set()) {
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

  // firstKill items drop only while the player doesn't already own them (ownership failsafe).
  for (const slug of drops.firstKill || []) {
    if (!ownedSlugs.has(slug)) add(slug, 1)
  }

  return [...qtyBySlug.entries()].map(([slug, qty]) => ({ slug, qty }))
}

// Pure calculation — no DB. Call this before any awaits to get rewards for immediate client emission.
// `ownedFirstKillSlugs` must be derived from getOwnedFirstKillSlugs() so firstKill drops are
// skipped for items the player already holds.
function calcBattleWinRewards(battleState, ownedFirstKillSlugs = new Set()) {
  const enemy = battleState.enemy
  const goldAwarded = rand(enemy.goldMin, enemy.goldMax)
  const xpAwarded = enemy.xpReward
  const drops = resolveDrops(enemy, ownedFirstKillSlugs)
  // Flat display strings for immediate client emit; qty > 1 gets an "xN" suffix.
  const droppedSlugs = drops.map((d) => (d.qty > 1 ? `${d.slug} x${d.qty}` : d.slug))
  // Rich per-drop detail for the victory card (not persisted). `firstKill` flags a slug
  // configured as a first-kill reward — these dropped only because the player didn't own it,
  // so the UI can give them extra emphasis.
  const firstKillSet = new Set((enemy.drops && enemy.drops.firstKill) || [])
  const dropDetails = drops.map((d) => ({ slug: d.slug, qty: d.qty, firstKill: firstKillSet.has(d.slug) }))
  return { xpAwarded, goldAwarded, drops, droppedSlugs, dropDetails }
}

/**
 * Run `fn` once more if the first attempt fails.
 *
 * A battle win is persisted after `battle:victory` has already been emitted, so
 * there is no request left to fail — a dropped connection would simply lose the
 * rewards. One retry covers the transient case (a connection recycled by the
 * pooler) without turning a genuine fault into a loop.
 */
async function runWithRetry(fn, label) {
  try {
    return await fn()
  } catch (error) {
    console.warn(`[${label}] first attempt failed, retrying once:`, error?.message || error)
    return fn()
  }
}

// All DB writes for a battle win. Returns { droppedItems (names), levelUp, inventory }.
// `inventory` is the player's refreshed inventory after grants (null when nothing dropped),
// so callers can push it to the client — the battle:victory event is emitted before this
// background work commits, so the client's inventory would otherwise be stale.
// Fire this as a background promise — do not await before emitting battle:victory.
//
// Every write lands in one transaction. Previously these were five sequential
// awaits, so a fault partway through left the player with, say, the XP but no
// kill credit (silently stalling a kill-count quest the victory screen had just
// shown progress on), or drops listed on the victory card that were never
// granted. Nothing could repair it either: the in-memory battle is already torn
// down by the time this runs, so there is no way to re-drive the award.
async function persistBattleWin(playerId, battleState, rewards) {
  const { xpAwarded, goldAwarded, drops } = rewards
  const enemy = battleState.enemy

  const { droppedItems, levelUp } = await runWithRetry(
    () =>
      prisma.$transaction(
        async (tx) => {
          await tx.user.update({
            where: { id: playerId },
            data: {
              xp: { increment: xpAwarded },
              currency: { increment: goldAwarded },
              inFight: false,
            },
          })

          await tx.killList.upsert({
            where: { userId_monster: { userId: playerId, monster: enemy.slug } },
            update: { kills: { increment: 1 } },
            create: { userId: playerId, monster: enemy.slug, kills: 1 },
          })

          const granted = []
          if (drops.length > 0) {
            const templates = await tx.itemTemplate.findMany({
              where: { slug: { in: drops.map((d) => d.slug) } },
            })
            const templateBySlug = new Map(templates.map((t) => [t.slug, t]))

            // Grant drops through grantItemOnce so they merge into existing stacks
            // (respecting the item's max) instead of creating duplicate rows.
            for (const { slug, qty } of drops) {
              const template = templateBySlug.get(slug)
              if (!template) {
                // A drop table naming a slug with no template is an authoring
                // bug, not a runtime one — validate-world fails the build on it.
                // Skip the item rather than voiding the whole win.
                console.error(`persistBattleWin: item template not found for slug "${slug}"`)
                continue
              }
              const result = await grantItemOnce(playerId, slug, qty, tx)
              if (result.granted) {
                granted.push(qty > 1 ? `${template.name} x${qty}` : template.name)
              }
            }
          }

          await tx.battleLog.create({
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
              itemsDropped: granted,
              multiplayerBonus: battleState.multiplayerBonusUsed,
            },
          })

          // Inside the transaction, so the XP above and the level it earns commit
          // together — a level-up can never be granted for XP that rolled back.
          const levelUpResult = await checkAndApplyLevelUp(playerId, tx)

          return { droppedItems: granted, levelUp: levelUpResult }
        },
        // Comfortably above the handful of round-trips above, for the case where
        // the database is remote and having a slow minute.
        { timeout: 15000 }
      ),
    'persistBattleWin'
  )

  // Read back outside the transaction: this is only needed to push to the client
  // and would otherwise hold the transaction open for an extra round-trip.
  // Non-fatal on purpose — the rewards are committed by this point, so a failed
  // read-back must not be reported to the player as a lost win. It only costs a
  // live inventory refresh, which their next action restores.
  let inventory = null
  if (drops.length > 0) {
    try {
      inventory = await getPlayerInventory(playerId)
    } catch (error) {
      console.error('persistBattleWin: inventory refresh failed after commit:', error)
    }
  }

  return { droppedItems, levelUp, inventory }
}

async function handleBattleWin(playerId, battleState) {
  const ownedFirstKillSlugs = await getOwnedFirstKillSlugs(playerId, battleState.enemy)
  const rewards = calcBattleWinRewards(battleState, ownedFirstKillSlugs)
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

  // The client performs the respawn move itself in response to battle:defeat, so
  // authorize that one destination explicitly. It keeps respawn working no
  // matter which room RESPAWN_ROOM_ID names, rather than relying on it also
  // happening to be part of the fixed teleport network.
  grantTeleport(playerId, RESPAWN_ROOM_ID)

  // Death respawns the player to another room; they can't stay pinned to a party.
  partyStore.onDeath(playerId)
}

module.exports = { calcBattleWinRewards, resolveDrops, getOwnedFirstKillSlugs, persistBattleWin, handleBattleWin, handleBattleDefeat }
