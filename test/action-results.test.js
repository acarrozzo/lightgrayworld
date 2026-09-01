/**
 * Action-result merging.
 *
 * An action result carries five channels the engine acts on — playerEvents,
 * broadcastEvents, roomEvent, backgroundWork and transfer. Merge sites that copy
 * only some of them lose the rest silently: no error, no log, just loot and a
 * level-up that never reach the player. These tests pin all five.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const { mergeActionResults } = require(path.join(ROOT, 'src/lib/game-engine/room-state.js'))

const ev = (name) => ({ event: name, payload: {} })

test('a missing incoming result leaves the base untouched', () => {
  const base = { success: true, playerEvents: [ev('a')] }
  assert.equal(mergeActionResults(base, null), base)
  assert.equal(mergeActionResults(base, undefined), base)
})

test('player and broadcast events concatenate in order', () => {
  const merged = mergeActionResults(
    { playerEvents: [ev('a')], broadcastEvents: [ev('r1')] },
    { playerEvents: [ev('b')], broadcastEvents: [ev('r2')] }
  )
  assert.deepEqual(merged.playerEvents.map((e) => e.event), ['a', 'b'])
  assert.deepEqual(merged.broadcastEvents.map((e) => e.event), ['r1', 'r2'])
})

test('events survive when the base has none of that channel', () => {
  const merged = mergeActionResults({ success: true }, { broadcastEvents: [ev('r')] })
  assert.deepEqual(merged.broadcastEvents.map((e) => e.event), ['r'])
})

test('roomEvent and transfer fill an empty slot but never overwrite one', () => {
  const filled = mergeActionResults(
    { roomEvent: { event: 'base' }, transfer: { toRoomId: '001' } },
    { roomEvent: { event: 'extra' }, transfer: { toRoomId: '999' } }
  )
  // Only one of each can be acted on, so the base result's decision stands.
  assert.equal(filled.roomEvent.event, 'base')
  assert.equal(filled.transfer.toRoomId, '001')

  const empty = mergeActionResults(
    { success: true },
    { roomEvent: { event: 'extra' }, transfer: { toRoomId: '999' } }
  )
  assert.equal(empty.roomEvent.event, 'extra')
  assert.equal(empty.transfer.toRoomId, '999')
})

test('backgroundWork carries through — the one-turn-kill regression', async () => {
  // A turn action that provoked a battle won in a single turn: the battle result
  // holds the reward persistence, and dropping it is what used to hide the loot
  // and the level-up until the player refreshed.
  const merged = mergeActionResults(
    { playerEvents: [ev('rest')] },
    { playerEvents: [ev('battle:victory')], backgroundWork: Promise.resolve([ev('inventory:update')]) }
  )
  assert.ok(merged.backgroundWork, 'backgroundWork was dropped')
  assert.deepEqual((await merged.backgroundWork).map((e) => e.event), ['inventory:update'])
})

test('two backgroundWork promises combine into one flattened result', async () => {
  const merged = mergeActionResults(
    { backgroundWork: Promise.resolve([ev('first')]) },
    { backgroundWork: Promise.resolve([ev('second')]) }
  )
  assert.deepEqual((await merged.backgroundWork).map((e) => e.event), ['first', 'second'])
})

test('a backgroundWork resolving to nothing does not break the merge', async () => {
  const merged = mergeActionResults(
    { backgroundWork: Promise.resolve(undefined) },
    { backgroundWork: Promise.resolve([ev('only')]) }
  )
  assert.deepEqual((await merged.backgroundWork).map((e) => e.event), ['only'])
})

test('merging does not mutate either input', () => {
  const base = { playerEvents: [ev('a')] }
  const extra = { playerEvents: [ev('b')] }
  mergeActionResults(base, extra)
  assert.equal(base.playerEvents.length, 1)
  assert.equal(extra.playerEvents.length, 1)
})
