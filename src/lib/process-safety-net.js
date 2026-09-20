/**
 * The last line of defence for the game process.
 *
 * Everything that makes a session — fights, parties, levers, search reveals,
 * wandering travelers — lives in this process's memory, so the process exiting
 * costs every connected player all of it at once. Since Node 15 a promise that
 * rejects with nobody listening does exactly that: it exits the process.
 *
 * The socket listeners are guarded individually (socket-server-handlers.js,
 * `guardListener`) and the engine catches around its own background work. This
 * is for whatever slips past both: the rejection is logged loudly and the
 * world keeps running. Shared by server.js and socket-server.js so the two
 * entry points cannot drift on it.
 *
 * Deliberately not an `uncaughtException` handler. A synchronous throw with no
 * frame to catch it leaves state half-written in ways a stray rejection does
 * not; letting the platform restart the process is the honest answer there.
 */
function installProcessSafetyNet() {
  if (globalThis.__processSafetyNetInstalled) return
  globalThis.__processSafetyNetInstalled = true

  process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled promise rejection — logged, not fatal:', reason)
  })
}

module.exports = { installProcessSafetyNet }
