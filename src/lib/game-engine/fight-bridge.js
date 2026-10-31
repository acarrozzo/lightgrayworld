/**
 * What an HTTP route needs to know about the fight its player may be in.
 *
 * Shopping and spending points arrive over HTTP rather than through the
 * socket's action queue, so nothing in them used to notice a fight: you could
 * buy potions or put CP into STR between swings for free. These two helpers
 * reach the engine the unified server puts on `globalThis` (server.js,
 * socket-server.js). A route served with no engine behind it sees nobody
 * fighting, which is the safe answer for a read and a free spend.
 *
 * Plain CommonJS like the rest of the engine, so the TypeScript routes can
 * `require()` it.
 */

function engine() {
  return globalThis.gameEngine ?? null
}

/**
 * Whether this player is in a battle right now.
 * @param {string} playerId
 * @returns {boolean}
 */
function isInFight(playerId) {
  return Boolean(engine()?.findBattleRoom?.(playerId))
}

/**
 * Spend the player's turn on something the route just did, if they are
 * fighting: the enemy answers it, through the player's own action queue.
 * Never throws: the spend itself has already been written, and failing the
 * request over the enemy's answer would only make the client retry it.
 *
 * @param {string} playerId
 * @param {{ kind: string, label: string, text: string, icon: string }} turn
 */
async function spendFightTurn(playerId, { kind, label, text, icon }) {
  const live = engine()
  if (!live?.spendFightTurn || !isInFight(playerId)) return null
  try {
    return await live.spendFightTurn(playerId, {
      kind,
      itemSlug: null,
      itemName: null,
      itemMetadata: { icon },
      actionVerb: null,
      effectText: null,
      label,
      text,
    })
  } catch (error) {
    console.error('[fight-bridge] Failed to spend the fight turn for', playerId, error)
    return null
  }
}

module.exports = { isInFight, spendFightTurn }
