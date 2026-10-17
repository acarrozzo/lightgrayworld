const { prisma } = require('../../db-client')

/**
 * A retreat's Battle Log row.
 *
 * A win and a death write their row inside the win transaction and the
 * defeat write (battle-win-handler). A retreat — the Retreat pill or a
 * teleport out of the fight — used to leave nothing behind; the fight simply
 * stopped. Now it gets its own row, outcome `FLED`, with the fight's ledger,
 * so the Battle Log says how far the fight got before you left and the
 * World Tool can review it like any other.
 *
 * Fire-and-forget: the retreat itself never waits on the database, and a
 * failed write loses a line of history, not the escape. Returns the promise
 * so a caller that wants to await it can.
 *
 * @param {string} playerId
 * @param {import('../battle-state').BattleState | { enemySlug?: string, enemyName?: string, turnCount?: number, totalDamageDealt?: number, totalDamageReceived?: number, maxSingleHit?: number, multiplayerBonusUsed?: boolean, turns?: unknown[] }} battleState
 * @returns {Promise<void>}
 */
async function recordBattleFled(playerId, battleState) {
  // Tests stand in a bare-bones battle and a database stub without this
  // table; neither should turn a retreat into an error.
  if (!playerId || !battleState || !prisma?.battleLog?.create) return
  try {
    await prisma.battleLog.create({
      data: {
        userId: playerId,
        enemySlug: battleState.enemySlug || 'unknown',
        enemyName: battleState.enemyName || 'Unknown',
        outcome: 'FLED',
        turnsCount: battleState.turnCount || 0,
        totalDamageDealt: battleState.totalDamageDealt || 0,
        totalDamageReceived: battleState.totalDamageReceived || 0,
        maxSingleHit: battleState.maxSingleHit || 0,
        xpEarned: 0,
        goldEarned: 0,
        itemsDropped: [],
        multiplayerBonus: Boolean(battleState.multiplayerBonusUsed),
        turns: Array.isArray(battleState.turns) ? battleState.turns : [],
      },
    })
  } catch (error) {
    console.error(`recordBattleFled failed for player ${playerId}:`, error?.message || error)
  }
}

module.exports = { recordBattleFled }
