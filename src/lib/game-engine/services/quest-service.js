const { prisma } = require('../../db-client')
const { playerHasItem, getPlayerInventory } = require('./inventory-service')
const { getItemBySlug } = require('./inventory-service')

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
 * Accept a quest (create quest progress entry)
 * @param {string} playerId - The player's ID
 * @param {string} questId - The quest ID
 * @returns {Promise<Object>} Created quest progress
 */
async function acceptQuest(playerId, questId) {
  const { randomUUID } = require('crypto')
  
  // Check if quest already exists
  const existing = await getQuestProgress(playerId, questId)
  if (existing) {
    return existing
  }

  // Create new quest progress
  return prisma.questProgress.create({
    data: {
      id: randomUUID(),
      userId: playerId,
      questId: questId,
      progress: 0,
      completed: false,
    },
  })
}

/**
 * Check if quest requirements are met
 * @param {string} playerId - The player's ID
 * @param {string} questId - The quest ID
 * @returns {Promise<Object>} Requirements check result
 */
async function checkQuestRequirements(playerId, questId) {
  if (questId === 'quest_001') {
    // Quest 1: Need 1 yellow flower
    const hasFlower = await playerHasItem(playerId, 'flower')
    const inventory = await getPlayerInventory(playerId)
    const flowerItem = inventory.find(item => item.template.slug === 'flower')
    const flowerQuantity = flowerItem?.quantity || 0

    return {
      met: hasFlower && flowerQuantity >= 1,
      hasFlower,
      flowerQuantity,
    }
  }

  return { met: false }
}

/**
 * Complete a quest and grant rewards
 * @param {string} playerId - The player's ID
 * @param {string} questId - The quest ID
 * @returns {Promise<Object>} Completion result with updated player and inventory
 */
async function completeQuest(playerId, questId) {
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

  // Quest-specific completion logic
  if (questId === 'quest_001') {
    // Remove 1 flower from inventory
    const flowerTemplate = await getItemBySlug('flower')
    if (!flowerTemplate) {
      return { success: false, error: 'Flower item not found' }
    }

    const flowerItem = await prisma.playerItem.findFirst({
      where: {
        playerId,
        templateId: flowerTemplate.id,
      },
    })

    if (!flowerItem || flowerItem.quantity < 1) {
      return { success: false, error: 'Flower not found in inventory' }
    }

    // Remove flower
    if (flowerItem.quantity === 1) {
      await prisma.playerItem.delete({
        where: { id: flowerItem.id },
      })
    } else {
      await prisma.playerItem.update({
        where: { id: flowerItem.id },
        data: { quantity: flowerItem.quantity - 1 },
      })
    }

    // Grant rewards: 10 gold, 5 XP
    const updatedUser = await prisma.user.update({
      where: { id: playerId },
      data: {
        currency: { increment: 10 },
        xp: { increment: 5 },
      },
      select: {
        id: true,
        currency: true,
        xp: true,
      },
    })

    // Mark quest as completed
    await prisma.questProgress.update({
      where: { id: questProgress.id },
      data: {
        completed: true,
        progress: 1,
      },
    })

    // Get updated inventory
    const inventory = await getPlayerInventory(playerId)

    return {
      success: true,
      player: updatedUser,
      inventory,
    }
  }

  return { success: false, error: 'Unknown quest' }
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
  getQuestProgress,
  acceptQuest,
  checkQuestRequirements,
  completeQuest,
  getAllQuestProgress,
}


