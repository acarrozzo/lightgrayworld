/**
 * Opt-in verbose logging for the per-action server chatter.
 *
 * A single move used to emit a dozen-plus lines — the whole action result
 * object, three queue lifecycle lines, one line per emitted event — which made
 * `fly logs` unreadable during exactly the situation it exists for. That detail
 * is genuinely useful when tracing one player's action, so it is kept behind a
 * switch rather than deleted.
 *
 * Enable with LG_VERBOSE=1. Warnings and errors are never gated.
 */
const VERBOSE = process.env.LG_VERBOSE === '1' || process.env.LG_VERBOSE === 'true'

function debugLog(...args) {
  if (VERBOSE) console.log(...args)
}

/** Logger shaped for PlayerActionQueue: routine lifecycle quiet, problems loud. */
const quietActionLogger = {
  info: debugLog,
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
}

module.exports = { VERBOSE, debugLog, quietActionLogger }
