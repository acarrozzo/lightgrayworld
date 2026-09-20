/**
 * What stands between a client's packet and a socket listener.
 *
 * Kept apart from socket-server-handlers.js so it can be loaded — and tested —
 * without the engine, Prisma and every service that file pulls in behind it.
 */
const { CHAT_MESSAGE_MAX_LENGTH } = require('./game-data/constants.js')

/**
 * The text of a chat payload, trimmed and capped, or '' when there is none.
 *
 * A payload is whatever the client chose to send: nothing at all, `null`, a
 * number, an object whose `message` is not a string. The handlers used to read
 * `data.message` straight off it, outside any try — and they are async, so the
 * TypeError became an unhandled rejection, which ends the Node process. One
 * empty emit from any logged-in client took the whole world down with it.
 */
function readChatText(data) {
  const message = data && typeof data === 'object' ? data.message : null
  if (typeof message !== 'string') return ''
  return message.trim().substring(0, CHAT_MESSAGE_MAX_LENGTH)
}

/**
 * Wrap a socket listener so nothing it throws can escape.
 *
 * Socket.IO calls listeners through a plain EventEmitter: a synchronous throw
 * surfaces as an uncaught exception and an async one as an unhandled rejection,
 * and Node exits on either. Every handler already catches around its real work;
 * this is for the line nobody thought could fail, in whichever handler is
 * written next. A failure is logged and that one event is dropped.
 */
function guardListener(event, handler) {
  return async (...args) => {
    try {
      await handler(...args)
    } catch (error) {
      console.error(`[Socket] Unhandled error in "${event}" listener:`, error)
    }
  }
}

module.exports = { guardListener, readChatText }
