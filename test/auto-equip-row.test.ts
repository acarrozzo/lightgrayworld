/**
 * The MAX row's gate: the bag's line and the deck's gear row appear together,
 * once the bag holds enough gear for "put on my best" to mean something.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasGearForMaxRow, MAX_ROW_MIN_GEAR } from '../src/lib/auto-equip'

function row(slug: string, equipSlot: string | null) {
  return { id: slug, quantity: 1, isEquipped: false, slot: null, template: { id: slug, slug, name: slug, type: equipSlot ? 'EQUIPMENT' : 'CONSUMABLE', equipSlot, metadata: {} } } as any
}

test('the gear row waits for the fifth piece of gear, counting only what can be worn', () => {
  const gear = Array.from({ length: MAX_ROW_MIN_GEAR - 1 }, (_, i) => row(`g${i}`, 'HEAD'))
  const potions = Array.from({ length: 10 }, (_, i) => row(`p${i}`, null))
  assert.equal(hasGearForMaxRow([...gear, ...potions]), false)
  assert.equal(hasGearForMaxRow([...gear, row('sword', 'MAIN_HAND'), ...potions]), true)
})
