/**
 * Auto-equip planner invariants.
 *
 * The original's MAX 1H / 2H / DEX / MAG buttons, re-derived from item stats
 * instead of hand-ordered lists: every slot takes the owned item that scores
 * highest for the stat, hands are chosen as a pair, a two-hander empties the
 * off hand, what is worn stays unless something strictly better exists or it
 * hurts the stat, and the skip-negatives switch keeps side-effect gear off.
 * Pure function, no database.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const { planAutoEquip, describePlan } = require(path.join(ROOT, 'src/lib/game-engine/services/auto-equip-service.js'))

let nextId = 1
/** An inventory row as getPlayerInventory shapes it. */
function row(slug, equipSlot, statMods, extra = {}) {
  const { worn = false, twoHanded = false, category = null, quantity = 1, name = slug } = extra
  const metadata = { statMods }
  if (twoHanded) metadata.isTwoHanded = true
  return {
    id: `pi_${nextId++}`,
    quantity,
    isEquipped: worn,
    slot: worn ? equipSlot : null,
    template: { slug, name, equipSlot, weaponCategory: category, metadata },
  }
}
const melee = (slug, mods, extra = {}) => row(slug, 'MAIN_HAND', mods, { ...extra, category: 'MELEE' })
const ranged = (slug, mods, extra = {}) => row(slug, 'MAIN_HAND', mods, { ...extra, category: 'RANGED' })
const off = (slug, mods, extra = {}) => row(slug, 'OFF_HAND', mods, extra)

const change = (plan, slot) => plan.changes.find((c) => c.slot === slot)
const slugOf = (item) => (item ? item.template.slug : null)

test('STR 1H: best one-handed melee weapon plus best STR off-hand, ignoring two-handers and bows', () => {
  const inv = [
    melee('iron-sword', { str: 18 }, { worn: true }),
    melee('steel-sword', { str: 27 }),
    melee('great-axe', { str: 45 }, { twoHanded: true }),
    ranged('black-bow', { dex: 200 }, { twoHanded: true }),
    off('wooden-shield', { def: 13 }),
    off('off-hand-mace', { str: 25, mag: 5 }),
    off('buckler', { str: 2, def: 5 }),
    row('iron-hood', 'HEAD', { str: 3 }),
    row('black-hood', 'HEAD', { str: 20 }),
    row('padded-armor', 'BODY', { def: 13 }),
  ]
  const plan = planAutoEquip(inv, { mode: 'str1h' })
  assert.equal(slugOf(change(plan, 'MAIN_HAND').to), 'steel-sword')
  assert.equal(slugOf(change(plan, 'OFF_HAND').to), 'off-hand-mace')
  assert.equal(slugOf(change(plan, 'HEAD').to), 'black-hood')
  // Nothing in BODY raises STR: the slot is left empty rather than force-filled.
  assert.equal(change(plan, 'BODY'), undefined)
  assert.equal(plan.before, 18)
  assert.equal(plan.after, 27 + 25 + 20)
  assert.equal(plan.missingWeapon, false)
})

test('STR 2H: best two-hander, and the off hand comes off with it', () => {
  const inv = [
    melee('steel-sword', { str: 27 }, { worn: true }),
    off('off-hand-mace', { str: 25 }, { worn: true }),
    melee('great-axe', { str: 45 }, { twoHanded: true }),
    melee('claymore', { str: 13 }, { twoHanded: true }),
  ]
  const plan = planAutoEquip(inv, { mode: 'str2h' })
  assert.equal(slugOf(change(plan, 'MAIN_HAND').to), 'great-axe')
  assert.equal(change(plan, 'OFF_HAND').to, null)
  assert.equal(plan.before, 52)
  assert.equal(plan.after, 45)
})

test('STR 2H with nothing two-handed: the one-hander stays, and the plan says why', () => {
  const inv = [melee('steel-sword', { str: 27 }, { worn: true }), off('buckler', { str: 2 }, { worn: true })]
  const plan = planAutoEquip(inv, { mode: 'str2h' })
  assert.deepEqual(plan.changes, [])
  assert.equal(plan.missingWeapon, true)
  assert.match(describePlan(plan), /own no two-handed weapon/)
})

test('DEX: a one-handed ranged weapon and off-hand pair beats a stronger lone bow when the pair adds up higher', () => {
  const inv = [
    ranged('long-bow', { dex: 40 }, { twoHanded: true }),
    ranged('boomerang', { dex: 30 }),
    off('off-hand-crossbow', { dex: 15 }),
  ]
  const pair = planAutoEquip(inv, { mode: 'dex' })
  assert.equal(slugOf(change(pair, 'MAIN_HAND').to), 'boomerang')
  assert.equal(slugOf(change(pair, 'OFF_HAND').to), 'off-hand-crossbow')
  assert.equal(pair.after, 45)

  const inv2 = [ranged('black-bow', { dex: 60 }, { twoHanded: true }), ranged('boomerang', { dex: 30 }), off('off-hand-crossbow', { dex: 15 })]
  const lone = planAutoEquip(inv2, { mode: 'dex' })
  assert.equal(slugOf(change(lone, 'MAIN_HAND').to), 'black-bow')
  assert.equal(change(lone, 'OFF_HAND'), undefined)
  assert.equal(lone.after, 60)
})

test('MAG: any weapon kind competes, and a magic off-hand rides along with a one-hander', () => {
  const inv = [
    melee('neutron-staff', { mag: 110 }, { twoHanded: true }),
    melee('gladius-of-valor', { mag: 100, str: 5 }),
    ranged('enchanted-bow', { dex: 9, mag: 2 }, { twoHanded: true }),
    off('magic-talisman', { mag: 30 }),
    off('king-shield', { def: 50, str: 8 }),
    row('ring-of-magic', 'RING', { mag: 4 }),
    row('ring-of-hp-regen', 'RING', {}, { worn: true }),
  ]
  const plan = planAutoEquip(inv, { mode: 'mag' })
  assert.equal(slugOf(change(plan, 'MAIN_HAND').to), 'gladius-of-valor')
  assert.equal(slugOf(change(plan, 'OFF_HAND').to), 'magic-talisman')
  assert.equal(slugOf(change(plan, 'RING').to), 'ring-of-magic')
  assert.equal(plan.after, 134)
})

test('worn gear wins ties, so an equal item is never swapped in', () => {
  const inv = [melee('iron-sword', { str: 18 }, { worn: true }), melee('iron-sword-2', { str: 18, def: 5 })]
  const plan = planAutoEquip(inv, { mode: 'str1h' })
  assert.deepEqual(plan.changes, [])
  assert.equal(describePlan(plan), "You're already wearing your best STR (one-handed) gear.")
})

test('between two unworn equals, higher total power wins, then name', () => {
  const inv = [melee('plain', { str: 10 }), melee('shiny', { str: 10, def: 2 })]
  assert.equal(slugOf(change(planAutoEquip(inv, { mode: 'str1h' }), 'MAIN_HAND').to), 'shiny')
  const inv2 = [melee('zed', { str: 10 }), melee('abe', { str: 10 })]
  assert.equal(slugOf(change(planAutoEquip(inv2, { mode: 'str1h' }), 'MAIN_HAND').to), 'abe')
})

test('a worn item that hurts the stat comes off when nothing better is owned', () => {
  const inv = [
    row('terra-robe', 'BODY', { mag: 15, str: -5, def: -5 }, { worn: true }),
    melee('demon-staff', { mag: 20, str: -15 }, { worn: true }),
    row('iron-hood', 'HEAD', { def: 3 }, { worn: true }),
  ]
  const plan = planAutoEquip(inv, { mode: 'str1h' })
  assert.equal(change(plan, 'BODY').to, null)
  assert.equal(change(plan, 'MAIN_HAND').to, null)
  // Zero-for-the-stat gear stays where it is.
  assert.equal(change(plan, 'HEAD'), undefined)
  assert.equal(plan.before, -20)
  assert.equal(plan.after, 0)
})

test('skip negatives: side-effect gear is passed over, a worn one is replaced by the best clean item', () => {
  const inv = [
    melee('black-blade', { str: 55, mag: -10 }, { worn: true }),
    melee('steel-sword', { str: 27 }),
    melee('mithril-sword', { str: 50 }),
    row('black-hood', 'HEAD', { str: 20, mag: -3 }),
    row('iron-hood', 'HEAD', { str: 3 }),
  ]
  const asIs = planAutoEquip(inv, { mode: 'str1h', skipNegatives: false })
  assert.equal(change(asIs, 'MAIN_HAND'), undefined)
  assert.equal(slugOf(change(asIs, 'HEAD').to), 'black-hood')

  const clean = planAutoEquip(inv, { mode: 'str1h', skipNegatives: true })
  assert.equal(slugOf(change(clean, 'MAIN_HAND').to), 'mithril-sword')
  assert.equal(slugOf(change(clean, 'HEAD').to), 'iron-hood')
})

test('skip negatives never strips a worn item when nothing clean scores', () => {
  const inv = [melee('black-blade', { str: 55, mag: -10 }, { worn: true }), melee('cursed', { str: 30, def: -1 })]
  const plan = planAutoEquip(inv, { mode: 'str1h', skipNegatives: true })
  assert.deepEqual(plan.changes, [])
  assert.equal(plan.missingWeapon, true)
  assert.match(describePlan(plan), /without a negative stat/)
})

test('STR 1H while wielding a two-hander with no one-hander owned: fists plus the off-hand item, as the original', () => {
  const inv = [melee('great-axe', { str: 11 }, { worn: true, twoHanded: true }), off('off-hand-mace', { str: 25 })]
  const plan = planAutoEquip(inv, { mode: 'str1h' })
  assert.equal(change(plan, 'MAIN_HAND').to, null)
  assert.equal(slugOf(change(plan, 'OFF_HAND').to), 'off-hand-mace')
  assert.equal(plan.after, 25)
  assert.match(describePlan(plan), /Main hand → empty, Off hand → off-hand-mace/)
})

test('a two-hander is kept over fists when the off-hand item would not beat it', () => {
  const inv = [melee('great-axe', { str: 30 }, { worn: true, twoHanded: true }), off('buckler', { str: 2 })]
  const plan = planAutoEquip(inv, { mode: 'str1h' })
  assert.deepEqual(plan.changes, [])
})

test('skill passives count for the weapon kind in hand', () => {
  const inv = [melee('iron-sword', { str: 18 }, { worn: true }), melee('claymore', { str: 20 }, { twoHanded: true })]
  const levels = { oneHanded: 3, twoHanded: 0, warcraft: 2, ranged: 4 }
  const oneHand = planAutoEquip(inv, { mode: 'str1h', skillLevels: levels })
  assert.equal(oneHand.before, 18 + 3 + 2)
  assert.deepEqual(oneHand.changes, [])
  const twoHand = planAutoEquip(inv, { mode: 'str2h', skillLevels: levels })
  assert.equal(twoHand.after, 20 + 2)
  const inv2 = [ranged('long-bow', { dex: 11 }, { twoHanded: true })]
  assert.equal(planAutoEquip(inv2, { mode: 'dex', skillLevels: levels }).after, 11 + 4 + 2)
})

test('empty stacks and non-gear are ignored; the ring slot is a single slot', () => {
  const inv = [
    row('ring-of-strength', 'RING', { str: 5 }, { quantity: 0 }),
    row('ring-of-strength-ii', 'RING', { str: 8 }),
    row('ring-of-strength-iii', 'RING', { str: 12 }),
    { id: 'potion', quantity: 3, isEquipped: false, slot: null, template: { slug: 'potion', name: 'Potion', equipSlot: null, weaponCategory: null, metadata: { statMods: { str: 99 } } } },
  ]
  const plan = planAutoEquip(inv, { mode: 'str1h' })
  assert.equal(plan.changes.length, 1)
  assert.equal(slugOf(change(plan, 'RING').to), 'ring-of-strength-iii')
})

test('DEF: shields and armor by DEF, Block counting behind a shield, and fists plus a shield over a two-hander', () => {
  const levels = { block: 2, toughness: 3 }
  const inv = [
    ranged('long-bow', { dex: 11, def: 4 }, { worn: true, twoHanded: true }),
    off('dragon-orb', { mag: 10, def: 10 }),
    off('basic-shield', { def: 7 }),
    row('padded-armor', 'BODY', { def: 13 }),
    row('terra-robe', 'BODY', { mag: 15, str: -5, def: -5 }, { worn: true }),
  ]
  const plan = planAutoEquip(inv, { mode: 'def', skillLevels: levels })
  // Bare hands and the shield (7 + Block 6 = 13) beat the bow's 4 and the orb's 10.
  assert.equal(change(plan, 'MAIN_HAND').to, null)
  assert.equal(slugOf(change(plan, 'OFF_HAND').to), 'basic-shield')
  assert.equal(slugOf(change(plan, 'BODY').to), 'padded-armor')
  // Toughness applies either way and shows in both totals.
  assert.equal(plan.before, 4 - 5 + 6)
  assert.equal(plan.after, 7 + 6 + 13 + 6)
})

test('DEF: a constant passive never makes a zero-DEF weapon worth putting on', () => {
  const inv = [melee('iron-sword', { str: 18 }), melee('iron-dagger', { str: 7 })]
  const plan = planAutoEquip(inv, { mode: 'def', skillLevels: { toughness: 5 } })
  assert.deepEqual(plan.changes, [])
  assert.equal(plan.missingWeapon, true)
  assert.equal(plan.before, 10)
})

test('DEF: a weapon with DEF is kept over fists when no shield beats it', () => {
  const inv = [ranged('heavy-crossbow', { dex: 40, def: 80 }, { worn: true, twoHanded: true }), off('basic-shield', { def: 7 })]
  const plan = planAutoEquip(inv, { mode: 'def' })
  assert.deepEqual(plan.changes, [])
})

test('an unknown mode is refused', () => {
  assert.throws(() => planAutoEquip([], { mode: 'hp' }), /unknown mode/)
})
