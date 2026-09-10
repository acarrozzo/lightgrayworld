/**
 * A teammate's fight at a glance.
 *
 * The party sees more of each other's fights than the world does — enemy HP,
 * the last exchange, the turn — and all of it is read off the events the
 * fighter's own client receives, so a teammate never learns something the
 * owner has not been told first. Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const { glanceFromEvents, glanceFromBattle } = require(path.join(__dirname, '..', 'src/lib/party/battle-glance.js'))

const turn = (over = {}) => ({
  event: 'battle:turn',
  payload: {
    enemyName: 'Scorpion',
    enemyCurrentHp: 7,
    enemyMaxHp: 20,
    turnCount: 3,
    playerDealtDamage: 5,
    enemyDealtDamage: 2,
    ...over,
  },
})

test('a turn becomes enemy HP, the last exchange and the turn', () => {
  const glance = glanceFromEvents('p1', [turn()], 1000)
  assert.deepEqual(glance, {
    id: 'p1',
    enemyName: 'Scorpion',
    enemyHp: 7,
    enemyHpMax: 20,
    enemyHpPct: 35,
    lastHit: 5,
    lastTook: 2,
    turn: 3,
    ts: 1000,
  })
})

test('a one-turn fight reports the turn, not the untouched start', () => {
  const started = { event: 'battle:started', payload: { enemyName: 'Scorpion', enemyCurrentHp: 20, enemyMaxHp: 20, turnCount: 0 } }
  const glance = glanceFromEvents('p1', [started, turn({ enemyCurrentHp: 12 })], 1)
  assert.equal(glance.enemyHp, 12)
  assert.equal(glance.enemyHpPct, 60)
})

test('the end of a fight clears it, whichever way it ended', () => {
  for (const event of ['battle:victory', 'battle:defeat', 'battle:fled']) {
    assert.deepEqual(glanceFromEvents('p1', [turn(), { event, payload: {} }], 5), { id: 'p1', ended: true, ts: 5 })
  }
})

test('an action with no fight in it says nothing', () => {
  assert.equal(glanceFromEvents('p1', [{ event: 'action:feedback', payload: {} }]), null)
  assert.equal(glanceFromEvents('p1', []), null)
  assert.equal(glanceFromEvents('p1', undefined), null)
})

test('a live battle can be read for someone who missed the events', () => {
  const battle = { isActive: true, enemyName: 'Bat', enemyCurrentHp: 3, enemyMaxHp: 12, turnCount: 6 }
  const glance = glanceFromBattle('p2', battle, 9)
  assert.equal(glance.enemyHpPct, 25)
  assert.equal(glance.turn, 6)
  // The exchange is not stored on the battle, so it is honestly absent.
  assert.equal(glance.lastHit, null)
  assert.equal(glanceFromBattle('p2', { ...battle, isActive: false }), null)
  assert.equal(glanceFromBattle('p2', null), null)
})
