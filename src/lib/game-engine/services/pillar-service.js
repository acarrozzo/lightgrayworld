const { prisma } = require('../../db-client')
const { listPillarNames, completedSet } = require('../../game-data/quest-registry')

/**
 * The Grand Quest Pillar as a monument: who holds each of its names.
 *
 * Progress is player-scoped (a grand quest is a QuestProgress row like any
 * other); the record is world-readable. Every player who walks into room 029
 * sees the same carved names, so the holders are read once a minute per
 * process rather than per visit. The cache is process-local and is dropped
 * the moment a name is earned here; another instance catches up within the
 * minute.
 */
const HOLDERS_TTL_MS = 60_000
let holdersCache = { at: 0, byQuestId: null }

/** @returns {Promise<Record<string, string[]>>} usernames per grand quest id, in the order the rows were made */
async function getPillarHolders(db = prisma, { fresh = false } = {}) {
  if (!fresh && holdersCache.byQuestId && Date.now() - holdersCache.at < HOLDERS_TTL_MS) {
    return holdersCache.byQuestId
  }
  const questIds = listPillarNames().map((name) => name.questId).filter(Boolean)
  const rows = await db.questProgress.findMany({
    where: { questId: { in: questIds }, completed: true },
    select: { questId: true, user: { select: { username: true } } },
    orderBy: { id: 'asc' },
  })
  const byQuestId = {}
  for (const id of questIds) byQuestId[id] = []
  for (const row of rows) byQuestId[row.questId]?.push(row.user.username)
  holdersCache = { at: Date.now(), byQuestId }
  return byQuestId
}

/** A name was just carved: the next read sees it. */
function invalidatePillarHolders() {
  holdersCache = { at: 0, byQuestId: null }
}

/**
 * The Pillar as one player sees it: every name, whether it is theirs, and who
 * else holds it. `progressRows` are the player's QuestProgress rows.
 */
async function getPillarView(progressRows, db = prisma) {
  const holders = await getPillarHolders(db)
  const done = completedSet(progressRows)
  return listPillarNames().map((name) => ({
    ...name,
    yours: !!(name.questId && done.has(name.questId)),
    holders: name.questId ? holders[name.questId] ?? [] : [],
  }))
}

module.exports = { getPillarHolders, invalidatePillarHolders, getPillarView, HOLDERS_TTL_MS }
