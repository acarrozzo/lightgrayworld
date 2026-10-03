/**
 * The player's map and fast-travel discoveries, as one select and one
 * projection — the same shape spell-service uses for spell levels — so the
 * login route, the /me route and the socket login all hand the client the
 * same fields without each keeping its own list of map flags.
 */
const { MAP_FLAG_FIELDS } = require('../../game-data/world-map')

// `forestPrincessFlag` rides with the discoveries: it is set by standing in a
// room (525) and read by a gate (524 down), exactly like a found sheet.
const MAP_STATE_FIELDS = [...MAP_FLAG_FIELDS, 'discoveredTeleports', 'forestPrincessFlag']

/** Prisma `select` fragment for every discovery column. */
const MAP_STATE_SELECT = Object.fromEntries(MAP_STATE_FIELDS.map((field) => [field, true]))

/** The discovery columns of a User row, and nothing else. */
function projectMapState(row) {
  const out = {}
  if (!row) return out
  for (const field of MAP_STATE_FIELDS) {
    if (field in row) out[field] = row[field]
  }
  return out
}

module.exports = { MAP_STATE_FIELDS, MAP_STATE_SELECT, projectMapState }
