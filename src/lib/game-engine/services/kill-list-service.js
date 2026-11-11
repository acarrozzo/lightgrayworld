/**
 * The player's kill list, as a set the spawn tables can read — and, since the
 * boss rest timers (5 Nov 2026), when each enemy was last put down.
 *
 * The original kept every `KL*` count in the session and the Mountains'
 * battle set read five of them on every page load to decide which boss the
 * 1-in-50 slot could produce. The modern kill counts live in the KillList
 * table; this is the process-local mirror of *which* monsters a player has
 * ever put down and *when* they last did, so a room roll — which runs on
 * every turn action and must stay synchronous inside RoomState — never has to
 * wait on the database. A ranked enemy with a lair rests from its last kill
 * (game-data/boss-rest.js), and `getRestingSet` is what the roll strips.
 *
 * Primed on socket login and before a move's arrival roll (`loadKillSet`),
 * kept current by the battle win (`noteKill`), dropped on disconnect
 * (`clearKillSet`). Missing it is safe: a roll with no kill set only ever
 * reaches the unconditional rung of a ladder, which is the pre-boss state,
 * and strips nothing.
 *
 * Held on `globalThis` so Next.js module reloads and the separately bundled
 * API routes share one map, the same pattern the teleport grants use.
 */
const { prisma } = require('../../db-client')
const { getEnemy } = require('../../game-data/enemies')
const { restingUntil } = require('../../game-data/boss-rest')

function store() {
  if (!globalThis.__killSets) {
    // playerId -> { kills: Set<enemySlug>, lastKilledAt: Map<enemySlug, ms> }
    globalThis.__killSets = new Map()
  }
  return globalThis.__killSets
}

/** The cached kill set, or null when this player's has not been loaded. */
function getKillSet(playerId) {
  return store().get(playerId)?.kills ?? null
}

/**
 * Load (or refresh) the kill set from the KillList table. Cheap — one indexed
 * read — and idempotent, so callers on the arrival path can await it freely.
 * @param {string} playerId
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<Set<string>>}
 */
async function loadKillSet(playerId, db = prisma) {
  const rows = await db.killList.findMany({
    where: { userId: playerId, kills: { gte: 1 } },
    select: { monster: true, lastKilledAt: true },
  })
  const kills = new Set(rows.map((row) => row.monster))
  const lastKilledAt = new Map()
  for (const row of rows) {
    if (row.lastKilledAt) lastKilledAt.set(row.monster, new Date(row.lastKilledAt).getTime())
  }
  store().set(playerId, { kills, lastKilledAt })
  return kills
}

/** The kill set, loading it once if it is not cached yet. */
async function ensureKillSet(playerId, db = prisma) {
  return getKillSet(playerId) ?? loadKillSet(playerId, db)
}

/**
 * Record a kill the moment it is committed, so the next roll sees it — and,
 * with `at` (ms), starts the enemy's rest from that moment.
 */
function noteKill(playerId, enemySlug, at = Date.now()) {
  let entry = store().get(playerId)
  // Not loaded yet (a socket that never primed it): start the mirror from
  // this kill rather than drop it. The next `ensureKillSet` keeps it as is;
  // a `loadKillSet` replaces it with the row's full picture.
  if (!entry) {
    entry = { kills: new Set(), lastKilledAt: new Map() }
    store().set(playerId, entry)
  }
  entry.kills.add(enemySlug)
  entry.lastKilledAt.set(enemySlug, at)
}

/** Forget a kill's time (the test reset); the count is untouched. */
function clearLastKill(playerId, enemySlug) {
  store().get(playerId)?.lastKilledAt.delete(enemySlug)
}

/** When this player last killed the enemy, as ms, or null (unknown or never). */
function getLastKilledAt(playerId, enemySlug) {
  return store().get(playerId)?.lastKilledAt.get(enemySlug) ?? null
}

/**
 * The ranked enemies resting for this player at `now`: what the roll strips.
 * An empty set when nothing rests or the mirror is not loaded.
 * @returns {Set<string>}
 */
function getRestingSet(playerId, now = Date.now()) {
  const resting = new Set()
  const entry = store().get(playerId)
  if (!entry) return resting
  for (const [slug, at] of entry.lastKilledAt) {
    const until = restingUntil(getEnemy(slug), at)
    if (until != null && until > now) resting.add(slug)
  }
  return resting
}

function clearKillSet(playerId) {
  store().delete(playerId)
}

module.exports = {
  getKillSet,
  loadKillSet,
  ensureKillSet,
  noteKill,
  clearLastKill,
  getLastKilledAt,
  getRestingSet,
  clearKillSet,
}
