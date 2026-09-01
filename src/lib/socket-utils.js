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

// Socket event constants
const SOCKET_EVENTS = {
  // Client to server
  PLAYER_LOGIN: 'player-login',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  SEND_ROOM_CHAT_MESSAGE: 'send-room-chat-message',
  GAME_ACTION: 'game-action',
  PARTY_FOLLOW: 'party:follow',
  PARTY_LEAVE: 'party:leave',
  PARTY_REMOVE: 'party:remove',

  // Server to client
  PARTY_UPDATED: 'party:updated',
  PARTY_DISBANDED: 'party:disbanded',
  PARTY_REMOVED: 'party:removed',
  PARTY_ERROR: 'party:error',
  PARTY_PULLED: 'party:pulled',
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  CHAT_MESSAGE: 'chat-message',
  ROOM_CHAT_MESSAGE: 'room-chat-message',
  ACTION_COMPLETED: 'action-completed',
  PLAYER_ACTION: 'player-action',
  ACTION_CONFIRMED: 'action:confirmed',
  ACTION_FEEDBACK: 'action:feedback',
  WORLD_TICK: 'world:tick',
  ROOM_PLAYER_MOVED: 'room:player-moved',
  GAME_FACTS: 'game:facts',
  WORLD_ACTIVITY: 'world:activity',
  DIRECT_MESSAGE: 'direct-message',
  USER_LOGOUT: 'user:logout',
  PLAYER_IDLE: 'player-idle',
  PLAYER_RETURNED: 'player-returned',
  ROOM_PARTY_STATE: 'room:party-state',
  WORLD_PRESENCE_SYNC: 'world:presence-sync',
  WORLD_PRESENCE_UPDATE: 'world:presence-update',
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
