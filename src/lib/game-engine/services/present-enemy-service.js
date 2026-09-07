const { prisma } = require('../../db-client')

// Persists the one enemy present for a player in a room so it survives a page
// refresh / reconnect. A null slug deletes the row (nothing present). Callers
// should treat these as fire-and-forget (.catch) — a failed write must not break
// combat.

async function savePresentEnemy(userId, roomId, slug) {
  if (!userId || !roomId) return
  if (!slug) {
    await prisma.playerRoomEnemy.deleteMany({ where: { userId, roomId } })
    return
  }
  await prisma.playerRoomEnemy.upsert({
    where: { userId_roomId: { userId, roomId } },
    create: { userId, roomId, enemySlug: slug },
    update: { enemySlug: slug },
  })
}

// Returns the persisted slug for a room, or null if nothing is persisted.
async function loadPresentEnemy(userId, roomId) {
  if (!userId || !roomId) return null
  const row = await prisma.playerRoomEnemy.findUnique({
    where: { userId_roomId: { userId, roomId } },
    select: { enemySlug: true },
  })
  return row?.enemySlug ?? null
}

module.exports = { savePresentEnemy, loadPresentEnemy }
