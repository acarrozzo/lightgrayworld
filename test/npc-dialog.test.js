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

// ── the lines registry ───────────────────────────────────────────────────────

const lines = require(path.join(ROOT, 'src/lib/game-data/lines.js'))

test('lines: chat action derives from the talk action unless authored', () => {
  assert.equal(lines.chatActionForGiver({ action: 'talk to old man' }), 'chat with old man')
  assert.equal(lines.chatActionForGiver({ action: 'talk to old man', chatAction: 'pester old man' }), 'pester old man')
  assert.equal(lines.chatActionForGiver(null), null)
})

test('lines: pickIndexed names the row, and the source tag reads room · speaker · set #n', () => {
  assert.deepEqual(lines.pickIndexed(['a', 'b', 'c'], () => 0.5), { text: 'b', index: 1 })
  assert.deepEqual(lines.pickIndexed('solo', () => 0.9), { text: 'solo', index: 0 })
  assert.equal(lines.pickIndexed([], () => 0), null)
  assert.equal(lines.sourceTag({ roomId: '220', speaker: 'todd', set: 'keeper', index: 2 }), '220 · todd · keeper #3')
})

test('lines: every authored set has a room, a speaker, a kind and non-empty strings', () => {
  const sets = lines.listLineSets()
  assert.ok(sets.length > 0)
  for (const s of sets) {
    assert.ok(/^\d{3}[a-z]*$/.test(s.roomId), `room id ${s.roomId}`)
    assert.ok(s.speaker && s.speakerId, `speaker on ${s.roomId}`)
    assert.ok(['keeper', 'listen', 'idle', 'aside'].includes(s.set))
    assert.ok(s.lines.length > 0, `${s.roomId} ${s.speakerId} ${s.set} has lines`)
    for (const l of s.lines) assert.ok(typeof l === 'string' && l.trim(), `${s.roomId} ${s.speakerId} ${s.set}: empty line`)
  }
  // Every keeper and listen set has a button; giver sets share the giver's chat action.
  for (const s of sets) assert.ok(s.action, `${s.roomId} ${s.speakerId} ${s.set} has an action`)
})

// ── cycling ──────────────────────────────────────────────────────────────────

const { nextLineIndex, clearLineCursors } = require(path.join(ROOT, 'src/lib/game-engine/line-cursor-state.js'))

test('line cursor: each press serves the next line in order and wraps', () => {
  clearLineCursors('p1')
  assert.deepEqual([0, 1, 2, 0, 1].map(() => nextLineIndex('p1', '220|keeper', 3)), [0, 1, 2, 0, 1])
  // Another set and another player each keep their own place.
  assert.equal(nextLineIndex('p1', '220|listen', 5), 0)
  assert.equal(nextLineIndex('p2', '220|keeper', 3), 0)
  // A set that shrank since the last press wraps into range instead of overflowing.
  clearLineCursors('p3')
  nextLineIndex('p3', 'x', 4); nextLineIndex('p3', 'x', 4); nextLineIndex('p3', 'x', 4) // next is 3
  assert.equal(nextLineIndex('p3', 'x', 2), 1)
  assert.equal(nextLineIndex('p3', 'x', 0), -1)
})
