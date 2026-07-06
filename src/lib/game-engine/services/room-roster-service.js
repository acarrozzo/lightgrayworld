const { prisma } = require('../../db-client')

// Persists a player's per-room enemy roster so it survives a page refresh /
// reconnect. An empty roster deletes the row (no enemies present). Callers should
// treat these as fire-and-forget (.catch) — a failed write must not break combat.

async function saveRoomRoster(userId, roomId, slugs) {
  if (!userId || !roomId) return
  if (!Array.isArray(slugs) || slugs.length === 0) {
    await prisma.playerRoomEnemy.deleteMany({ where: { userId, roomId } })
    return
  }
  await prisma.playerRoomEnemy.upsert({
    where: { userId_roomId: { userId, roomId } },
    create: { userId, roomId, enemySlugs: slugs },
    update: { enemySlugs: slugs },
  })
}

// Returns the ordered slug array for a room, or null if nothing is persisted.
async function loadRoomRoster(userId, roomId) {
  if (!userId || !roomId) return null
  const row = await prisma.playerRoomEnemy.findUnique({
    where: { userId_roomId: { userId, roomId } },
    select: { enemySlugs: true },
  })
  return row?.enemySlugs ?? null
}

module.exports = { saveRoomRoster, loadRoomRoster }
