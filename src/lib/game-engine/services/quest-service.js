const { prisma } = require('../../db-client')
const { getPlayerInventory, removeItemBySlug, grantItemOnce } = require('./inventory-service')
const registry = require('../../game-data/quest-registry')
const { getFaction } = require('../../game-data/factions')
const { checkAndApplyLevelUp } = require('./leveling-service')
const { unlockSkillTeachersForQuest } = require('./skill-service')
const { unlockSpellTeachersForQuest } = require('./spell-service')
const { isMember } = require('./faction-service')

/**
 * Quests, givers, and the moment of meeting someone.
 *
 * Durable state is two tables: GiverMet (who the player has talked to) and
 * QuestProgress (one row per quest the player can see, `completed` when it is
 * turned in). A quest's row is created when it opens — its giver is met and
 * every quest in its `after` list is complete — so "the quests I have" is
 * still one findMany, as it always was. Everything else (standing, titles,
 * who is still out there to find) is derived from those rows by the registry.
 */

const { getQuestDef, getGiver, giverIdForQuest, listGiverQuestIds } = registry

/** Every quest definition in authored order (giver order, then the giver's list). */
function listQuestDefs() {
  return registry.QUEST_ORDER.map((id) => ({ id, ...getQuestDef(id) }))
}

/** A giver's quests with their ids, in the giver's order. */
function listQuestsByGiver(giverId) {
  return listGiverQuestIds(giverId).map((id) => ({ id, ...getQuestDef(id) }))
}

async function getQuestProgress(playerId, questId, db = prisma) {
  return db.questProgress.findUnique({
    where: { userId_questId: { userId: playerId, questId } },
  })
}

async function getAllQuestProgress(playerId, db = prisma) {
  return db.questProgress.findMany({
    where: { userId: playerId },
    orderBy: { questId: 'asc' },
  })
}

async function getGiverMet(playerId, giverId, db = prisma) {
  return db.giverMet.findUnique({
    where: { userId_giverId: { userId: playerId, giverId } },
  })
}

async function getMetGiverIds(playerId, db = prisma) {
  const rows = await db.giverMet.findMany({ where: { userId: playerId }, select: { giverId: true } })
  return rows.map((r) => r.giverId)
}

/**
 * What the client keeps in its store: the quest rows and the givers met. Every
 * payload that used to carry `quests` carries both now, so the journal can
 * tell "not met yet" from "met, nothing open".
 */
async function getQuestState(playerId, db = prisma) {
  const [quests, giversMet] = await Promise.all([getAllQuestProgress(playerId, db), getMetGiverIds(playerId, db)])
  return { quests, giversMet }
}

/**
 * Check a requirement list against the player. Used for quest turn-ins and for
 * a giver's `meetRequirements`; the vocabulary is shared so a gate reads the
 * same whether it is on a quest or on the person giving it.
 */
async function checkRequirements(playerId, requirements, db = prisma) {
  if (!requirements || requirements.length === 0) {
    return { met: true, details: {} }
  }

  const needsInventory = requirements.some((r) => r.type === 'hasItem' || r.type === 'hasAnyItem')
  const itemQuantities = {}
  if (needsInventory) {
    const inventory = await getPlayerInventory(playerId)
    for (const item of inventory) {
      const slug = item.template.slug
      itemQuantities[slug] = (itemQuantities[slug] || 0) + item.quantity
    }
  }

  for (const requirement of requirements) {
    if (requirement.type === 'hasItem') {
      const { itemSlug, quantity = 1 } = requirement
      if ((itemQuantities[itemSlug] || 0) < quantity) {
        return {
          met: false,
          details: { missingItem: itemSlug, requiredQuantity: quantity, currentQuantity: itemQuantities[itemSlug] || 0 },
        }
      }
    } else if (requirement.type === 'hasAnyItem') {
      // "Any one of these" — for goals that name a tier rather than a specific
      // item (craft a piece of leather equipment, bring any silver weapon).
      const { items = [], displayName } = requirement
      const satisfied = items.find((entry) => (itemQuantities[entry.itemSlug] || 0) >= (entry.quantity ?? 1))
      if (!satisfied) {
        return { met: false, details: { missingAnyOf: items.map((entry) => entry.itemSlug), displayName } }
      }
    } else if (requirement.type === 'killCount') {
      const { enemySlug, count } = requirement
      const killEntry = await db.killList.findUnique({
        where: { userId_monster: { userId: playerId, monster: enemySlug } },
        select: { kills: true },
      })
      const current = killEntry?.kills ?? 0
      if (current < count) {
        return { met: false, details: { enemySlug, requiredKills: count, currentKills: current } }
      }
    } else if (requirement.type === 'killCountGroup') {
      // "Ten goblins" where a goblin is any of four things. The Rocky Flats
      // Bounty Board asks for six families at once, and counting each family as
      // one line rather than four keeps the goal readable.
      const { enemySlugs = [], count = 1 } = requirement
      const entries = await db.killList.findMany({
        where: { userId: playerId, monster: { in: enemySlugs } },
        select: { kills: true },
      })
      const current = entries.reduce((sum, e) => sum + e.kills, 0)
      if (current < count) {
        return { met: false, details: { enemySlugs, requiredKills: count, currentKills: current } }
      }
    } else if (requirement.type === 'hasEquippedInSlot') {
      const { slot } = requirement
      if (!slot) return { met: false, details: { error: 'Slot not specified' } }
      const equippedItem = await db.playerItem.findFirst({
        where: { playerId, isEquipped: true, slot },
        select: { id: true },
      })
      if (!equippedItem) {
        return { met: false, details: { missingSlot: slot, message: `No item equipped in ${slot}` } }
      }
    } else if (requirement.type === 'hasFlag') {
      const { flag } = requirement
      const user = await db.user.findUnique({ where: { id: playerId }, select: { [flag]: true } })
      if (!user?.[flag]) {
        return { met: false, details: { missingFlag: flag } }
      }
    } else if (requirement.type === 'level') {
      const { minLevel = 0 } = requirement
      const user = await db.user.findUnique({ where: { id: playerId }, select: { level: true } })
      const current = user?.level ?? 0
      if (current < minLevel) {
        return { met: false, details: { requiredLevel: minLevel, currentLevel: current } }
      }
    } else if (requirement.type === 'memberOf') {
      // A guild's initiation turned in. The guild trainers only talk to members.
      if (!(await isMember(playerId, requirement.factionId, db))) {
        return { met: false, details: { notMemberOf: requirement.factionId } }
      }
    } else if (requirement.type === 'giverMet') {
      // The Young Soldier sends you to the Old Man first.
      if (!(await getGiverMet(playerId, requirement.giverId, db))) {
        return { met: false, details: { giverNotMet: requirement.giverId } }
      }
    } else if (requirement.type === 'questCompleted') {
      const row = await getQuestProgress(playerId, requirement.questId, db)
      if (!row?.completed) {
        return { met: false, details: { questNotCompleted: requirement.questId } }
      }
    } else if (requirement.type === 'factionsComplete') {
      // The Pillar's capstones: every quest of every named faction turned in.
      const rows = await db.questProgress.findMany({
        where: { userId: playerId, completed: true },
        select: { questId: true, completed: true },
      })
      const standings = (requirement.factionIds ?? []).map((id) => registry.factionStanding(id, rows))
      const incomplete = standings.filter((s) => !s || !s.complete)
      if (incomplete.length) {
        return {
          met: false,
          details: {
            factionsIncomplete: incomplete.map((s) => s?.factionId).filter(Boolean),
            standings,
          },
        }
      }
    }
  }

  return { met: true, details: { itemQuantities } }
}

async function checkQuestRequirements(playerId, questId) {
  const questDef = getQuestDef(questId)
  if (!questDef) return { met: false, error: 'Quest not found' }
  return checkRequirements(playerId, questDef.requirements)
}

/**
 * Create rows for every quest of a giver that is open and has none yet. Safe to
 * call any time: it is how a giver's set appears on meeting, how a quest's
 * dependents appear when it completes, and how a quest added to a giver later
 * reaches players who met that giver before it existed.
 *
 * @returns {Promise<string[]>} the ids opened by this call
 */
async function openQuestsForGiver(playerId, giverId, db = prisma) {
  const { randomUUID } = require('crypto')
  const questIds = listGiverQuestIds(giverId)
  if (questIds.length === 0) return []

  const rows = await db.questProgress.findMany({
    where: { userId: playerId, questId: { in: questIds } },
    select: { questId: true, completed: true },
  })
  const have = new Set(rows.map((r) => r.questId))
  const done = registry.completedSet(rows)

  const opened = []
  for (const questId of questIds) {
    if (have.has(questId)) continue
    if (!registry.isQuestOpen(questId, done)) continue
    // createMany + skipDuplicates: a concurrent open of the same quest (two
    // sockets, one account) leaves one row and no error.
    const created = await db.questProgress.createMany({
      data: [{ id: randomUUID(), userId: playerId, questId, progress: 0, completed: false }],
      skipDuplicates: true,
    })
    if (created.count > 0) opened.push(questId)
  }
  return opened
}

/**
 * Meet a giver: record it once and open their quests. Idempotent — a second
 * meeting records nothing and opens only what has become open since.
 *
 * @returns {Promise<{ alreadyMet: boolean, openedQuestIds: string[] }>}
 */
async function meetGiver(playerId, giverId, db = prisma) {
  const giver = getGiver(giverId)
  if (!giver) return { alreadyMet: false, openedQuestIds: [], error: 'Unknown quest giver' }

  const { randomUUID } = require('crypto')
  const created = await db.giverMet.createMany({
    data: [{ id: randomUUID(), userId: playerId, giverId }],
    skipDuplicates: true,
  })
  const openedQuestIds = await openQuestsForGiver(playerId, giverId, db)
  return { alreadyMet: created.count === 0, openedQuestIds }
}

/**
 * Bring a player's rows up to date with the data: every met giver gets any
 * quest that has become open. Run on journal load, so content added after a
 * player passed through still reaches them.
 */
async function reconcileQuestState(playerId, db = prisma) {
  const { randomUUID } = require('crypto')
  const met = new Set(await getMetGiverIds(playerId, db))

  // A row for one of a giver's quests means the player met that giver — the
  // safety net for accounts that predate GiverMet (or the giver's intro).
  const rows = await db.questProgress.findMany({ where: { userId: playerId }, select: { questId: true } })
  for (const row of rows) {
    const giverId = giverIdForQuest(row.questId)
    if (!giverId || met.has(giverId)) continue
    await db.giverMet.createMany({ data: [{ id: randomUUID(), userId: playerId, giverId }], skipDuplicates: true })
    met.add(giverId)
  }

  const opened = []
  for (const giverId of met) {
    opened.push(...(await openQuestsForGiver(playerId, giverId, db)))
  }
  return opened
}

/**
 * Complete a quest and grant rewards
 * @param {string} playerId - The player's ID
 * @param {string} questId - The quest ID
 * @returns {Promise<Object>} Completion result with updated player and inventory
 */
async function completeQuest(playerId, questId) {
  const questDef = getQuestDef(questId)
  if (!questDef) {
    return { success: false, error: 'Quest not found' }
  }

  const questProgress = await getQuestProgress(playerId, questId)
  if (!questProgress) {
    return { success: false, error: 'Quest not found' }
  }

  if (questProgress.completed) {
    return { success: false, error: 'Quest already completed' }
  }

  const requirements = await checkQuestRequirements(playerId, questId)
  if (!requirements.met) {
    return { success: false, error: 'Quest requirements not met' }
  }

  const result = await prisma.$transaction(async (tx) => {
    // Claim the completion before granting anything. This conditional write is
    // the idempotency barrier: a concurrent second turn-in blocks on this row,
    // then matches nothing once the first commits, so the rewards below are
    // granted exactly once. The `completed` check above runs outside the
    // transaction and cannot stop a request that arrives while this one is still
    // in flight — and the HTTP completion route reaches this function outside the
    // per-player action queue, so in-process serialization does not cover it.
    const claimed = await tx.questProgress.updateMany({
      where: { id: questProgress.id, completed: false },
      data: { completed: true, progress: 1 },
    })

    if (claimed.count === 0) {
      // Nothing has been written yet, so returning here commits an empty
      // transaction rather than rolling back a partial grant.
      return { alreadyCompleted: true }
    }

    if (questDef.consumeRequirementsOnComplete && questDef.requirements) {
      for (const requirement of questDef.requirements) {
        if (requirement.type === 'hasItem') {
          const { itemSlug, quantity = 1 } = requirement
          const removeResult = await removeItemBySlug(playerId, itemSlug, quantity, tx)
          if (!removeResult.success) {
            throw new Error(`Failed to remove ${itemSlug}: ${removeResult.error}`)
          }
        } else if (requirement.type === 'hasAnyItem') {
          // Take the first option the player actually satisfies, so a
          // "bring any one of these" turn-in consumes exactly what it asked for.
          const held = requirements.details?.itemQuantities ?? {}
          const chosen = (requirement.items ?? []).find(
            (entry) => (held[entry.itemSlug] || 0) >= (entry.quantity ?? 1)
          )
          if (!chosen) {
            throw new Error('No qualifying item to consume for hasAnyItem requirement')
          }
          const removeResult = await removeItemBySlug(playerId, chosen.itemSlug, chosen.quantity ?? 1, tx)
          if (!removeResult.success) {
            throw new Error(`Failed to remove ${chosen.itemSlug}: ${removeResult.error}`)
          }
        }
      }
    }

    let currencyIncrement = 0
    let xpIncrement = 0

    for (const reward of questDef.rewards ?? []) {
      if (reward.type === 'currency') {
        currencyIncrement += reward.amount || 0
      } else if (reward.type === 'xp') {
        xpIncrement += reward.amount || 0
      } else if (reward.type === 'item') {
        // Grant inside the transaction so item rewards stay atomic with
        // requirement-consume and completion.
        const grantResult = await grantItemOnce(playerId, reward.itemSlug, reward.quantity || 1, tx)
        if (!grantResult.granted) {
          throw new Error(`Failed to grant ${reward.itemSlug}: ${grantResult.reason}`)
        }
      }
    }

    const updateData = {}
    if (currencyIncrement > 0) updateData.currency = { increment: currencyIncrement }
    if (xpIncrement > 0) updateData.xp = { increment: xpIncrement }

    const select = { id: true, currency: true, xp: true }
    const updatedUser = Object.keys(updateData).length > 0
      ? await tx.user.update({ where: { id: playerId }, data: updateData, select })
      : await tx.user.findUnique({ where: { id: playerId }, select })

    return { updatedUser }
  })

  if (result.alreadyCompleted) {
    return { success: false, error: 'Quest already completed' }
  }

  // Now that the completion is committed, the giver's dependents may be open.
  const giverId = giverIdForQuest(questId)
  const startedQuestIds = giverId ? await openQuestsForGiver(playerId, giverId) : []

  // Run post-transaction reads in parallel. The teacher unlocks ride along:
  // a guild's initiation is turned in inside the guild, so no arrival follows
  // it to introduce the teacher — the quest completing is that moment. They
  // are guarded writes, so a failure here costs the player a feed line, never
  // the quest, which has already committed.
  const teachersOrNone = (promise, kind) =>
    promise.catch((err) => {
      console.error(`[Quest] Failed to unlock ${kind} teacher after ${questId}:`, err)
      return []
    })
  const [levelUp, inventory, state, skillTeachersMet, spellTeachersMet] = await Promise.all([
    checkAndApplyLevelUp(playerId),
    getPlayerInventory(playerId),
    getQuestState(playerId),
    teachersOrNone(unlockSkillTeachersForQuest(prisma, playerId, questId), 'skill'),
    teachersOrNone(unlockSpellTeachersForQuest(prisma, playerId, questId), 'spell'),
  ])

  // Each met teacher in the shape an arrival announces one: a feed line and
  // the `player` fragment the client merges into its store.
  const teachersMet = [
    ...skillTeachersMet.map((met) => ({ kind: 'skill', message: met.message, player: { skillTeachers: met.skillTeachers } })),
    ...spellTeachersMet.map((met) => ({ kind: 'spell', message: met.message, player: { spellTeachers: met.spellTeachers } })),
  ]
  const player = teachersMet.length
    ? Object.assign({}, result.updatedUser, ...teachersMet.map((met) => met.player))
    : result.updatedUser

  // Standing with the quest's faction after this turn-in, for the popup and
  // the feed. The Pillar's capstones have no faction and report nothing.
  const factionId = giverId ? getGiver(giverId)?.faction : null
  const standing = factionId ? registry.factionStanding(factionId, state.quests) : null
  const faction = factionId ? getFaction(factionId) : null
  const becameMember = !!(faction && faction.membershipQuest === questId)

  return {
    success: true,
    player,
    inventory,
    quests: state.quests,
    giversMet: state.giversMet,
    startedQuestIds,
    levelUp,
    teachersMet,
    standing,
    becameMember,
  }
}

/**
 * Player explicitly accepts a quest shown on the NPC card.
 * - Sets data.accepted = true so the quest moves from Accept → In Progress state.
 * - For quests with no requirements, immediately completes them so the chain
 *   advances in a single click.
 */
async function playerAcceptQuest(playerId, questId) {
  const questDef = getQuestDef(questId)
  if (!questDef) return { success: false, error: 'Quest not found' }

  const questProgress = await getQuestProgress(playerId, questId)
  if (!questProgress) return { success: false, error: 'Quest not available' }
  if (questProgress.completed) return { success: false, error: 'Quest already completed' }

  const existingData = (questProgress.data && typeof questProgress.data === 'object') ? questProgress.data : {}

  await prisma.questProgress.update({
    where: { id: questProgress.id },
    data: { data: { ...existingData, accepted: true } },
  })

  const hasRequirements = questDef.requirements && questDef.requirements.length > 0
  if (!hasRequirements) {
    return completeQuest(playerId, questId)
  }

  const state = await getQuestState(playerId)
  return { success: true, quests: state.quests, giversMet: state.giversMet }
}

module.exports = {
  getQuestDef,
  getGiver,
  giverIdForQuest,
  listQuestDefs,
  listQuestsByGiver,
  getQuestProgress,
  getAllQuestProgress,
  getGiverMet,
  getMetGiverIds,
  getQuestState,
  checkRequirements,
  checkQuestRequirements,
  openQuestsForGiver,
  meetGiver,
  reconcileQuestState,
  completeQuest,
  playerAcceptQuest,
}
