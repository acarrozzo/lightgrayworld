const { prisma } = require('../../db-client')

/**
 * Fetch or create the ActionCap record for a player/room/action tuple.
 * The row is keyed by (playerId, roomId, actionKey) and stores the rolling
 * gather cooldown's `lastActionAt` timestamp.
 */
async function getOrCreateActionCap(playerId, roomId, actionKey) {
  const existing = await prisma.actionCap.findUnique({
    where: {
      playerId_roomId_actionKey: { playerId, roomId, actionKey },
    },
  })

  if (existing) {
    return existing
  }

  return prisma.actionCap.create({
    data: {
      playerId,
      roomId,
      actionKey,
    },
  })
}

/**
 * Rolling per-action cooldown gate (decoupled from the global world tick).
 *
 * The window is rolling: it starts the moment the player last performed the
 * action. Used for gather actions that grant a batch in a single click and then
 * lock for `cooldownMs` (e.g. shovel sand, pick berries).
 */
async function checkAndConsumeCooldown(playerId, roomId, actionKey, cooldownMs) {
  if (!playerId || !roomId || !actionKey) {
    throw new Error('checkAndConsumeCooldown requires playerId, roomId, and actionKey')
  }
  if (typeof cooldownMs !== 'number' || cooldownMs <= 0) {
    throw new Error('checkAndConsumeCooldown requires a positive cooldownMs')
  }

  const record = await getOrCreateActionCap(playerId, roomId, actionKey)
  const now = Date.now()

  if (record.lastActionAt) {
    const elapsed = now - new Date(record.lastActionAt).getTime()
    if (elapsed < cooldownMs) {
      return {
        allowed: false,
        secondsRemaining: Math.ceil((cooldownMs - elapsed) / 1000),
      }
    }
  }

  await prisma.actionCap.update({
    where: {
      playerId_roomId_actionKey: { playerId, roomId, actionKey },
    },
    data: { lastActionAt: new Date(now) },
  })

  return {
    allowed: true,
    secondsRemaining: Math.ceil(cooldownMs / 1000),
  }
}

/**
 * Read-only remaining cooldown seconds for a rolling gate (for UI), 0 if ready.
 */
async function getCooldownRemaining(playerId, roomId, actionKey, cooldownMs) {
  if (!playerId || !roomId || !actionKey) {
    throw new Error('getCooldownRemaining requires playerId, roomId, and actionKey')
  }
  if (typeof cooldownMs !== 'number' || cooldownMs <= 0) {
    throw new Error('getCooldownRemaining requires a positive cooldownMs')
  }

  const record = await getOrCreateActionCap(playerId, roomId, actionKey)
  if (!record.lastActionAt) return 0

  const elapsed = Date.now() - new Date(record.lastActionAt).getTime()
  return Math.max(0, Math.ceil((cooldownMs - elapsed) / 1000))
}

module.exports = {
  checkAndConsumeCooldown,
  getCooldownRemaining,
}
