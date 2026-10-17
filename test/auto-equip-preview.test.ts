/**
 * The MAX row's hover preview: the client runs the server's planner on the
 * store's rows, so the flyout says what a press would do. Its "before" is the header's number
 * (effectiveStats), and the deltas cover every stat, not only the one being
 * maximized.
 *
 * Run: npm test
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { previewAutoEquip, previewRows } from '../src/lib/auto-equip'
import { effectiveStats } from '../src/lib/effective-stats'

let nextId = 1
function row(slug: string, equipSlot: string, statMods: Record<string, number>, extra: { worn?: boolean; twoHanded?: boolean; category?: string | null } = {}) {
  const { worn = false, twoHanded = false, category = null } = extra
  return {
    id: `pi_${nextId++}`,
    quantity: 1,
    isEquipped: worn,
    slot: worn ? equipSlot : null,
    template: { id: slug, slug, name: slug, type: 'EQUIPMENT', description: '', max: 1, value: 0, equipSlot, weaponCategory: category, metadata: { statMods, ...(twoHanded ? { isTwoHanded: true } : {}) } },
  } as any
}

function player(over: Record<string, unknown> = {}) {
  return { str: 300, dex: 40, mag: 10, def: 90, strMod: 18, dexMod: 0, magMod: 0, defMod: 13, buffs: { buffStrClicks: 5 }, skills: { oneHanded: 3, oneHandedPro: 2 }, ...over } as any
}

test("the preview's before is the header's number, and its after is what a press lands on", () => {
  const inv = [
    row('iron-sword', 'MAIN_HAND', { str: 18 }, { worn: true, category: 'MELEE' }),
    row('steel-sword', 'MAIN_HAND', { str: 27 }, { category: 'MELEE' }),
    row('basic-shield', 'OFF_HAND', { def: 13 }, { worn: true }),
    row('off-hand-mace', 'OFF_HAND', { str: 25 }),
  ]
  const p = player()
  const preview = previewAutoEquip(p, inv, 'str1h', false)
  assert.equal(preview.before, effectiveStats(p, inv).str.total)
  assert.equal(preview.changed, true)
  assert.equal(preview.swaps, 2)
  // The shield comes off for the mace: STR up, DEF down by the shield's 13.
  assert.ok(preview.deltas.str > 0)
  assert.equal(preview.deltas.def, -13)
  assert.equal(preview.after - preview.before, preview.deltas.str)
  // And the header, once the server has written the new mods, agrees.
  const afterPlayer = player({ strMod: 27 + 25, defMod: 0 })
  const afterInv = inv.map((r) => {
    if (r.template.slug === 'steel-sword') return { ...r, isEquipped: true, slot: 'MAIN_HAND' }
    if (r.template.slug === 'off-hand-mace') return { ...r, isEquipped: true, slot: 'OFF_HAND' }
    return { ...r, isEquipped: false, slot: null }
  })
  assert.equal(effectiveStats(afterPlayer, afterInv).str.total, preview.after)

  // The flyout: the stat being maximized first, then what else moves, from and to.
  assert.deepEqual(previewRows(preview), [
    { stat: 'str', from: preview.before, to: preview.after, delta: preview.deltas.str },
    { stat: 'def', from: 90 + 13, to: 90, delta: -13 },
  ])
})

test('nothing to change: the flyout shows only the stat as it stands', () => {
  const inv = [row('great-axe', 'MAIN_HAND', { str: 45 }, { worn: true, twoHanded: true, category: 'MELEE' })]
  const p = player({ strMod: 45, defMod: 0, skills: {} })
  const preview = previewAutoEquip(p, inv, 'str2h', false)
  assert.equal(preview.changed, false)
  assert.equal(preview.after, 300 + 45 + 30)
  assert.equal(preview.swaps, 0)
  assert.deepEqual(previewRows(preview), [{ stat: 'str', from: 375, to: 375, delta: 0 }])
})
