/**
 * Skill invariants.
 *
 * The teacher ladder that caps each skill, the SP it costs, the passive
 * bonuses as the original's stats.php folded them (proficiencies only with
 * the matching weapon, Toughness ×2, Block ×3 behind a shield, Dodge as a
 * percent), and the calculator rules for strikes: a Slice is a swing plus
 * rand(1, lvl), Magic Strike reaches a flying enemy and fizzles on an immune
 * one while the swing still lands, and Dodge turns an enemy hit into nothing.
 * Pure functions, no database.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const skills = require(path.join(ROOT, 'src/lib/game-data/skills.js'))
const { resolvePlayerAttack, resolveEnemyAttack, resolveTurn } = require(path.join(ROOT, 'src/lib/game-engine/battle-calculator.js'))
const { BattleState } = require(path.join(ROOT, 'src/lib/game-engine/battle-state.js'))

const maxRand = (_a, b) => b
const minRand = (a) => a

const oneHanded = { weaponCategory: 'MELEE', isTwoHanded: false, hasShield: false }
const twoHanded = { weaponCategory: 'MELEE', isTwoHanded: true, hasShield: false }
const bow = { weaponCategory: 'RANGED', isTwoHanded: false, hasShield: false }
const fists = { weaponCategory: null, isTwoHanded: false, hasShield: false }

test('the Young Soldier caps One Handed, Two Handed and Toughness at 5 and nothing else', () => {
  const caps = Object.fromEntries(skills.SKILLS.map((s) => [s.id, skills.getSkillMaxLevel(s, { youngSoldierFlag: true })]))
  assert.equal(caps['one-handed'], 5)
  assert.equal(caps['two-handed'], 5)
  assert.equal(caps['toughness'], 5)
  for (const [id, cap] of Object.entries(caps)) {
    if (!['one-handed', 'two-handed', 'toughness'].includes(id)) assert.equal(cap, 0, `${id} should be locked`)
  }
})

test('the ladder climbs Young Soldier 5 → Traveling Warrior 10 → Warrior\'s Guild 20 → Star City 25', () => {
  const s = skills.getSkill('one-handed')
  assert.equal(skills.getSkillMaxLevel(s, {}), 0)
  assert.equal(skills.getSkillMaxLevel(s, { travelingWarriorFlag: true }), 10)
  assert.equal(skills.getSkillMaxLevel(s, { youngSoldierFlag: true, warriorSkillFlag: true }), 20)
  assert.equal(skills.getSkillMaxLevel(s, { starCitySkillsFlag: true }), 25)
  // Hunter Bill opens Aim 5 and Dodge 5; Jack Lumber only Ranged.
  assert.equal(skills.getSkillMaxLevel(skills.getSkill('aim'), { hunterBillFlag: true }), 5)
  assert.equal(skills.getSkillMaxLevel(skills.getSkill('dodge'), { hunterBillFlag: true }), 5)
  assert.equal(skills.getSkillMaxLevel(skills.getSkill('ranged'), { jackLumberFlag: true }), 5)
  assert.equal(skills.getSkillMaxLevel(skills.getSkill('aim'), { jackLumberFlag: true }), 0)
})

test('learning costs the next level in SP, and stops at the cap', () => {
  const slice = skills.getSkill('slice')
  assert.equal(skills.getNextLearnCost(slice, 0, 5), 1)
  assert.equal(skills.getNextLearnCost(slice, 3, 5), 4)
  assert.equal(skills.getNextLearnCost(slice, 5, 5), null)
  assert.equal(skills.getNextLearnCost(slice, 0, 0), null)
})

test('strike costs match the original: Slice/Smash/Aim lvl MP, Magic Strike 2·lvl', () => {
  assert.equal(skills.getSkill('slice').castCost(3), 3)
  assert.equal(skills.getSkill('smash').castCost(4), 4)
  assert.equal(skills.getSkill('aim').castCost(2), 2)
  assert.equal(skills.getSkill('magic-strike').castCost(3), 6)
})

test('passives only count with the matching weapon; Toughness ×2 always; Block ×3 behind a shield', () => {
  const levels = { oneHanded: 3, twoHanded: 4, ranged: 5, warcraft: 2, toughness: 2, block: 2, dodge: 7 }
  const oh = skills.getPassiveSkillBonuses(levels, oneHanded)
  assert.deepEqual([oh.str, oh.dex, oh.def, oh.dodgeChance], [5, 0, 4, 7])
  const th = skills.getPassiveSkillBonuses(levels, twoHanded)
  assert.deepEqual([th.str, th.dex, th.def], [6, 0, 4])
  const rb = skills.getPassiveSkillBonuses(levels, bow)
  assert.deepEqual([rb.str, rb.dex, rb.def], [0, 7, 4])
  const shielded = skills.getPassiveSkillBonuses(levels, { ...oneHanded, hasShield: true })
  assert.equal(shielded.def, 4 + 6)
  // Fists are no weapon kind at all: no proficiency, no Warcraft.
  const bare = skills.getPassiveSkillBonuses(levels, fists)
  assert.deepEqual([bare.str, bare.dex, bare.def], [0, 0, 4])
  // No levels, no bonus.
  const none = skills.getPassiveSkillBonuses({}, oneHanded)
  assert.deepEqual([none.str, none.dex, none.def, none.dodgeChance], [0, 0, 0, 0])
})

test('a shield is a shield by slug; an orb or an off-hand dagger is not', () => {
  assert.equal(skills.isShieldItem({ slug: 'basic-shield', equipSlot: 'OFF_HAND' }), true)
  assert.equal(skills.isShieldItem({ slug: 'buckler', equipSlot: 'OFF_HAND' }), true)
  assert.equal(skills.isShieldItem({ slug: 'iron-kite-shield', equipSlot: 'OFF_HAND' }), true)
  assert.equal(skills.isShieldItem({ slug: 'starter-orb', equipSlot: 'OFF_HAND' }), false)
  assert.equal(skills.isShieldItem({ slug: 'off-hand-dagger', equipSlot: 'OFF_HAND' }), false)
  assert.equal(skills.isShieldItem({ slug: 'basic-shield', equipSlot: 'MAIN_HAND' }), false)
})

test('strikes fit their weapon: Slice 1h, Smash 2h, Aim ranged, Magic Strike anything', () => {
  const slice = skills.getSkill('slice')
  const smash = skills.getSkill('smash')
  const aim = skills.getSkill('aim')
  const ms = skills.getSkill('magic-strike')
  assert.equal(skills.weaponFits(slice, oneHanded), true)
  assert.equal(skills.weaponFits(slice, twoHanded), false)
  assert.equal(skills.weaponFits(smash, twoHanded), true)
  assert.equal(skills.weaponFits(aim, bow), true)
  assert.equal(skills.weaponFits(aim, oneHanded), false)
  assert.equal(skills.weaponFits(slice, fists), false)
  assert.equal(skills.weaponFits(ms, fists), true)
  assert.equal(skills.weaponFitReason(smash, oneHanded), 'Needs a two-handed weapon')
  assert.equal(skills.weaponFitReason(ms, bow), null)
})

test('Slice adds rand(1, lvl); Magic Strike adds rand(0, ceil(mag × lvl / 20) + 1)', () => {
  const slice = skills.getSkill('slice')
  assert.equal(skills.rollSkillBonus(slice, 3, 0, minRand).amount, 1)
  assert.equal(skills.rollSkillBonus(slice, 3, 0, maxRand).amount, 3)
  assert.deepEqual([skills.previewSkillBonus(slice, 3, 0).min, skills.previewSkillBonus(slice, 3, 0).max], [1, 3])
  const ms = skills.getSkill('magic-strike')
  // mag 10, level 4: ceil(10 × 0.2) + 1 = 3
  assert.equal(skills.rollSkillBonus(ms, 4, 10, maxRand).amount, 3)
  assert.equal(skills.rollSkillBonus(ms, 4, 10, minRand).amount, 0)
  assert.equal(skills.previewSkillBonus(ms, 4, 10).max, 3)
  // No MAG at all still adds up to 1.
  assert.equal(skills.rollSkillBonus(ms, 1, 0, maxRand).amount, 1)
})

test('typed commands resolve strikes only, with and without "use"', () => {
  assert.equal(skills.findSkillByCommand('slice').id, 'slice')
  assert.equal(skills.findSkillByCommand('use smash').id, 'smash')
  assert.equal(skills.findSkillByCommand('Magic Strike').id, 'magic-strike')
  assert.equal(skills.findSkillByCommand('magicstrike').id, 'magic-strike')
  assert.equal(skills.findSkillByCommand('block'), null, 'a passive is not a command')
  assert.equal(skills.findSkillByCommand('attack'), null)
})

test('every skill names its User column and a teacher ladder in ascending order', () => {
  for (const skill of skills.SKILLS) {
    assert.ok(skills.SKILL_COLUMNS.includes(skill.column), skill.id)
    let last = 0
    for (const tier of skill.teachers) {
      assert.ok(skills.SKILL_TEACHERS[tier.flag], `${skill.id}: unknown teacher ${tier.flag}`)
      assert.ok(tier.max > last, `${skill.id}: ladder must ascend`)
      last = tier.max
    }
    if (skills.isStrikeSkill(skill)) {
      assert.equal(typeof skill.castCost, 'function', `${skill.id} needs a cost`)
      assert.ok(skill.weapon, `${skill.id} needs a weapon kind`)
    }
  }
})

// ─── battle state: passives fold into the stats a fight rolls ───────────────

test('BattleState folds passive skill bonuses into STR/DEX/DEF for what is in hand', () => {
  const stats = { str: 10, dex: 10, mag: 10, def: 10, strMod: 2, dexMod: 0, magMod: 0, defMod: 0, oneHanded: 3, toughness: 2, block: 1, dodge: 5 }
  const enemy = { slug: 'x', name: 'X', hp: 10, att: 5, def: 0 }
  const sword = new BattleState({ playerId: 'p', roomId: '001', enemy, playerStats: stats, gear: oneHanded })
  assert.equal(sword.baseStr, 15)
  assert.equal(sword.baseDef, 14)
  assert.equal(sword.dodgeChance, 5)
  assert.equal(sword.equippedWeaponCategory, 'MELEE')
  // Swap to a two-hander mid-fight: the One Handed bonus goes, the DEF stays.
  sword.updateStats(stats, twoHanded)
  assert.equal(sword.baseStr, 12)
  assert.equal(sword.baseDef, 14)
  // A shield brings Block in.
  sword.updateStats(stats, { ...oneHanded, hasShield: true })
  assert.equal(sword.baseDef, 17)
  // The old string form still works for the weapon category alone.
  const legacy = new BattleState({ playerId: 'p', roomId: '001', enemy, playerStats: stats, equippedWeaponCategory: 'RANGED' })
  assert.equal(legacy.equippedWeaponCategory, 'RANGED')
})

// ─── calculator ─────────────────────────────────────────────────────────────

const battleState = (over = {}) => ({
  baseStr: 10,
  baseDex: 10,
  baseMag: 10,
  baseDef: 10,
  dodgeChance: 0,
  equippedWeaponCategory: 'MELEE',
  enemy: { att: 10, def: 0, damageType: 'MELEE', isFlying: false },
  ...over,
})

const strike = (id, level = 1) => {
  const def = skills.getSkill(id)
  return { def, level, cost: def.castCost(level) }
}

test('a Slice is the swing plus its bonus, and the turn carries the record', () => {
  for (let i = 0; i < 30; i++) {
    const r = resolvePlayerAttack(battleState(), 0, { skill: strike('slice', 3) })
    assert.ok(r.skill, 'the strike record is present')
    assert.equal(r.skill.id, 'slice')
    assert.ok(r.skill.bonus >= 1 && r.skill.bonus <= 3, `bonus ${r.skill.bonus} within rand(1, 3)`)
    assert.equal(r.playerRaw, r.skill.weaponRaw + r.skill.bonus)
    assert.equal(r.playerFinal, r.playerRaw, 'DEF 0 blocks nothing')
    assert.equal(r.immuneToMagic, false)
  }
  const turn = resolveTurn(battleState(), 0, { skill: strike('smash', 2) })
  assert.equal(turn.skill.name, 'Smash')
  assert.equal(turn.skill.cost, 2)
  assert.equal(turn.spell, null)
  // A plain swing reports no skill at all.
  assert.equal(resolveTurn(battleState(), 0).skill, null)
})

test('Magic Strike reaches a flying enemy that a plain melee swing cannot; Slice does not', () => {
  const flying = battleState({ enemy: { att: 0, def: 0, damageType: 'MELEE', isFlying: true } })
  assert.equal(resolvePlayerAttack(flying, 0).missedFlyingMelee, true)
  assert.equal(resolvePlayerAttack(flying, 0, { skill: strike('slice') }).missedFlyingMelee, true)
  const ms = resolvePlayerAttack(flying, 0, { skill: strike('magic-strike', 2) })
  assert.equal(ms.missedFlyingMelee, false)
  assert.equal(ms.skill.id, 'magic-strike')
})

test('a magic-immune enemy takes the swing but not the magic, and the use is reported as fizzled', () => {
  const immune = battleState({ baseStr: 20, enemy: { att: 0, def: 0, damageType: 'MELEE', isMagicImmune: true } })
  for (let i = 0; i < 20; i++) {
    const r = resolvePlayerAttack(immune, 0, { skill: strike('magic-strike', 3) })
    assert.equal(r.immuneToMagic, true)
    assert.equal(r.skill.bonus, 0)
    assert.deepEqual(r.skill.rolls, [])
    assert.equal(r.playerRaw, r.skill.weaponRaw, 'the weapon part still lands')
  }
  // A Slice is not magic: immunity means nothing to it.
  const r = resolvePlayerAttack(immune, 0, { skill: strike('slice', 3) })
  assert.equal(r.immuneToMagic, false)
  assert.ok(r.skill.bonus >= 1)
})

test('Dodge turns an enemy hit into nothing at 100%, and never fires at 0%', () => {
  const always = battleState({ dodgeChance: 100, enemy: { att: 50, def: 0, damageType: 'MELEE' } })
  for (let i = 0; i < 20; i++) {
    const r = resolveEnemyAttack(always, 0)
    assert.equal(r.dodged, true)
    assert.equal(r.enemyFinal, 0)
    assert.equal(r.playerBlock, 0)
  }
  const never = battleState({ dodgeChance: 0, baseDef: 0, enemy: { att: 50, def: 0, damageType: 'MELEE' } })
  for (let i = 0; i < 20; i++) {
    assert.equal(resolveEnemyAttack(never, 0).dodged, false)
  }
  const turn = resolveTurn(always, 0)
  assert.equal(turn.playerDodged, true)
  assert.equal(turn.enemyDealtDamage, 0)
})
