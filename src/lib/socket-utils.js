// Socket utility functions for server.js (CommonJS)
let io = null

// Socket event constants
const SOCKET_EVENTS = {
  // Client to server
  PLAYER_LOGIN: 'player-login',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  SEND_ROOM_CHAT_MESSAGE: 'send-room-chat-message',
  GAME_ACTION: 'game-action',
  
  // Server to client
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
  USER_LOGOUT: 'user:logout',
}

function setSocketIO(ioInstance) {
  io = ioInstance
}

function getSocketIO() {
  return io
}

// Helper function to emit socket events with error handling
function emitToRoom(roomId, event, data) {
  if (!io) {
    console.warn('Socket.io not initialized, cannot emit event:', event)
    return false
  }
  
  try {
    io.to(`room-${roomId}`).emit(event, data)
    return true
  } catch (error) {
    console.error('Failed to emit socket event:', error)
    return false
  }
}

module.exports = { 
  setSocketIO, 
  getSocketIO, 
  SOCKET_EVENTS,
  emitToRoom
}
