/**
 * Line cursors: where each player is in each set of lines (game-data/lines.js).
 *
 * A Chat, a keeper's talk button and Listen In walk their set in order, one
 * line per press, wrapping at the end, so a player hears every line before
 * any repeats and an author can step through a set by pressing. The cursor
 * is per player and per set, process-local and reset on restart: a set
 * starting over after a redeploy is no loss, and it keeps the table out of
 * the database.
 *
 * Held on `globalThis`, the same pattern the lever and presence state use, so
 * a dev-server reload of this module does not forget where everyone was.
 */
if (!globalThis.__lineCursors) {
  globalThis.__lineCursors = new Map()
}
/** `${playerId}|${setKey}` -> the index to serve next. */
const cursors = globalThis.__lineCursors

/**
 * The index to serve now for this player and set, then advance. `length` is
 * the set's current size: a set that grew or shrank since the last press
 * (a giver's pool changes with quest state) is wrapped into range.
 */
function nextLineIndex(playerId, setKey, length) {
  if (!length || length <= 0) return -1
  const key = `${playerId}|${setKey}`
  const at = cursors.get(key) ?? 0
  const index = at % length
  cursors.set(key, (index + 1) % length)
  return index
}

/** Forget a player's cursors (on logout, to keep the map from growing). */
function clearLineCursors(playerId) {
  const prefix = `${playerId}|`
  for (const key of cursors.keys()) {
    if (key.startsWith(prefix)) cursors.delete(key)
  }
}

module.exports = { nextLineIndex, clearLineCursors }
