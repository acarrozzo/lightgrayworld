const { prisma } = require('../../db-client')
const { playerHasItem, getPlayerInventory, removeItemBySlug, grantItemOnce } = require('./inventory-service')
const { getItemBySlug } = require('./inventory-service')
const QUESTS = require('../../game-data/quests.json')
const { checkAndApplyLevelUp } = require('./leveling-service')
const { unlockSkillTeachersForQuest } = require('./skill-service')
const { unlockSpellTeachersForQuest } = require('./spell-service')

/**
 * Get quest definition from registry
 * @param {string} questId - The quest ID
 * @returns {Object|null} Quest definition or null if not found
 */
function getQuestDef(questId) {
  return QUESTS[questId] || null
}

/**
 * List all quest definitions sorted by number
 * @returns {Array} Array of quest definitions
 */
function listQuestDefs() {
  return Object.values(QUESTS).sort((a, b) => a.number - b.number)
}

/**
 * List quests given by a specific NPC, sorted by number.
 * Each entry includes its quest id so callers can look up progress / build actions.
 * @param {string} npcId - The quest giver's npcId
 * @returns {Array} Array of { id, ...questDef } sorted by number
 */
function listQuestsByGiver(npcId) {
  return Object.entries(QUESTS)
    .filter(([, def]) => def.giver && def.giver.npcId === npcId)
    .map(([id, def]) => ({ id, ...def }))
    .sort((a, b) => a.number - b.number)
}

/**
 * Get quest progress for a player
 * @param {string} playerId - The player's ID
 * @param {string} questId - The quest ID
 * @returns {Promise<Object|null>} Quest progress or null if not found
 */
async function getQuestProgress(playerId, questId) {
  return prisma.questProgress.findUnique({
    where: {
      userId_questId: {
        userId: playerId,
        questId: questId,
      },
    },
  })
}

/**
 * Run quest effects (startQuest, completeQuest)
 * @param {string} playerId - The player's ID
 * @param {Array} effects - Array of effect objects
 * @param {Set} visitedQuestIds - Set of quest IDs already processed (prevents infinite loops)
 * @returns {Promise<Object>} Result with success status and started quest IDs
 */
async function runQuestEffects(playerId, effects, visitedQuestIds = new Set()) {
  if (!effects || !Array.isArray(effects)) {
    return { success: true, startedQuestIds: [] }
  }

  const { randomUUID } = require('crypto')
  const startedQuestIds = []

  for (const effect of effects) {
    if (!effect || !effect.type) continue

    if (effect.type === 'startQuest') {
      const { questId } = effect
      if (!questId) continue

      // Prevent infinite loops
      if (visitedQuestIds.has(questId)) {
        console.warn(`[runQuestEffects] Skipping already visited quest: ${questId}`)
        continue
      }

      // Mark as visited
      visitedQuestIds.add(questId)

      // Check if quest already exists before accepting
      const existingProgress = await getQuestProgress(playerId, questId)
      const wasNewlyCreated = !existingProgress

      // Accept quest with system flag (bypasses room validation and NPC gating)
      const acceptResult = await acceptQuest(playerId, questId, null, { system: true })
      if (!acceptResult.success) {
        console.error(`[runQuestEffects] Failed to start quest ${questId}:`, acceptResult.error)
        // Continue with other effects even if one fails
      } else if (wasNewlyCreated) {
        // Only track quests that were newly created (didn't exist before)
        startedQuestIds.push(questId)
      }
    } else if (effect.type === 'completeQuest') {
      const { questId } = effect
      if (!questId) continue

      // Prevent infinite loops
      if (visitedQuestIds.has(questId)) {
        console.warn(`[runQuestEffects] Skipping already visited quest: ${questId}`)
        continue
      }

      // Mark as visited
      visitedQuestIds.add(questId)

      // Upsert quest as completed
      await prisma.questProgress.upsert({
        where: {
          userId_questId: {
            userId: playerId,
            questId: questId,
          },
        },
        update: {
          completed: true,
          progress: 1,
        },
        create: {
          id: randomUUID(),
          userId: playerId,
          questId: questId,
          progress: 1,
          completed: true,
        },
      })
    }
  }

  return { success: true, startedQuestIds }
}

/**
 * Accept a quest (create quest progress entry)
 * @param {string} playerId - The player's ID
 * @param {string} questId - The quest ID
 * @param {string} choiceId - Optional choice ID for branching
 * @param {Object} options - Optional options object with system flag
 * @returns {Promise<Object>} Result with quest progress or error
 */
async function acceptQuest(playerId, questId, choiceId = null, options = { system: false }) {
  const { randomUUID } = require('crypto')
  
  // Get quest definition
  const questDef = getQuestDef(questId)
  if (!questDef) {
    return { success: false, error: 'Quest not found' }
  }

  // Check if quest already exists
  const existing = await getQuestProgress(playerId, questId)
  if (existing) {
    return { success: true, questProgress: existing }
  }

  // Extract quests that will be completed by onAccept effects
  const questsToBeCompleted = new Set()
  if (questDef.onAccept && Array.isArray(questDef.onAccept)) {
    for (const effect of questDef.onAccept) {
      if (effect.type === 'completeQuest') {
        questsToBeCompleted.add(effect.questId)
      }
    }
  }

  // One-main-quest-per-NPC gating. Side quests never block or get blocked, and
  // intro quests ("talk to the NPC") are only ever system-started, so the gate
  // is about main quests alone.
  if (!options.system && questDef.questType === 'main' && questDef.giver && questDef.giver.npcId) {
    const activeQuests = await prisma.questProgress.findMany({
      where: {
        userId: playerId,
        completed: false,
      },
    })

    for (const activeQuest of activeQuests) {
      // Skip quests that will be completed by onAccept effects
      if (questsToBeCompleted.has(activeQuest.questId)) {
        continue
      }

      const activeQuestDef = getQuestDef(activeQuest.questId)
      // Only block on main quest conflicts — side and intro quests from the same NPC never block
      if (
        activeQuestDef &&
        activeQuestDef.questType === 'main' &&
        activeQuestDef.giver &&
        activeQuestDef.giver.npcId === questDef.giver.npcId
      ) {
        return {
          success: false,
          error: `You already have a quest from ${questDef.giver.npcId === 'old_man' ? 'the Old Man' : questDef.giver.npcId}.`
        }
      }
    }
  }

  // Prepare data field
  const data = choiceId ? { acceptChoice: choiceId } : null

  // Create new quest progress
  const questProgress = await prisma.questProgress.create({
    data: {
      id: randomUUID(),
      userId: playerId,
      questId: questId,
      progress: 0,
      completed: false,
      data,
    },
  })

  // Handle onAccept effects (quest chains)
  if (questDef.onAccept && Array.isArray(questDef.onAccept)) {
    for (const effect of questDef.onAccept) {
      if (effect.type === 'completeQuest') {
        const linkedQuestId = effect.questId
        // Idempotent: upsert the linked quest as completed
        await prisma.questProgress.upsert({
          where: {
            userId_questId: {
              userId: playerId,
              questId: linkedQuestId,
            },
          },
          update: {
            completed: true,
            progress: 1,
          },
          create: {
            id: randomUUID(),
            userId: playerId,
            questId: linkedQuestId,
            progress: 1,
            completed: true,
          },
        })
      }
    }
  }

  return { success: true, questProgress }
}

/**
 * Check if quest requirements are met
 * @param {string} playerId - The player's ID
 * @param {string} questId - The quest ID
 * @returns {Promise<Object>} Requirements check result
 */
async function checkQuestRequirements(playerId, questId) {
  const questDef = getQuestDef(questId)
  if (!questDef) {
    return { met: false, error: 'Quest not found' }
  }

  if (!questDef.requirements || questDef.requirements.length === 0) {
    return { met: true, details: {} }
  }

  const inventory = await getPlayerInventory(playerId)
  const itemQuantities = {}
  
  // Build item quantity map
  for (const item of inventory) {
    const slug = item.template.slug
    if (!itemQuantities[slug]) {
      itemQuantities[slug] = 0
    }
    itemQuantities[slug] += item.quantity
  }

  // Check each requirement
  for (const requirement of questDef.requirements) {
    if (requirement.type === 'hasItem') {
      const { itemSlug, quantity = 1 } = requirement
      const hasQuantity = (itemQuantities[itemSlug] || 0) >= quantity
      
      if (!hasQuantity) {
        return {
          met: false,
          details: {
            missingItem: itemSlug,
            requiredQuantity: quantity,
            currentQuantity: itemQuantities[itemSlug] || 0,
          },
        }
      }
    } else if (requirement.type === 'hasAnyItem') {
      // "Any one of these" — for goals that name a tier rather than a specific
      // item (craft a piece of leather equipment, bring any silver weapon).
      const { items = [], displayName } = requirement
      const satisfied = items.find(
        (entry) => (itemQuantities[entry.itemSlug] || 0) >= (entry.quantity ?? 1)
      )
      if (!satisfied) {
        return {
          met: false,
          details: {
            missingAnyOf: items.map((entry) => entry.itemSlug),
            displayName,
          },
        }
      }
    } else if (requirement.type === 'killCount') {
      const { enemySlug, count } = requirement
      const killEntry = await prisma.killList.findUnique({
        where: { userId_monster: { userId: playerId, monster: enemySlug } },
        select: { kills: true },
      })
      const current = killEntry?.kills ?? 0
      if (current < count) {
        return {
          met: false,
          details: {
            enemySlug,
            requiredKills: count,
            currentKills: current,
          },
        }
      }
    } else if (requirement.type === 'killCountGroup') {
      // "Ten goblins" where a goblin is any of four things. The Rocky Flats
      // Bounty Board asks for six families at once, and counting each family as
      // one line rather than four keeps the goal readable and keeps the quest
      // data declarative — the alternative is a quest-ID conditional in here.
      const { enemySlugs = [], count = 1 } = requirement
      const entries = await prisma.killList.findMany({
        where: { userId: playerId, monster: { in: enemySlugs } },
        select: { kills: true },
      })
      const current = entries.reduce((sum, e) => sum + e.kills, 0)
      if (current < count) {
        return {
          met: false,
          details: {
            enemySlugs,
            requiredKills: count,
            currentKills: current,
          },
        }
      }
    } else if (requirement.type === 'hasEquippedInSlot') {
      const { slot, notDefault } = requirement
      if (!slot) {
        return { met: false, details: { error: 'Slot not specified' } }
      }

      // Find equipped item in the specified slot
      const equippedItem = await prisma.playerItem.findFirst({
        where: {
          playerId,
          isEquipped: true,
          slot: slot,
        },
        include: {
          ItemTemplate: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      })

      // If notDefault is true (for MAIN_HAND), we need an equipped item (fists = no item)
      if (notDefault) {
        if (!equippedItem) {
          return {
            met: false,
            details: {
              missingSlot: slot,
              message: `No item equipped in ${slot}`,
            },
          }
        }
      } else {
        // If notDefault is false, just check if slot is equipped (or empty is allowed)
        // This case is not used in current quests, but handle it for completeness
        // For now, we'll require an item to be equipped
        if (!equippedItem) {
          return {
            met: false,
            details: {
              missingSlot: slot,
              message: `No item equipped in ${slot}`,
            },
          }
        }
      }
    } else if (requirement.type === 'hasFlag') {
      const { flag } = requirement
      const user = await prisma.user.findUnique({
        where: { id: playerId },
        select: { [flag]: true },
      })
      if (!user?.[flag]) {
        return {
          met: false,
          details: {
            missingFlag: flag,
          },
        }
      }
    } else if (requirement.type === 'level') {
      const { minLevel = 0 } = requirement
      const user = await prisma.user.findUnique({
        where: { id: playerId },
        select: { level: true },
      })
      const current = user?.level ?? 0
      if (current < minLevel) {
        return {
          met: false,
          details: {
            requiredLevel: minLevel,
            currentLevel: current,
          },
        }
      }
    }
  }

  return { met: true, details: { itemQuantities } }
}

/**
 * Complete a quest and grant rewards
 * @param {string} playerId - The player's ID
 * @param {string} questId - The quest ID
 * @returns {Promise<Object>} Completion result with updated player and inventory
 */
async function completeQuest(playerId, questId) {
  // Get quest definition
  const questDef = getQuestDef(questId)
  if (!questDef) {
    return { success: false, error: 'Quest not found' }
  }

  // Get quest progress
  const questProgress = await getQuestProgress(playerId, questId)
  if (!questProgress) {
    return { success: false, error: 'Quest not found' }
  }

  if (questProgress.completed) {
    return { success: false, error: 'Quest already completed' }
  }

  // Check requirements
  const requirements = await checkQuestRequirements(playerId, questId)
  if (!requirements.met) {
    return { success: false, error: 'Quest requirements not met' }
  }

  // Wrap everything in a transaction
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

    // Consume requirements if needed
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

    // Grant rewards
    let currencyIncrement = 0
    let xpIncrement = 0

    if (questDef.rewards && Array.isArray(questDef.rewards)) {
      for (const reward of questDef.rewards) {
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
    }

    // Update player (only if there are rewards)
    let updatedUser = null
    const updateData = {}
    if (currencyIncrement > 0) {
      updateData.currency = { increment: currencyIncrement }
    }
    if (xpIncrement > 0) {
      updateData.xp = { increment: xpIncrement }
    }

    if (Object.keys(updateData).length > 0) {
      updatedUser = await tx.user.update({
        where: { id: playerId },
        data: updateData,
        select: {
          id: true,
          currency: true,
          xp: true,
        },
      })
    } else {
      // No rewards, just fetch current user data
      updatedUser = await tx.user.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          currency: true,
          xp: true,
        },
      })
    }

    return { updatedUser }
  })

  if (result.alreadyCompleted) {
    return { success: false, error: 'Quest already completed' }
  }

  // Run onComplete effects (outside transaction but after completion is committed)
  // These effects may start new quests, which is safe to do after the transaction
  let startedQuestIds = []
  if (questDef.onComplete && Array.isArray(questDef.onComplete)) {
    const effectResult = await runQuestEffects(playerId, questDef.onComplete)
    startedQuestIds = effectResult.startedQuestIds || []
  }

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
  const [levelUp, inventory, quests, skillTeachersMet, spellTeachersMet] = await Promise.all([
    checkAndApplyLevelUp(playerId),
    getPlayerInventory(playerId),
    getAllQuestProgress(playerId),
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

  return {
    success: true,
    player,
    inventory,
    quests,
    startedQuestIds,
    levelUp,
    teachersMet,
  }
}

/**
 * The feed line for finishing an intro quest. Intro quests have no reward and
 * exist to walk the player to a quest giver, so "Quest completed: Talk to the
 * Old Man. You received: nothing" is the wrong shape — the moment is meeting
 * someone. Intro titles are authored as an imperative ("Talk to X", "Find X",
 * "Read X"), and that verb is what turns into the past tense here; anything
 * else falls back to meeting the giver by name.
 * @param {Object} questDef
 * @returns {string}
 */
function describeIntroCompletion(questDef) {
  const title = questDef?.title || ''
  const verbs = [
    [/^Talk to (.+)$/i, 'meet'],
    [/^Find (.+)$/i, 'find'],
    [/^Read (.+)$/i, 'read'],
  ]
  for (const [pattern, verb] of verbs) {
    const match = title.match(pattern)
    if (match) return `You ${verb} ${match[1]}.`
  }
  return `You meet ${questDef?.giver?.name || 'the quest giver'}.`
}

/**
 * Get all quest progress for a player
 * @param {string} playerId - The player's ID
 * @returns {Promise<Array>} Array of quest progress entries
 */
async function getAllQuestProgress(playerId) {
  return prisma.questProgress.findMany({
    where: { userId: playerId },
    orderBy: { questId: 'asc' },
  })
}

/**
 * Player explicitly accepts a quest shown on the NPC card.
 * - Sets data.accepted = true so the quest moves from Accept → In Progress state.
 * - For quests with no requirements (talk quests), immediately completes them and
 *   runs onComplete effects so the chain advances in a single click.
 * @param {string} playerId
 * @param {string} questId
 * @returns {Promise<Object>}
 */
async function playerAcceptQuest(playerId, questId) {
  const questDef = getQuestDef(questId)
  if (!questDef) return { success: false, error: 'Quest not found' }

  const questProgress = await getQuestProgress(playerId, questId)
  if (!questProgress) return { success: false, error: 'Quest not available' }
  if (questProgress.completed) return { success: false, error: 'Quest already completed' }

  const existingData = (questProgress.data && typeof questProgress.data === 'object') ? questProgress.data : {}

  // Mark as player-accepted
  await prisma.questProgress.update({
    where: { id: questProgress.id },
    data: { data: { ...existingData, accepted: true } },
  })

  // No requirements — complete immediately so the chain advances
  const hasRequirements = questDef.requirements && questDef.requirements.length > 0
  if (!hasRequirements) {
    return completeQuest(playerId, questId)
  }

  const updatedProgress = await getAllQuestProgress(playerId)
  return { success: true, quests: updatedProgress }
}

module.exports = {
  getQuestDef,
  listQuestDefs,
  listQuestsByGiver,
  getQuestProgress,
  acceptQuest,
  checkQuestRequirements,
  completeQuest,
  getAllQuestProgress,
  runQuestEffects,
  playerAcceptQuest,
  describeIntroCompletion,
}
