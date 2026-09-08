/**
 * Room supplies: the free, per-player things rooms hand out.
 *
 * The table in config/room-supplies.js is the only place a "one each" or
 * "up to N" lives now. These checks keep it well-formed and keep the two
 * older shapes from creeping back: a supply must not also be a harvest of the
 * same item in the same room, and no room action may still be a take/top-up.
 * Pure data checks, no database queries.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const { ROOM_SUPPLIES, SUPPLY_MODES, getRoomSupplies, supplyCap } = require(
  path.join(ROOT, 'src/lib/game-engine/config/room-supplies.js')
)
const { ROOM_ACTIONS, getGatherActionsForRoom } = require(
  path.join(ROOT, 'src/lib/game-engine/room-action-handlers.js')
)
const { feedTally } = require(path.join(ROOT, 'src/lib/game-engine/services/room-supply-service.js'))
const { pluralizeItemName } = require(path.join(ROOT, 'src/lib/game-engine/services/item-names.js'))

test('every supply has a known mode, a positive cap, and appears once per room', () => {
  const seen = new Set()
  for (const entry of ROOM_SUPPLIES) {
    assert.ok(SUPPLY_MODES.has(entry.mode), `${entry.roomId} ${entry.slug}: mode "${entry.mode}"`)
    const cap = supplyCap(entry)
    assert.ok(Number.isInteger(cap) && cap >= 1, `${entry.roomId} ${entry.slug}: cap ${cap}`)
    if (entry.mode === 'take') assert.equal(cap, 1, `${entry.roomId} ${entry.slug}: a take is one each`)
    if (entry.mode === 'topUp') assert.ok(cap > 1, `${entry.roomId} ${entry.slug}: a top-up refills to more than one`)
    const key = `${entry.roomId}|${entry.slug}`
    assert.ok(!seen.has(key), `${key} listed twice`)
    seen.add(key)
  }
})

test('the dev-test ring bowl is gone and the Solar Office gear is one each', () => {
  assert.deepEqual(getRoomSupplies('027'), [])
  assert.deepEqual(
    getRoomSupplies('088').map((e) => [e.slug, e.mode]),
    [['master-sword', 'take'], ['enchanted-orb', 'take']]
  )
})

test('a room never offers the same item both as a supply and as a harvest', () => {
  for (const entry of ROOM_SUPPLIES) {
    const harvested = getGatherActionsForRoom(entry.roomId).map((g) => g.itemSlug)
    assert.ok(!harvested.includes(entry.slug), `${entry.roomId} harvests and supplies ${entry.slug}`)
  }
})

test('no room action is still a take or a top-up in disguise', () => {
  for (const [roomId, actions] of Object.entries(ROOM_ACTIONS)) {
    for (const [name, def] of Object.entries(actions)) {
      if (!def || typeof def !== 'object') continue
      assert.equal(def.maxHeld, undefined, `${roomId} "${name}" still carries a held cap`)
      assert.equal(def.topUpTo, undefined, `${roomId} "${name}" is still a top-up`)
      // Every harvest is on a timer; nothing is free and instant any more.
      if (def.isGather) assert.ok(def.cooldownMs > 0, `${roomId} "${name}" is a harvest with no timer`)
    }
  }
})

test('the converted rooms have no leftover grab buttons', () => {
  const gone = ['get hammer', 'get wood', 'get leather', 'grab ring', 'grab arrows', 'grab bolts', 'grab polearm',
    'grab pickaxe', 'grab red potion', 'grab blue potion', 'grab gloves', 'grab tea', 'grab iron hatchet', 'fish']
  for (const [roomId, actions] of Object.entries(ROOM_ACTIONS)) {
    for (const name of gone) assert.ok(!(name in actions), `${roomId} still has "${name}"`)
  }
})

test('harvests expose their tool tiers for the room badge', () => {
  const jack = getGatherActionsForRoom('025').find((g) => g.action === 'chop wood')
  assert.ok(jack, "Jack's tree is a harvest")
  assert.equal(jack.cooldownMs, 15 * 60 * 1000)
  assert.ok(Array.isArray(jack.toolTiers) && jack.toolTiers.every((t) => t.quantity === 3))
  const forest = getGatherActionsForRoom('117').filter((g) => g.itemSlug === 'wood')
  assert.equal(forest.length, 2, 'Under the Massive Tree has two trees')
  assert.deepEqual(forest[0].toolTiers.map((t) => t.quantity), [6, 2, 1])
})

test('the feed tally keeps the original bracket shape', () => {
  assert.equal(feedTally(38, 50, 'arrows'), '[ +38 arrows = 50 ]')
  assert.equal(feedTally(1, 1, 'polearms'), '[ +1 polearms ]')
  assert.equal(feedTally(2, 14, 'wood'), '[ +2 wood = 14 ]')
})

test('regular plurals', () => {
  assert.equal(pluralizeItemName('Redberry'), 'Redberries')
  assert.equal(pluralizeItemName('Arrow'), 'Arrows')
  assert.equal(pluralizeItemName('Bo'), 'Bos')
  assert.equal(pluralizeItemName('Ring of Dexterity III'), 'Ring of Dexterity IIIs')
})
