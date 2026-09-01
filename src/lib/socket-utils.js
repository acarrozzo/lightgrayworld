// Socket utility functions for server.js (CommonJS)
//
// The realtime server and the Next.js API routes do not share a module instance:
// Next bundles its own copy of this file, so a plain module-level `io` assigned
// by socket-server.js is still null when a route reads it. The runtime handles
// therefore live on globalThis — the same pattern the presence and ghost stores
// already use for exactly this reason.
//
// This was not theoretical: the DM route guards its live push on `if (io && …)`,
// so with a null `io` the push silently did nothing. The message persisted and
// the recipient saw it on their next refresh, with no error anywhere.
if (!globalThis.__socketRuntime) {
  globalThis.__socketRuntime = { io: null, userIdToSocketIds: null }
}
const runtime = globalThis.__socketRuntime

/**
 * The socket event names, for both sides of the wire.
 *
 * This is the single source: `lib/socket.ts` re-exports it rather than keeping
 * its own copy. There used to be two hand-maintained lists that had drifted in
 * both directions — the server's was missing all five battle events plus
 * level-up, clicks, battle-status and vitals; the client's was missing
 * `game:facts` — while `player-move`, `login:success`, `inventory:update` and
 * `room:items:update` were real, live events that appeared in neither and were
 * typed as bare strings at every call site.
 *
 * `validate-world` fails the build on any event emitted in `src/lib` that is not
 * listed here, so a new event cannot quietly become a fourth unlisted literal.
 */
const SOCKET_EVENTS = {
  // ── Client to server ──────────────────────────────────────────────────────
  PLAYER_LOGIN: 'player-login',
  PLAYER_MOVE: 'player-move',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  SEND_ROOM_CHAT_MESSAGE: 'send-room-chat-message',
  GAME_ACTION: 'game-action',
  USER_LOGOUT: 'user:logout',
  PARTY_FOLLOW: 'party:follow',
  PARTY_LEAVE: 'party:leave',
  PARTY_REMOVE: 'party:remove',

  // ── Server to client: session ─────────────────────────────────────────────
  LOGIN_SUCCESS: 'login:success',
  AUTH_ERROR: 'auth:error',
  AUTH_LOGOUT: 'auth:logout',

  // ── Server to client: rooms and presence ──────────────────────────────────
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  ROOM_PLAYER_MOVED: 'room:player-moved',
  ROOM_ITEMS_UPDATE: 'room:items:update',
  ROOM_PARTY_STATE: 'room:party-state',
  WORLD_TICK: 'world:tick',
  WORLD_ACTIVITY: 'world:activity',
  WORLD_PRESENCE_SYNC: 'world:presence-sync',
  WORLD_PRESENCE_UPDATE: 'world:presence-update',
  PLAYER_IDLE: 'player-idle',
  PLAYER_RETURNED: 'player-returned',

  // ── Server to client: chat ────────────────────────────────────────────────
  CHAT_MESSAGE: 'chat-message',
  ROOM_CHAT_MESSAGE: 'room-chat-message',
  DIRECT_MESSAGE: 'direct-message',

  // ── Server to client: actions ─────────────────────────────────────────────
  ACTION_CONFIRMED: 'action:confirmed',
  ACTION_FEEDBACK: 'action:feedback',
  // No current emitter; kept because the client still registers a listener.
  ACTION_COMPLETED: 'action-completed',
  PLAYER_ACTION: 'player-action',

  // ── Server to client: battle and progression ──────────────────────────────
  BATTLE_STARTED: 'battle:started',
  BATTLE_TURN: 'battle:turn',
  BATTLE_VICTORY: 'battle:victory',
  BATTLE_DEFEAT: 'battle:defeat',
  BATTLE_FLED: 'battle:fled',
  PLAYER_BATTLE_STATUS: 'player-battle-status',
  PLAYER_VITALS: 'player-vitals',
  PLAYER_LEVEL_UP: 'player:level-up',
  PLAYER_CLICKS_UPDATE: 'player:clicks-update',
  INVENTORY_UPDATE: 'inventory:update',

  // ── Server to client: party ───────────────────────────────────────────────
  PARTY_UPDATED: 'party:updated',
  PARTY_DISBANDED: 'party:disbanded',
  PARTY_REMOVED: 'party:removed',
  PARTY_ERROR: 'party:error',
  PARTY_PULLED: 'party:pulled',
}

function setSocketIO(ioInstance) {
  runtime.io = ioInstance
}

function getSocketIO() {
  return runtime.io
}

function setUserSocketMap(mapInstance) {
  runtime.userIdToSocketIds = mapInstance
}

function getSocketIdsForUser(userId) {
  if (!userId || !runtime.userIdToSocketIds) {
    return []
  }

  const socketSet = runtime.userIdToSocketIds.get(userId)
  if (!socketSet) {
    return []
  }

  return Array.from(socketSet)
}

// Helper function to emit socket events with error handling
function emitToRoom(roomId, event, data) {
  if (!runtime.io) {
    console.warn('Socket.io not initialized, cannot emit event:', event)
    return false
  }

  try {
    runtime.io.to(`room-${roomId}`).emit(event, data)
    return true
  } catch (error) {
    console.error('Failed to emit socket event:', error)
    return false
  }
}

module.exports = { 
  setSocketIO, 
  getSocketIO, 
  setUserSocketMap,
  getSocketIdsForUser,
  SOCKET_EVENTS,
  emitToRoom
}
