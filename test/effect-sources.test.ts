/**
 * What renews an effect running on you, and where the links from it go: the
 * "Running on you" chips, their Again, a "wears off" feed line, and a refusal
 * that knows its fix. Pure lookups over the spell registry and the bag.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectSource, effectSourceLink, expiredEffectLink, refusalLink, renewal } from '../src/lib/effect-sources'
import type { StatusChip } from '../src/lib/status-effects'

function player(over: Record<string, unknown> = {}) {
  return { level: 20, mag: 40, magMod: 0, hp: 200, hpMax: 300, mp: 80, mpMax: 120, buffs: {}, spells: {}, ...over } as any
}

function consumable(id: string, name: string, meta: Record<string, unknown>, quantity = 2) {
  return { id, quantity, isEquipped: false, template: { slug: name.toLowerCase().replace(/ /g, '-'), name, type: 'CONSUMABLE', metadata: { consumable: meta } } } as any
}

const coffee = consumable('i-coffee', 'Coffee', { verb: 'drink', buff: { field: 'buffCoffeeClicks', clicks: 100 } }, 3)
const wingsPotion = consumable('i-wings', 'Wings Potion', { verb: 'drink', buff: { field: 'wings', clicks: 100 } }, 1)
const antidote = consumable('i-anti', 'Antidote Potion', { verb: 'drink', cure: 'poison', buff: { field: 'poisonImmuneClicks', clicks: 20 } })
const bluePotion = consumable('i-blue', 'Blue Potion', { stat: 'mp', amount: 100, verb: 'drink' })

const situation = (over: Record<string, unknown> = {}) => ({ inBattle: false, hasTarget: false, mp: 80, hp: 200, hpMax: 300, buffs: {}, ...over })

function chip(field: string, clicks: number | undefined, over: Partial<StatusChip> = {}): StatusChip {
  return { id: field, field, label: field, tone: 'all', title: '', icon: 'pill', badge: '', clicks, expiring: typeof clicks === 'number' && clicks > 0 && clicks <= 3, ...over }
}

test('a learned spell is the source before an item; otherwise the item in the bag', () => {
  const caster = player({ spells: { wingsSpell: 2 } })
  const bySpell = effectSource('wings', caster, [wingsPotion])
  assert.equal(bySpell?.kind, 'spell')
  assert.deepEqual(effectSourceLink(bySpell!), { tab: 'actions', sub: 'spells', anchor: 'spell:wings' })

  const byItem = effectSource('wings', player(), [wingsPotion])
  assert.equal(byItem?.kind, 'item')
  assert.deepEqual(effectSourceLink(byItem!), { tab: 'actions', sub: 'items', anchor: 'item:i-wings' })
  assert.equal(byItem?.kind === 'item' && byItem.action, 'drink')
})

test('poison points at its cure; Glory and an empty bag point nowhere', () => {
  assert.equal(effectSource('poisonClicks', player(), [antidote])?.kind, 'item')
  assert.equal(effectSource('poisonClicks', player({ spells: { antidote: 1 } }), [antidote])?.kind, 'spell')
  assert.equal(effectSource('buffGloryClicks', player(), [coffee, antidote]), null)
  assert.equal(effectSource('buffCoffeeClicks', player(), []), null)
})

test('a wears-off line links to what renews it, never for poison running out', () => {
  assert.deepEqual(expiredEffectLink('buffCoffeeClicks', player(), [coffee]), { tab: 'actions', sub: 'items', anchor: 'item:i-coffee' })
  assert.equal(expiredEffectLink('poisonClicks', player(), [antidote]), null)
  assert.equal(expiredEffectLink('buffTeaClicks', player(), [coffee]), null)
})

test('Again: only in the last clicks, never for poison, never when the cast would be refused', () => {
  const source = effectSource('buffCoffeeClicks', player(), [coffee])
  assert.equal(renewal(chip('buffCoffeeClicks', 40), source, situation()), null)
  const again = renewal(chip('buffCoffeeClicks', 3), source, situation())
  assert.equal(again?.cost, '×3')

  const poison = effectSource('poisonClicks', player(), [antidote])
  assert.equal(renewal(chip('poisonClicks', 2), poison, situation()), null)

  // Iron Skin cannot be cast over itself: the server refuses while it stands.
  const skin = effectSource('ironSkinClicks', player({ spells: { ironSkin: 2 } }), [])
  assert.equal(skin?.kind, 'spell')
  assert.equal(renewal(chip('ironSkinClicks', 2), skin, situation({ buffs: { ironSkinAmount: 8, ironSkinClicks: 2 } })), null)

  // Regenerate can, if the MP is there.
  const regen = effectSource('regenerateClicks', player({ spells: { regenerate: 1 } }), [])
  assert.match(renewal(chip('regenerateClicks', 1), regen, situation())?.cost ?? '', /MP$/)
  assert.equal(renewal(chip('regenerateClicks', 1), regen, situation({ mp: 0 })), null)
})

test('a refusal leads to its fix out of a fight, and nowhere in one', () => {
  assert.deepEqual(refusalLink('Not enough MP', { inBattle: false, inventory: [bluePotion] }), { tab: 'actions', sub: 'items', anchor: 'mp' })
  assert.equal(refusalLink('Not enough MP', { inBattle: true, inventory: [bluePotion] }), null)
  // Nothing in the bag that restores MP: nowhere useful to go.
  assert.equal(refusalLink('Not enough MP', { inBattle: false, inventory: [coffee] }), null)
  const elixir = consumable('i-elixir', 'Elixir', { verb: 'drink', stats: [{ stat: 'hp', amount: 50 }, { stat: 'mp', amount: 50 }] })
  assert.deepEqual(refusalLink('Not enough MP', { inBattle: false, inventory: [elixir] }), { tab: 'actions', sub: 'items', anchor: 'both' })
  assert.deepEqual(refusalLink('No arrow', { inBattle: false, inventory: [], ammoLabel: 'arrow' }), { tab: 'inv', sub: 'main' })
  assert.equal(refusalLink('Nothing to hit', { inBattle: false, inventory: [bluePotion] }), null)
})
