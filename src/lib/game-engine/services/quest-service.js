const { prisma } = require('../../db-client')
const { playerHasItem, getPlayerInventory, removeItemBySlug } = require('./inventory-service')
const { getItemBySlug } = require('./inventory-service')
const QUESTS = require('../../game-data/quests.json')

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

  // One-quest-per-NPC gating (skip if system-started)
  if (!options.system && questDef.giver && questDef.giver.npcId) {
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
      if (activeQuestDef && activeQuestDef.giver && activeQuestDef.giver.npcId === questDef.giver.npcId) {
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
      data: data,
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
    // Consume requirements if needed
    if (questDef.consumeRequirementsOnComplete && questDef.requirements) {
      for (const requirement of questDef.requirements) {
        if (requirement.type === 'hasItem') {
          const { itemSlug, quantity = 1 } = requirement
          const removeResult = await removeItemBySlug(playerId, itemSlug, quantity, tx)
          if (!removeResult.success) {
            throw new Error(`Failed to remove ${itemSlug}: ${removeResult.error}`)
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

    // Mark quest as completed
    await tx.questProgress.update({
      where: { id: questProgress.id },
      data: {
        completed: true,
        progress: 1,
      },
    })

    return { updatedUser }
  })

  // Run onComplete effects (outside transaction but after completion is committed)
  // These effects may start new quests, which is safe to do after the transaction
  let startedQuestIds = []
  if (questDef.onComplete && Array.isArray(questDef.onComplete)) {
    const effectResult = await runQuestEffects(playerId, questDef.onComplete)
    startedQuestIds = effectResult.startedQuestIds || []
  }

  // Get updated inventory
  const inventory = await getPlayerInventory(playerId)

  // Get updated quests list
  const quests = await getAllQuestProgress(playerId)

  return {
    success: true,
    player: result.updatedUser,
    inventory,
    quests,
    startedQuestIds,
  }
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

module.exports = {
  getQuestDef,
  listQuestDefs,
  getQuestProgress,
  acceptQuest,
  checkQuestRequirements,
  completeQuest,
  getAllQuestProgress,
  runQuestEffects,
}
