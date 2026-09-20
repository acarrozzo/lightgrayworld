const RESPAWN_ROOM_ID = '999'

/**
 * Longest chat line the server will carry, on any channel. The engine and the
 * socket layer both read it from here; `MESSAGE_MAX_LENGTH` in sanitization.ts
 * is the client/HTTP mirror, and a test holds the two together.
 */
const CHAT_MESSAGE_MAX_LENGTH = 500

module.exports = { RESPAWN_ROOM_ID, CHAT_MESSAGE_MAX_LENGTH }
