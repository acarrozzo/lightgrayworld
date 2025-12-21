const { prisma } = require('../../db-client')

/**
 * Fetch or create the ActionCap record for a player/room/action tuple.
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
      usedCount: 0,
      lastTickNumber: 0,
    },
  })
}

/**
 * Apply lazy reset: if the stored tick differs from current, treat as reset.
 */
function applyLazyReset(record, currentTickNumber) {
  if (record.lastTickNumber === currentTickNumber) {
    return record
  }

  return {
    ...record,
    usedCount: 0,
    lastTickNumber: currentTickNumber,
  }
}

/**
 * Check and increment the cap for a player/action within a room for the current tick.
 * Increments only when allowed.
 */
async function checkAndIncrementCap(playerId, roomId, actionKey, maxCap, currentTickNumber) {
  if (!playerId || !roomId || !actionKey) {
    throw new Error('checkAndIncrementCap requires playerId, roomId, and actionKey')
  }
  if (typeof maxCap !== 'number' || maxCap <= 0) {
    throw new Error('checkAndIncrementCap requires a positive maxCap')
  }

  console.log(`[ActionCap] checkAndIncrementCap called: player=${playerId}, room=${roomId}, action=${actionKey}, maxCap=${maxCap}, currentTick=${currentTickNumber}`)

  const record = await getOrCreateActionCap(playerId, roomId, actionKey)
  console.log(`[ActionCap] Fetched record:`, record)

  const normalized = applyLazyReset(record, currentTickNumber)
  console.log(`[ActionCap] After lazy reset:`, normalized)

  if (normalized.usedCount >= maxCap) {
    console.log(`[ActionCap] Cap reached: usedCount=${normalized.usedCount} >= maxCap=${maxCap}`)
    return {
      allowed: false,
      remaining: 0,
      usedCount: normalized.usedCount,
      lastTickNumber: normalized.lastTickNumber,
    }
  }

  const updated = await prisma.actionCap.update({
    where: {
      playerId_roomId_actionKey: { playerId, roomId, actionKey },
    },
    data: {
      usedCount: normalized.usedCount + 1,
      lastTickNumber: currentTickNumber,
    },
  })

  console.log(`[ActionCap] Updated record:`, updated)

  const remaining = Math.max(0, maxCap - updated.usedCount)

  console.log(`[ActionCap] Allowed: usedCount=${updated.usedCount}, remaining=${remaining}`)

  return {
    allowed: true,
    remaining,
    usedCount: updated.usedCount,
    lastTickNumber: updated.lastTickNumber,
  }
}

/**
 * Read-only cap status for UI (uses lazy reset semantics).
 */
async function getRemainingCap(playerId, roomId, actionKey, maxCap, currentTickNumber) {
  if (!playerId || !roomId || !actionKey) {
    throw new Error('getRemainingCap requires playerId, roomId, and actionKey')
  }
  if (typeof maxCap !== 'number' || maxCap <= 0) {
    throw new Error('getRemainingCap requires a positive maxCap')
  }

  const record = await getOrCreateActionCap(playerId, roomId, actionKey)
  const normalized = applyLazyReset(record, currentTickNumber)

  return Math.max(0, maxCap - normalized.usedCount)
}

module.exports = {
  checkAndIncrementCap,
  getRemainingCap,
}

