/**
 * What you can do with a traveler who is standing in your room.
 *
 * Room actions are keyed by room (room-action-handlers.js) because the things
 * they act on never move. A traveler's actions belong to the traveler, so they
 * are looked up by who is present: RoomState asks here after the room's own
 * table has had no answer, and the handler refuses if the traveler has since
 * moved on — the button the player clicked may be a few seconds stale.
 *
 * None of these spend a turn. Watching a bunny or asking Sherman what he is
 * afraid of is not the kind of thing that should get you ambushed.
 */

const {
  getTravelerByAction,
  routeHeadingTo,
  travelerStockAt,
  pickLine,
} = require('../game-data/travelers')
const travelerState = require('./traveler-state')

function fill(line, vars) {
  return String(line || '').replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '')
}

function modalResult(action, traveler, roomState, message, lead) {
  const { createActionFeedbackPayload } = require('./room-action-handlers')
  return {
    success: true,
    action,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(action, 'success', lead, {
          roomId: roomState.roomId,
          showModal: true,
          modalContent: {
            type: 'icon',
            icon: traveler.icon,
            iconColor: 'amber-400',
            title: traveler.title ? `${traveler.name} ${traveler.title}` : traveler.name,
            message,
          },
        }),
      },
    ],
  }
}

function lineResult(action, roomState, message) {
  const { createActionFeedbackPayload } = require('./room-action-handlers')
  return {
    success: true,
    action,
    playerEvents: [
      { event: 'action:feedback', payload: createActionFeedbackPayload(action, 'info', message, { roomId: roomState.roomId }) },
    ],
  }
}

/** Sherman's lines for the room he is standing in, falling back to his usual worries. */
function shermanLine(traveler, roomId) {
  const talk = traveler.lines.talk || {}
  const pool = [...(talk[roomId] || []), ...(talk.default || [])]
  return pickLine(pool)
}

/** Wendell's lines: which end of the loop he is walking toward, plus his patter. */
function merchantLine(traveler) {
  const talk = traveler.lines.talk || {}
  const heading = routeHeadingTo(traveler)
  const pool = [...((talk.toward || {})[heading] || []), ...(talk.default || [])]
  return pickLine(pool)
}

/**
 * Returns an action result, or null when `action` is not a traveler's action
 * at all (so RoomState can carry on to the generic actions).
 */
async function executeTravelerAction(roomId, action, playerId, roomState) {
  const normalized = String(action || '').toLowerCase().trim()
  const traveler = getTravelerByAction(normalized)
  if (!traveler) return null

  const { createErrorResult } = require('./room-action-handlers')

  if (!travelerState.isTravelerInRoom(traveler.id, roomId)) {
    return createErrorResult(normalized, `${traveler.name} isn't here any more.`)
  }

  roomState.touchActivity()

  switch (normalized) {
    case 'watch bunny':
      return lineResult(normalized, roomState, pickLine(traveler.lines.watch))

    case 'catch bunny': {
      // Nobody catches the bunny. It either bolts into the next room (the
      // room hears the startle line and sees the card go) or hops out of reach.
      const outcome = travelerState.startleTraveler(traveler.id, roomId)
      if (!outcome) return createErrorResult(normalized, `${traveler.name} isn't here any more.`)
      const line = outcome.bolted
        ? fill(pickLine(traveler.lines.catchMiss), { to: outcome.direction })
        : pickLine(traveler.lines.catchStay)
      return lineResult(normalized, roomState, line)
    }

    case 'talk to sherman':
      return modalResult(normalized, traveler, roomState, shermanLine(traveler, roomId), `You talk to ${traveler.spokenName || traveler.name}.`)

    case 'talk to wendell':
      return modalResult(normalized, traveler, roomState, merchantLine(traveler), `You talk to ${traveler.spokenName || traveler.name}.`)

    case 'trade with wendell': {
      const { buildShopModalResult } = require('./room-action-handlers')
      const shop = { name: traveler.shop.name, stock: travelerStockAt(traveler, roomId) }
      // The client closes the cart if he moves on while it is open.
      return buildShopModalResult({ shop, playerId, roomState, action: normalized, extra: { travelerId: traveler.id } })
    }

    default:
      return createErrorResult(normalized, `${traveler.name} does not know what you mean.`)
  }
}

module.exports = { executeTravelerAction }
