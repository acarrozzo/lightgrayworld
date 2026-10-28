/**
 * The vitals arithmetic every bar shares: fill, state thresholds, overflow,
 * the heal that lands. Run: npm test
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { formatVital, healThatLands, previewPct, vitalOverflow, vitalPct, vitalState } from '../src/lib/vitals'
import { LOW_HP_FRACTION } from '../src/lib/party/squad'

test('the fill is clamped to the bar', () => {
  assert.equal(vitalPct(42, 60), 70)
  assert.equal(vitalPct(68, 60), 100)
  assert.equal(vitalPct(-3, 60), 0)
  assert.equal(vitalPct(10, 0), 0)
})

test('state thresholds are the party\'s: low at a quarter, critical at a tenth', () => {
  assert.equal(vitalState(60, 60), 'ok')
  assert.equal(vitalState(Math.floor(60 * LOW_HP_FRACTION), 60), 'low')
  assert.equal(vitalState(16, 60), 'ok')
  assert.equal(vitalState(6, 60), 'critical')
  assert.equal(vitalState(0, 60), 'empty')
  assert.equal(vitalState(68, 60), 'over')
})

test('overflow is only ever past the ceiling', () => {
  assert.equal(vitalOverflow(68, 60), 8)
  assert.equal(vitalOverflow(60, 60), 0)
  assert.equal(vitalOverflow(12, 60), 0)
})

test('a heal only counts the part that lands', () => {
  assert.equal(healThatLands(42, 60, 100), 18)
  assert.equal(healThatLands(42, 60, 10), 10)
  assert.equal(healThatLands(60, 60, 10), 0)
  assert.equal(healThatLands(68, 60, 10), 0)
  assert.equal(previewPct(42, 60, 100), 30)
  assert.equal(previewPct(42, 0, 100), 0)
})

test('the number is written one way, never past the max', () => {
  assert.equal(formatVital(42, 60), '42/60')
  assert.equal(formatVital(68, 60), '60/60')
  assert.equal(formatVital(-2, 60), '0/60')
})
