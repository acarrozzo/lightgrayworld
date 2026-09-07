/**
 * The danger verdict ladder shown in the compass corner.
 *
 * Thresholds are the decision, not an implementation detail: a level-10 player
 * must see EASY under 5, FAIR up to 9, EVEN at 10, HIGH up to 19, DEADLY at 20.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dangerVerdict, formatGold } from '../src/lib/danger-verdict'

test('safe rooms are SAFE whatever the numbers say', () => {
  assert.equal(dangerVerdict(40, true, 1).label, 'SAFE')
  assert.equal(dangerVerdict(0, true, 50).tone, 'safe')
})

test('the five rungs against a level-10 player', () => {
  const at = (d: number) => dangerVerdict(d, false, 10).label
  assert.equal(at(0), 'EASY')
  assert.equal(at(4), 'EASY')
  assert.equal(at(5), 'FAIR')
  assert.equal(at(9), 'FAIR')
  assert.equal(at(10), 'EVEN')
  assert.equal(at(11), 'HIGH')
  assert.equal(at(19), 'HIGH')
  assert.equal(at(20), 'DEADLY')
  assert.equal(at(99), 'DEADLY')
})

test('a level-1 player sees no EASY room: danger 0 is FAIR-adjacent EASY, 1 is EVEN, 2 is DEADLY', () => {
  assert.equal(dangerVerdict(0, false, 1).label, 'EASY')
  assert.equal(dangerVerdict(1, false, 1).label, 'EVEN')
  assert.equal(dangerVerdict(2, false, 1).label, 'DEADLY')
})

test('missing or garbage input degrades to level 0 against level 1', () => {
  const v = dangerVerdict(undefined, null, undefined)
  assert.equal(v.level, 0)
  assert.equal(v.label, 'EASY')
  assert.equal(dangerVerdict(Number.NaN, false, Number.NaN).label, 'EASY')
})

test('gold shortens at a million and keeps separators below it', () => {
  assert.equal(formatGold(0), '0')
  assert.equal(formatGold(1240), (1240).toLocaleString())
  assert.equal(formatGold(999_999), (999_999).toLocaleString())
  assert.equal(formatGold(1_000_000), '1m')
  assert.equal(formatGold(1_250_000), '1.2m')
  assert.equal(formatGold(12_700_000), '12m')
  assert.equal(formatGold(-5), '0')
})
