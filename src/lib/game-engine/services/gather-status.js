/**
 * Rolling gather-cooldown status for a room (sand / dirt / stone / berries /
 * trees), shaped for the in-room countdown.
 *
 * One definition for every surface that hands a room to the client: the socket
 * move payload, the HTTP room load, and the standalone gather route. The three
 * used to carry their own copy of this mapping, and the client fetched it over
 * HTTP on every room change even when the room it had just been handed already
 * came with the answer — so a step between rooms cost an extra request, an
 * extra auth lookup, and an extra cooldown read for nothing.
 *
 * Always resolves to an array. An empty one is a real answer ("this room has no
 * gather action") and lets the client skip its fallback fetch.
 *
 * Per-player supplies (the spare hatchet, the arrow crate) are a separate list,
 * built by room-supply-service.buildSupplyStatus, and ride alongside this one.
 *
 * @param {string} playerId
 * @param {string} roomId
 * @returns {Promise<Array<{
 *   action: string,
 *   cooldownSeconds: number,
 *   secondsRemaining: number,
 *   quantity: number | null,
 *   itemSlug: string | null,
 *   itemNamePlural: string | null,
 *   readyLabel: string | null,
 *   toolRequired: string | null,
 *   toolTiers: Array<{ slug: string, quantity: number, label: string }> | null,
 * }>>}
 */
async function buildGatherCooldowns(playerId, roomId) {
  if (!playerId || !roomId) return []

  // Lazy: room-action-handlers pulls in most of the engine, and this module is
  // required from the socket layer at startup.
  const { getGatherActionsForRoom } = require('../room-action-handlers')
  const { getCooldownRemaining } = require('./action-cap-service')

  const gathers = getGatherActionsForRoom(roomId)
  if (!gathers.length) return []

  return Promise.all(
    gathers.map(async (gather) => ({
      action: gather.action,
      cooldownSeconds: gather.cooldownMs ? Math.ceil(gather.cooldownMs / 1000) : 0,
      secondsRemaining: gather.cooldownMs
        ? await getCooldownRemaining(playerId, roomId, gather.action, gather.cooldownMs)
        : 0,
      quantity: gather.quantity ?? null,
      itemSlug: gather.itemSlug ?? null,
      itemNamePlural: gather.itemNamePlural ?? null,
      readyLabel: gather.readyLabel ?? null,
      // The client holds the live inventory, so it can pick the tier the
      // player will actually swing and label the button with it.
      toolRequired: gather.toolRequired ?? null,
      toolTiers: gather.toolTiers ?? null,
    }))
  )
}

module.exports = { buildGatherCooldowns }
