/**
 * Gold chest open-state invariants.
 *
 * Every one-time gold chest has its own "opened" column on the User row, and
 * the client draws a room's chest button from that room's flag — not from the
 * Grassy Field's `chest1` — so looting one chest never marks the rest of the
 * world's chests as opened. Pure data checks, no database queries.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const chests = require(path.join(ROOT, 'src/lib/game-data/gold-chests.js'))
const { CHEST_LOOT } = require(path.join(ROOT, 'src/lib/game-engine/room-action-handlers.js'))

test('every gold chest with loot has an opened flag, and every flag has loot', () => {
  const lootRooms = Object.keys(CHEST_LOOT).filter((roomId) => CHEST_LOOT[roomId]['open gold chest']).sort()
  const flagRooms = Object.keys(chests.GOLD_CHEST_FLAG_BY_ROOM).sort()
  assert.deepEqual(flagRooms, lootRooms)
})

test('each chest records its open in a distinct User column that exists in the schema', () => {
  const schema = fs.readFileSync(path.join(ROOT, 'prisma/schema.prisma'), 'utf8')
  const flags = chests.GOLD_CHEST_FLAG_FIELDS
  assert.equal(new Set(flags).size, flags.length, 'two chests share a flag')
  for (const flag of flags) {
    assert.match(schema, new RegExp(`^\\s*${flag}\\s+Boolean\\b`, 'm'), `${flag} is not a Boolean column on User`)
  }
})

test('a room reads its own chest flag, and a room without a chest reads none', () => {
  assert.equal(chests.goldChestFlagForRoom('001'), 'chest1')
  assert.equal(chests.goldChestFlagForRoom('119'), 'chest2')
  assert.notEqual(chests.goldChestFlagForRoom('119'), chests.goldChestFlagForRoom('001'))
  assert.equal(chests.goldChestFlagForRoom('002'), null)
  assert.equal(chests.goldChestFlagForRoom(undefined), null)
})

test('the projection hands the client every flag it was given as a boolean, and nothing it was not', () => {
  const row = { chest1: true, chest2: false, chest3: null, username: 'x' }
  assert.deepEqual(chests.projectGoldChestState(row), { chest1: true, chest2: false, chest3: false })
  assert.deepEqual(chests.projectGoldChestState(null), {})
  const select = chests.GOLD_CHEST_SELECT
  for (const flag of chests.GOLD_CHEST_FLAG_FIELDS) assert.equal(select[flag], true)
})
