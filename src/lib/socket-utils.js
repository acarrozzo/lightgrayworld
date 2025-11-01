// Socket utility functions for server.js (CommonJS)
let io = null

// Socket event constants
const SOCKET_EVENTS = {
  // Client to server
  PLAYER_LOGIN: 'player-login',
  SEND_CHAT_MESSAGE: 'send-chat-message',
  GAME_ACTION: 'game-action',
  
  // Server to client
  PLAYER_JOINED: 'player-joined',
  PLAYER_LEFT: 'player-left',
  ACTION_COMPLETED: 'action-completed',
  PLAYER_ACTION: 'player-action',
  GAME_FACTS: 'game:facts',
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
