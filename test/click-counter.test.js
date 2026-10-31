/**
 * When a click counts.
 *
 * The click counter is also the clock for buff countdowns, regen and poison.
 * Out of a fight every input moves it, chat aside. In a fight only an input
 * the enemy answered does, or one that ended the fight or left the room: a
 * free click mid-fight (look, examine, talk) used to land regen while the
 * enemy waited, so a regen ring could heal you to full by typing `look`.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const { countsAsClick } = require(path.join(__dirname, '..', 'src/lib/game-engine/engine.js'))

const withEvents = (...events) => ({ success: true, playerEvents: events.map((event) => ({ event, payload: {} })) })

test('out of a fight every click counts, refused or not', () => {
  assert.equal(countsAsClick(withEvents('action:feedback'), false), true)
  assert.equal(countsAsClick({ success: false, playerEvents: [] }, false), true)
  assert.equal(countsAsClick(null, false), true)
})

test('in a fight a free click does not count', () => {
  assert.equal(countsAsClick(withEvents('action:feedback'), true), false)
  assert.equal(countsAsClick(null, true), false)
})

test('in a fight a turn the enemy answered counts', () => {
  assert.equal(countsAsClick(withEvents('action:feedback', 'battle:turn'), true), true)
  assert.equal(countsAsClick(withEvents('battle:victory'), true), true)
  assert.equal(countsAsClick(withEvents('battle:defeat'), true), true)
  assert.equal(countsAsClick(withEvents('battle:fled'), true), true)
})

test('leaving the room mid-fight counts', () => {
  assert.equal(countsAsClick({ success: true, playerEvents: [], transfer: { toRoomId: '001' } }, true), true)
})
