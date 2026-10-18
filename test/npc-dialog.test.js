/**
 * NPC dialog: idle lines that rotate and asides that change with a giver's
 * own quest progress.
 *
 * Both read quest-givers.json fields through the handlers' pure helpers. The
 * gate rule is the one idleDialogs always had: first entry whose quest is
 * completed wins, null is the default, and only the giver's own quests can
 * gate (the talk handler loads nothing else).
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const { resolveIdleDialog, pickAside, withAside } = require(path.join(ROOT, 'src/lib/game-engine/room-action-handlers.js'))

const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { completed: true }]))

test('idle dialog: a string message is returned as before', () => {
  const idle = [{ ifCompleted: 'q2', message: 'after two' }, { ifCompleted: null, message: 'default' }]
  assert.equal(resolveIdleDialog(idle, done('q2')), 'after two')
  assert.equal(resolveIdleDialog(idle, done('q1')), 'default')
  assert.equal(resolveIdleDialog([], {}), '')
})

test('idle dialog: an array message rotates by the roll', () => {
  const idle = [{ ifCompleted: null, message: ['a', 'b', 'c'] }]
  assert.equal(resolveIdleDialog(idle, {}, () => 0), 'a')
  assert.equal(resolveIdleDialog(idle, {}, () => 0.5), 'b')
  assert.equal(resolveIdleDialog(idle, {}, () => 0.999), 'c')
})

test('asides: the first open entry wins and one of its lines is picked', () => {
  const asides = [
    { ifCompleted: 'gq4', lines: ['four'] },
    { ifCompleted: 'gq1', lines: ['one-a', 'one-b'] },
    { ifCompleted: null, lines: ['none-a', 'none-b', 'none-c'] },
  ]
  assert.equal(pickAside(asides, {}, () => 0), 'none-a')
  assert.equal(pickAside(asides, done('gq1'), () => 0.9), 'one-b')
  assert.equal(pickAside(asides, done('gq1', 'gq4'), () => 0.9), 'four')
})

test('asides: a giver without any says nothing extra', () => {
  assert.equal(pickAside(undefined, {}), '')
  assert.equal(pickAside([], done('q1')), '')
  assert.equal(withAside('hello', ''), 'hello')
  assert.equal(withAside('hello', 'aside'), 'hello\n\naside')
})

test('asides: a gate on a quest the giver does not own never opens', () => {
  // progressById holds only the giver's own quests, so the other giver's id is simply absent.
  const asides = [{ ifCompleted: 'someone_elses_quest', lines: ['never'] }, { ifCompleted: null, lines: ['default'] }]
  assert.equal(pickAside(asides, done('own_quest'), () => 0), 'default')
})

// ── shopkeepers and overheard lines ──────────────────────────────────────────

const { pickKeeperLine } = require(path.join(ROOT, 'src/lib/game-data/shops.js'))
const overheard = require(path.join(ROOT, 'src/lib/game-data/overheard.js'))

test('keeper line: a shop without a keeper says nothing, one with lines rotates', () => {
  assert.equal(pickKeeperLine({ name: 'x', stock: [] }), '')
  const shop = { name: 'x', stock: [], keeper: { lines: ['one', 'two'] } }
  assert.equal(pickKeeperLine(shop, () => 0), 'one')
  assert.equal(pickKeeperLine(shop, () => 0.99), 'two')
})

test('overheard: only rooms with lines are listed, and a room without lines picks nothing', () => {
  for (const roomId of overheard.listOverheardRooms()) {
    assert.ok(overheard.OVERHEARD[roomId].lines.length > 0)
    assert.ok(overheard.pickOverheard(roomId, () => 0))
  }
  assert.equal(overheard.pickOverheard('no-such-room'), '')
  assert.equal(overheard.getOverheard('no-such-room'), null)
})
