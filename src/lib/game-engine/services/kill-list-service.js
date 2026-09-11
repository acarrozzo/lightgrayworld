/**
 * The player's kill list, as a set the spawn tables can read.
 *
 * The original kept every `KL*` count in the session and the Mountains'
 * battle set read five of them on every page load to decide which boss the
 * 1-in-50 slot could produce. The modern kill counts live in the KillList
 * table; this is the process-local mirror of *which* monsters a player has
 * ever put down, so a room roll — which runs on every turn action and must
 * stay synchronous inside RoomState — never has to wait on the database.
 *
 * Primed on socket login and before a move's arrival roll (`loadKillSet`),
 * kept current by the battle win (`noteKill`), dropped on disconnect
 * (`clearKillSet`). Missing it is safe: a roll with no kill set only ever
 * reaches the unconditional rung of a ladder, which is the pre-boss state.
 *
 * Held on `globalThis` so Next.js module reloads and the separately bundled
 * API routes share one map, the same pattern the teleport grants use.
 */
const { prisma } = require('../../db-client')

function store() {
  if (!globalThis.__killSets) {
    globalThis.__killSets = new Map() // playerId -> Set<enemySlug>
  }
  return globalThis.__killSets
}

/** The cached kill set, or null when this player's has not been loaded. */
function getKillSet(playerId) {
  return store().get(playerId) ?? null
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
    select: { monster: true },
  })
  const kills = new Set(rows.map((row) => row.monster))
  store().set(playerId, kills)
  return kills
}

/** The kill set, loading it once if it is not cached yet. */
async function ensureKillSet(playerId, db = prisma) {
  return getKillSet(playerId) ?? loadKillSet(playerId, db)
}

/** Record a kill the moment it is committed, so the next roll sees it. */
function noteKill(playerId, enemySlug) {
  const kills = store().get(playerId)
  if (kills) kills.add(enemySlug)
}

function clearKillSet(playerId) {
  store().delete(playerId)
}

module.exports = { getKillSet, loadKillSet, ensureKillSet, noteKill, clearKillSet }
