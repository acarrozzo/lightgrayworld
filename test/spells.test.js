/**
 * Spell invariants.
 *
 * The Pajama Shaman's three spells as the original priced and rolled them,
 * the teacher ladder that caps them, and the calculator rules that make a
 * spell a spell: it reaches flying enemies, it does nothing to a magic-immune
 * one (and charges nothing), and it is blocked by a single DEF roll floored at
 * zero. Pure functions, no database.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const spells = require(path.join(ROOT, 'src/lib/game-data/spells.js'))
const { resolvePlayerAttack, resolveTurn } = require(path.join(ROOT, 'src/lib/game-engine/battle-calculator.js'))

const fixedRand = (value) => () => value
const maxRand = (_a, b) => b
const minRand = (a) => a

const pajama = { pajamaShamanFlag: true }

test('the Pajama Shaman caps Magic Missile 1, Fireball 3, Heal 3 and nothing else', () => {
  const caps = Object.fromEntries(spells.SPELLS.map((s) => [s.id, spells.getSpellMaxLevel(s, pajama)]))
  assert.equal(caps['magic-missile'], 1)
  assert.equal(caps['fireball'], 3)
  assert.equal(caps['heal'], 3)
  for (const [id, cap] of Object.entries(caps)) {
    if (!['magic-missile', 'fireball', 'heal'].includes(id)) assert.equal(cap, 0, `${id} should be locked`)
  }
})

test('a better teacher raises the cap; no teacher means no cap', () => {
  const fireball = spells.getSpell('fireball')
  assert.equal(spells.getSpellMaxLevel(fireball, {}), 0)
  assert.equal(spells.getSpellMaxLevel(fireball, { travelingWizardFlag: true }), 5)
  assert.equal(spells.getSpellMaxLevel(fireball, { pajamaShamanFlag: true, wizardSkillFlag: true }), 10)
  assert.equal(spells.getSpellMaxLevel(fireball, { starCitySpellsFlag: true }), 15)
})

test('learning costs the next level in SP, and stops at the cap', () => {
  const fireball = spells.getSpell('fireball')
  assert.equal(spells.getNextLearnCost(fireball, 0, 3), 1)
  assert.equal(spells.getNextLearnCost(fireball, 1, 3), 2)
  assert.equal(spells.getNextLearnCost(fireball, 2, 3), 3)
  assert.equal(spells.getNextLearnCost(fireball, 3, 3), null)
  assert.equal(spells.getNextLearnCost(fireball, 0, 0), null)
  // Pro spells cost five times the level.
  const atomic = spells.getSpell('atomic-blast')
  assert.equal(spells.getNextLearnCost(atomic, 0, 5), 5)
  assert.equal(spells.getNextLearnCost(atomic, 1, 5), 10)
})

test('cast costs match the original: MM 2·lvl, Fireball 5 + 2·lvl, Heal 2·lvl', () => {
  assert.equal(spells.getSpell('magic-missile').castCost(1, 10), 2)
  assert.equal(spells.getSpell('fireball').castCost(3, 10), 11)
  assert.equal(spells.getSpell('heal').castCost(2, 10), 4)
  assert.equal(spells.getSpell('atomic-blast').castCost(1, 10), 110)
})

test('Magic Missile is 1 + lvl + rand(0, mag)', () => {
  const mm = spells.getSpell('magic-missile')
  assert.equal(spells.rollSpell(mm, 1, 10, minRand).amount, 2)
  assert.equal(spells.rollSpell(mm, 1, 10, maxRand).amount, 12)
  const preview = spells.previewSpell(mm, 1, 10)
  assert.deepEqual([preview.min, preview.max], [2, 12])
})

test('Fireball is lvl + ceil(rand(1, mag) × (1 + 5%·lvl))', () => {
  const fb = spells.getSpell('fireball')
  // level 2, roll 9: 2 + ceil(9 × 1.10) = 2 + 10 = 12
  assert.equal(spells.rollSpell(fb, 2, 10, fixedRand(9)).amount, 12)
  // level 3, roll 1: 3 + ceil(1.15) = 5
  assert.equal(spells.rollSpell(fb, 3, 10, fixedRand(1)).amount, 5)
  const preview = spells.previewSpell(fb, 3, 10)
  assert.deepEqual([preview.min, preview.max], [5, 3 + Math.ceil(10 * 1.15)])
  // A player with no MAG still throws something: the roll floors at 1.
  assert.ok(spells.rollSpell(fb, 1, 0, minRand).amount >= 2)
})

test('Heal rolls (lvl + 1) dice of rand(1, mag)', () => {
  const heal = spells.getSpell('heal')
  const r = spells.rollSpell(heal, 2, 6, maxRand)
  assert.equal(r.rolls.length, 3)
  assert.equal(r.amount, 18)
  assert.equal(spells.rollSpell(heal, 2, 6, minRand).amount, 3)
})

test('typed commands resolve to spells, with and without "cast"', () => {
  assert.equal(spells.findSpellByCommand('cast fireball').id, 'fireball')
  assert.equal(spells.findSpellByCommand('Magic Missile').id, 'magic-missile')
  assert.equal(spells.findSpellByCommand('cast magic-missile').id, 'magic-missile')
  assert.equal(spells.findSpellByCommand('attack'), null)
  assert.equal(spells.findSpellByCommand('rest'), null)
})

test('every spell names its User column and a teacher ladder in ascending order', () => {
  for (const spell of spells.SPELLS) {
    assert.ok(spells.SPELL_COLUMNS.includes(spell.column), spell.id)
    let last = 0
    for (const tier of spell.teachers) {
      assert.ok(spells.SPELL_TEACHERS[tier.flag], `${spell.id}: unknown teacher ${tier.flag}`)
      assert.ok(tier.max > last, `${spell.id}: ladder must ascend`)
      last = tier.max
    }
    if (spells.isCastable(spell)) assert.equal(typeof spell.roll, 'function', `${spell.id} needs a roll`)
  }
})

// ─── calculator ─────────────────────────────────────────────────────────────

const battleState = (over = {}) => ({
  baseStr: 10,
  baseDex: 10,
  baseMag: 10,
  baseDef: 10,
  equippedWeaponCategory: 'MELEE',
  enemy: { att: 10, def: 0, damageType: 'MELEE', isFlying: false },
  ...over,
})

const cast = (id, level = 1) => {
  const def = spells.getSpell(id)
  return { def, level, cost: def.castCost(level, 10) }
}

test('a spell reaches a flying enemy that melee cannot', () => {
  const flying = battleState({ enemy: { att: 0, def: 0, damageType: 'MELEE', isFlying: true } })
  const swing = resolvePlayerAttack(flying, 0)
  assert.equal(swing.missedFlyingMelee, true)
  const bolt = resolvePlayerAttack(flying, 0, { spell: cast('magic-missile') })
  assert.equal(bolt.missedFlyingMelee, false)
  assert.ok(bolt.playerFinal >= 2, 'magic missile at level 1 hits for at least 2 against DEF 0')
  assert.equal(bolt.spell.id, 'magic-missile')
})

test('a magic-immune enemy takes nothing, and the cast is reported as fizzled', () => {
  const immune = battleState({ enemy: { att: 0, def: 0, damageType: 'MELEE', isMagicImmune: true } })
  for (let i = 0; i < 20; i++) {
    const r = resolvePlayerAttack(immune, 0, { spell: cast('fireball', 3) })
    assert.equal(r.playerFinal, 0)
    assert.equal(r.immuneToMagic, true)
    assert.equal(r.spell.amount, 0)
    assert.deepEqual(r.spell.rolls, [])
  }
  // A weapon is unaffected by magic immunity.
  const swing = resolvePlayerAttack(battleState({ baseStr: 20, enemy: { att: 0, def: 0, damageType: 'MELEE', isMagicImmune: true } }), 0)
  assert.equal(swing.immuneToMagic, false)
})

test('a spell is blocked by one DEF roll and floors at zero', () => {
  const wall = battleState({ baseMag: 0, enemy: { att: 0, def: 50, damageType: 'MELEE' } })
  for (let i = 0; i < 50; i++) {
    const r = resolvePlayerAttack(wall, 0, { spell: cast('magic-missile') })
    assert.ok(r.playerFinal >= 0)
    assert.equal(r.playerRaw, 2, 'magic missile lvl 1 with 0 MAG is exactly 2')
  }
})

test('a spell turn carries the cast record and the enemy still answers', () => {
  const turn = resolveTurn(battleState(), 0, { spell: cast('fireball', 2) })
  assert.equal(turn.spell.name, 'Fireball')
  assert.equal(turn.spell.level, 2)
  assert.equal(turn.spell.cost, 9)
  assert.ok(typeof turn.spell.text === 'string' && turn.spell.text.includes('='))
  assert.ok(turn.enemyRaw >= 0)
  // A weapon turn reports no spell at all.
  assert.equal(resolveTurn(battleState(), 0).spell, null)
})

test('the group bonus scales effective MAG for a spell like it scales STR for a swing', () => {
  const s = battleState({ baseMag: 100 })
  assert.equal(resolvePlayerAttack(s, 0, { spell: cast('magic-missile') }).effectiveOff, 100)
  assert.equal(resolvePlayerAttack(s, 2, { spell: cast('magic-missile') }).effectiveOff, 120)
})
