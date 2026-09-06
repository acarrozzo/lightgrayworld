const { prisma } = require('../../db-client')
const { getFaction, factionByMembershipQuest } = require('../../game-data/factions')
const { allStandings, earnedTitles } = require('../../game-data/quest-registry')

/**
 * Membership and standing, read from QuestProgress.
 *
 * Nothing here is written. A guild's membership is its initiation quest being
 * turned in; a faction's standing is its quests done out of its quests. Every
 * door, shop, trainer and NPC that used to ask "is quest X complete?" asks
 * these instead, so the meaning of "member" lives in factions.js alone.
 */

/**
 * Is the player a member of a guild? Regions have no membership and answer no.
 * @param {string} playerId
 * @param {string} factionId
 * @param {import('@prisma/client').PrismaClient} [db]
 */
async function isMember(playerId, factionId, db = prisma) {
  const faction = getFaction(factionId)
  if (!faction || !faction.membershipQuest) return false
  const row = await db.questProgress.findUnique({
    where: { userId_questId: { userId: playerId, questId: faction.membershipQuest } },
    select: { completed: true },
  })
  return !!row?.completed
}

/** Member of any one of these guilds — the dwarf guards take either Red Town badge. */
async function isMemberOfAny(playerId, factionIds, db = prisma) {
  for (const factionId of factionIds) {
    if (await isMember(playerId, factionId, db)) return true
  }
  return false
}

/** A `(playerId) => Promise<boolean>` gate, for handler tables that take one. */
function makeMemberCheck(factionId) {
  return (playerId) => isMember(playerId, factionId)
}

/** Standing with every live faction for a player. */
async function getPlayerStandings(playerId, db = prisma) {
  const rows = await db.questProgress.findMany({
    where: { userId: playerId, completed: true },
    select: { questId: true, completed: true },
  })
  return allStandings(rows)
}

/** The titles a player has earned. */
async function getPlayerTitles(playerId, db = prisma) {
  const rows = await db.questProgress.findMany({
    where: { userId: playerId, completed: true },
    select: { questId: true, completed: true },
  })
  return earnedTitles(rows)
}

module.exports = { isMember, isMemberOfAny, makeMemberCheck, getPlayerStandings, getPlayerTitles, factionByMembershipQuest }
