/**
 * Boss rest timers, server side: what a lair is doing for one player right
 * now, and the two writes the system has (the kill's own is in
 * battle-win-handler; this holds the Boss Chest's open and the test reset).
 *
 * The rule is in game-data/boss-rest.js; the kill time is `KillList
 * .lastKilledAt`, mirrored per process by services/kill-list-service so the
 * roll never waits on the database. This module reads the mirror and shapes
 * the room payload's `bossRest`, which is per player: your Gator is down for
 * you, mine is still in the marsh.
 *
 * The Boss Chest is one open per kill: its ActionCap row's `lastActionAt` is the
 * last open, and the chest is open while that is older than the last kill.
 * No second clock, and two sockets cannot open it twice — the open is a
 * guarded update on that row (see makeBossChestHandler in room-action-handlers).
 */
const { prisma } = require('../../db-client')
const { ENEMIES, getEnemy } = require('../../game-data/enemies')
const { isRestingBoss, restMinutesFor, restMsFor, restingUntil } = require('../../game-data/boss-rest')
const { ensureKillSet, getLastKilledAt, clearLastKill } = require('./kill-list-service')

/** roomId -> the ranked enemy whose lair it is (one per lair, by the validator). */
const LAIR_BOSS_BY_ROOM = new Map()
for (const enemy of ENEMIES) {
  if (isRestingBoss(enemy)) LAIR_BOSS_BY_ROOM.set(enemy.lair, enemy)
}

/** The boss whose lair this room is, or null. */
function getLairBoss(roomId) {
  return (roomId && LAIR_BOSS_BY_ROOM.get(roomId)) || null
}

/**
 * The temporary tester: a button that clears your clock for the lair's boss.
 * Exists only where the environment says so, so production never has it even
 * if a client is stale. Removed, with its flag, once the system is signed off.
 */
function isTestResetEnabled() {
  return process.env.BOSS_REST_TEST === '1'
}

/**
 * The lair's state for this player, for the room payload: null when the room
 * is no lair or its boss is not resting. Loads the kill mirror if it is not
 * cached (one indexed read, then free).
 *
 * @returns {Promise<null | {
 *   slug: string, name: string, level: number, rank: string,
 *   restMinutes: number, restingUntil: number, secondsRemaining: number, totalSeconds: number,
 *   chest: { action: string, label: string, opened: boolean } | null,
 *   testReset: boolean,
 * }>}
 */
async function buildBossRestStatus(playerId, roomId, now = Date.now()) {
  const boss = getLairBoss(roomId)
  if (!boss || !playerId) return null
  await ensureKillSet(playerId).catch(() => null)
  const at = getLastKilledAt(playerId, boss.slug)
  const until = restingUntil(boss, at)
  if (until == null || until <= now) return null

  // Lazy: room-action-handlers pulls in most of the engine.
  const { BOSS_CHEST_LOOT } = require('../room-action-handlers')
  const chest = BOSS_CHEST_LOOT.find((c) => c.bossSlug === boss.slug) || null
  let chestStatus = null
  if (chest) {
    const cap = await prisma.actionCap
      .findUnique({
        where: { playerId_roomId_actionKey: { playerId, roomId: chest.roomId, actionKey: chest.action } },
        select: { lastActionAt: true },
      })
      .catch(() => null)
    const openedAt = cap?.lastActionAt ? new Date(cap.lastActionAt).getTime() : null
    chestStatus = { action: chest.action, label: chest.label, opened: openedAt != null && openedAt >= at }
  }

  return {
    slug: boss.slug,
    name: boss.name,
    level: boss.level,
    rank: boss.rank,
    restMinutes: restMinutesFor(boss),
    restingUntil: until,
    secondsRemaining: Math.max(0, Math.ceil((until - now) / 1000)),
    totalSeconds: Math.ceil(restMsFor(boss) / 1000),
    chest: chestStatus,
    testReset: isTestResetEnabled(),
  }
}

/**
 * Whether the lair's boss rests for this player at `now` — the synchronous
 * read the roll and the arrival use once the mirror is loaded.
 */
function isLairBossResting(playerId, roomId, now = Date.now()) {
  const boss = getLairBoss(roomId)
  if (!boss) return false
  const until = restingUntil(boss, getLastKilledAt(playerId, boss.slug))
  return until != null && until > now
}

/**
 * The test reset: forget when this player last killed the boss, in the row
 * and the mirror. The count stays. Refused outside the test flag.
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
async function resetBossRest(playerId, enemySlug) {
  if (!isTestResetEnabled()) return { ok: false, reason: 'The test reset is not enabled on this server.' }
  const boss = getEnemy(enemySlug)
  if (!isRestingBoss(boss)) return { ok: false, reason: 'That enemy has no rest clock.' }
  await prisma.killList.updateMany({ where: { userId: playerId, monster: enemySlug }, data: { lastKilledAt: null } })
  clearLastKill(playerId, enemySlug)
  return { ok: true }
}

module.exports = {
  getLairBoss,
  isTestResetEnabled,
  buildBossRestStatus,
  isLairBossResting,
  resetBossRest,
}
