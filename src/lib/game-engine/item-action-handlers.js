/**
 * Item-specific action handlers
 * Handles execution of actions that are unique to specific items
 */
const { prisma } = require('../db-client')
const { getPlayerInventory } = require('./services/inventory-service')

/**
 * Map of item slugs to item-specific actions for NON-consumable items. Each
 * action entry can be either:
 * - A string message (handled by executeBasicDisplay)
 * - A custom function (playerId, roomState) => actionResult
 * - A structured action definition object (supports effects)
 *
 * Consumables are NOT listed here — they are routed purely from their
 * `metadata.consumable` block in the seed (see executeItemAction + handleConsume),
 * so adding a new food/potion needs no code change here.
 */
const STAT_LABELS = { hp: 'HP', mp: 'MP' }
const STAT_COLUMNS = {
  hp: { val: 'hp', max: 'hpMax' },
  mp: { val: 'mp', max: 'mpMax' },
}

/**
 * Generic consumable handler. Reads the gameplay facts ({ stat, amount, verb,
 * modal? }) from the item's `metadata.consumable` block (seeded in seed.ts —
 * the single source of truth), removes one item, and applies the stat change.
 *
 * The stat change is applied with a single DB-authoritative, atomically clamped
 * raw UPDATE — GREATEST(0, LEAST(max, val + amount)) — so it reads the LIVE value
 * (e.g. HP already reduced by in-battle damage) rather than a stale in-memory
 * snapshot, and never overshoots the max or drops below 0.
 */
async function handleConsume(playerId, roomState, playerItemId, item, consumable) {
  const verb = consumable.verb || 'use'

  if (!playerItemId) {
    return createErrorResult(verb, 'Item ID is required')
  }

  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(verb, 'Player not found in this room')
  }

  const stat = consumable.stat === 'mp' ? 'mp' : 'hp'
  const amount = Number(consumable.amount) || 0
  const cols = STAT_COLUMNS[stat]
  const statLabel = STAT_LABELS[stat]
  const displayName = (item.template.name || consumable.displayName || 'item').toLowerCase()

  roomState.touchActivity()

  try {
    let prevVal = 0
    let newVal = 0

    await prisma.$transaction(async (tx) => {
      // Remove 1 of the item from inventory.
      if (item.quantity === 1) {
        await tx.playerItem.delete({ where: { id: playerItemId } })
      } else {
        await tx.playerItem.update({
          where: { id: playerItemId },
          data: { quantity: item.quantity - 1 },
        })
      }

      // Atomic clamped stat change against the LIVE DB value. LEAST/GREATEST
      // keep the result within [0, max] with no read-modify-write race. Column
      // identifiers are from a fixed allow-list (STAT_COLUMNS), not user input.
      const rows = await tx.$queryRawUnsafe(
        `WITH prev AS (SELECT "${cols.val}" AS v FROM "User" WHERE id = $2)
         UPDATE "User"
         SET "${cols.val}" = GREATEST(0, LEAST("${cols.max}", "${cols.val}" + $1))
         WHERE id = $2
         RETURNING "${cols.val}" AS "newVal", (SELECT v FROM prev) AS "prevVal"`,
        amount,
        playerId
      )
      const row = rows[0] || {}
      prevVal = Number(row.prevVal ?? 0)
      newVal = Number(row.newVal ?? 0)
    })

    // Mirror the new value into in-memory room state.
    roomState.updatePlayer(playerId, (state) => ({ ...state, [stat]: newVal }))

    const updatedInventory = await getPlayerInventory(playerId)
    const change = newVal - prevVal // signed: positive = gain, negative = loss

    let message
    if (change > 0) {
      message = `You ${verb} the ${displayName}. You gain ${change} ${statLabel}.`
    } else if (change < 0) {
      message = `You ${verb} the ${displayName}. You lose ${-change} ${statLabel}.`
    } else {
      message = `You ${verb} the ${displayName}.`
    }

    const data = {
      roomId: roomState.roomId,
      [stat]: newVal,
      [`${stat}Change`]: change,
      inventory: updatedInventory,
    }

    if (consumable.modal) {
      data.showModal = true
      data.modalContent = consumable.modal
    }

    return {
      success: true,
      action: verb,
      playerEvents: [
        {
          event: 'action:feedback',
          payload: createActionFeedbackPayload(verb, 'success', message, data),
        },
      ],
    }
  } catch (error) {
    console.error(`Error consuming ${displayName}:`, error)
    return createErrorResult(verb, `Failed to ${verb} the ${displayName}`)
  }
}

const ITEM_ACTIONS = {
  'welcome-book': {
    'read book': {
      showModal: true,
      message: 'You read the Welcome Book.',
      modalContent: {
        title: 'Welcome Book',
        type: 'icon',
        icon: 'book',
        iconColor: 'blue-400/70',
        message: 'Welcome to the world! This is your journey. Explore, fight, and discover what lies ahead. The path is yours to choose.',
      },
    },
  },
}

/**
 * Execute a item-specific action
 * @param {string} itemSlug - The item slug where the action is being executed
 * @param {string} action - The action name (e.g., 'read book')
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @param {string} playerItemId - The ID of the player item being used
 * @param {Object} item - The resolved inventory item (with template + metadata)
 * @returns {Object|null} Action result object or null if action not found
 */
async function executeItemAction(itemSlug, action, playerId, roomState, currentTickNumber, nextTickAt, playerItemId = null, item = null) {
  const normalizedAction = action.toLowerCase().trim()

  // Consumables are data-driven: route from the item's metadata.consumable block
  // (the single source of truth seeded in seed.ts) rather than a hardcoded map.
  const consumable = item?.template?.metadata?.consumable
  if (consumable && (consumable.verb || 'use').toLowerCase().trim() === normalizedAction) {
    return await handleConsume(playerId, roomState, playerItemId, item, consumable)
  }

  const itemActions = ITEM_ACTIONS[itemSlug]

  if (!itemActions) {
    return null
  }

  const handler = itemActions[normalizedAction]

  if (!handler) {
    return null
  }

  if (typeof handler === 'function') {
    return await handler(playerId, roomState, playerItemId)
  }

  if (typeof handler === 'string') {
    return executeBasicDisplay(normalizedAction, handler, playerId, roomState)
  }

  // Check if handler is a simple object with showModal (but not a full structured action)
  if (isStructuredAction(handler) && handler.showModal && typeof handler.message === 'string' && !handler.effects && !handler.generateMessage) {
    return executeBasicDisplay(normalizedAction, handler.message, playerId, roomState, handler.showModal, handler)
  }

  if (isStructuredAction(handler)) {
    return executeStructuredAction(normalizedAction, handler, playerId, roomState, currentTickNumber, nextTickAt)
  }

  return null
}

/**
 * Reusable helper function for basic display actions
 * Displays a message to the feed when an action is performed
 * @param {string} actionName - The name of the action being performed
 * @param {string} message - The message to display to the player
 * @param {string} playerId - The ID of the player performing the action
 * @param {RoomState} roomState - The room state instance
 * @returns {Object} Action result object
 */
function createActionFeedbackPayload(action, outcome, message, data = {}) {
  const ts = Date.now()
  return {
    action,
    message,
    outcome,
    ts,
    timestamp: new Date(ts).toISOString(),
    success: outcome === 'success',
    data,
  }
}

function executeBasicDisplay(actionName, message, playerId, roomState, showModal = false, handler = null) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(actionName, 'Player not found in this room')
  }

  roomState.touchActivity()

  const data = {
    roomId: roomState.roomId,
  }

  if (showModal) {
    data.showModal = true
    // Check if handler has structured modalContent, otherwise use message string
    if (handler && handler.modalContent) {
      data.modalContent = handler.modalContent
      if (handler.buttons) {
        data.buttons = handler.buttons
      }
    } else {
      data.modalContent = message
    }
  }

  return {
    success: true,
    action: actionName,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(actionName, 'success', message, data),
      },
    ],
  }
}

/**
 * Create an error result for failed actions
 */
function createErrorResult(action, message) {
  return {
    success: false,
    action,
    message,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(action, 'failure', message),
      },
    ],
  }
}

/**
 * Determine if an action handler is a structured definition.
 */
function isStructuredAction(handler) {
  return handler && typeof handler === 'object' && !Array.isArray(handler)
}

/**
 * Execute structured action definition with optional effects.
 * For now, this is a simplified version. Can be expanded later if needed.
 */
async function executeStructuredAction(actionName, definition, playerId, roomState, currentTickNumber, nextTickAt) {
  const player = roomState.players.get(playerId)
  if (!player) {
    return createErrorResult(actionName, 'Player not found in this room')
  }

  roomState.touchActivity()

  // For now, treat structured actions similar to basic display
  // This can be expanded later to support effects, etc.
  const message = definition.message || `You perform ${actionName}.`
  const showModal = definition.showModal || false

  const data = {
    roomId: roomState.roomId,
  }

  if (showModal && definition.modalContent) {
    data.showModal = true
    data.modalContent = definition.modalContent
    if (definition.buttons) {
      data.buttons = definition.buttons
    }
  }

  return {
    success: true,
    action: actionName,
    playerEvents: [
      {
        event: 'action:feedback',
        payload: createActionFeedbackPayload(actionName, 'success', message, data),
      },
    ],
  }
}

module.exports = {
  executeItemAction,
}

