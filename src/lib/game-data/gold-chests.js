/**
 * The world's one-time gold chests, and the User column that remembers each
 * one being opened.
 *
 * One CommonJS module so the server and the client agree on which flag belongs
 * to which room: the open handler sets the flag, the login/me/socket payloads
 * hand every flag to the client, and the room's "Open Gold Chest" button reads
 * the flag for the room it is standing in. Before this table the client only
 * knew about `chest1`, so opening the Grassy Field chest marked every gold
 * chest in the world as opened.
 *
 * The loot itself lives beside the handlers in `CHEST_LOOT`
 * (game-engine/room-action-handlers.js); this is only the open-state mapping.
 */

/** @typedef {'chest1' | 'chest2' | 'chest3' | 'chest4' | 'chest5' | 'chest6'} GoldChestFlag */

/** Room id → the User boolean column set when that room's gold chest is opened. */
const GOLD_CHEST_FLAG_BY_ROOM = /** @type {Record<string, GoldChestFlag>} */ ({
  '001': 'chest1', // Grassy Field
  '119': 'chest2', // Forest
  '224': 'chest3', // Babylon Gardens, Red Town
  '309': 'chest4', // Dwarf Treasury, Rocky Flats
  '485': 'chest5', // Underwater Gold Shrine, Blue Ocean
  '513': 'chest6', // Dark Forest
})

/** Every chest flag column, in room order. */
const GOLD_CHEST_FLAG_FIELDS = /** @type {GoldChestFlag[]} */ (Object.values(GOLD_CHEST_FLAG_BY_ROOM))

/** Prisma `select` fragment for every chest flag. */
const GOLD_CHEST_SELECT = Object.fromEntries(GOLD_CHEST_FLAG_FIELDS.map((field) => [field, true]))

/**
 * The flag column for a room's gold chest, or null when the room has none.
 * @param {string | null | undefined} roomId
 * @returns {GoldChestFlag | null}
 */
function goldChestFlagForRoom(roomId) {
  return (roomId && GOLD_CHEST_FLAG_BY_ROOM[roomId]) || null
}

/**
 * The chest flag columns of a User row, and nothing else. Missing columns are
 * left out rather than defaulted, so a partial row never clears a flag the
 * client already holds.
 * @param {Record<string, unknown> | null | undefined} row
 * @returns {Partial<Record<GoldChestFlag, boolean>>}
 */
function projectGoldChestState(row) {
  /** @type {Partial<Record<GoldChestFlag, boolean>>} */
  const out = {}
  if (!row) return out
  for (const field of GOLD_CHEST_FLAG_FIELDS) {
    if (field in row) out[field] = Boolean(row[field])
  }
  return out
}

module.exports = {
  GOLD_CHEST_FLAG_BY_ROOM,
  GOLD_CHEST_FLAG_FIELDS,
  GOLD_CHEST_SELECT,
  goldChestFlagForRoom,
  projectGoldChestState,
}
