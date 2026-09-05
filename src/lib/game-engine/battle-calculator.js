function rand(a, b) {
  // Tolerate inverted ranges — a negative stat makes the low bound exceed the high one
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

const partyStore = require('../services/party-store')
const { selectEnemySpecial } = require('../game-data/enemy-specials')
const { rollSpell } = require('../game-data/spells')
const { rollSkillBonus } = require('../game-data/skills')

// Count other players in the same room who either have an active battle OR are in
// the player's party (party members are pinned to the same room, so presence counts).
function getOtherCombatantCount(roomState, excludePlayerId) {
  const counted = new Set()
  for (const [pid, battle] of roomState.activeBattles.entries()) {
    if (pid !== excludePlayerId && battle.isActive) counted.add(pid)
  }

  const party = partyStore.getParty(excludePlayerId)
  if (party && roomState.players) {
    for (const pid of party.memberIds) {
      if (pid !== excludePlayerId && roomState.players.has(pid)) counted.add(pid)
    }
  }

  return counted.size
}

function pickPlayerOffensiveStat(battleState) {
  const cat = battleState.equippedWeaponCategory || 'MELEE'
  return cat === 'RANGED' ? battleState.baseDex : battleState.baseStr
}

function pickPlayerDefensiveStat(battleState, enemy) {
  const enemyDmgType = enemy.damageType || 'MELEE'
  if (enemyDmgType === 'RANGED') return battleState.baseDex
  if (enemyDmgType === 'MAGIC') return battleState.baseMag
  return battleState.baseDef
}

/**
 * The player's strike for one turn.
 *
 * Three shapes share the pipeline. A weapon strike rolls the weapon's stat
 * (STR melee, DEX ranged) and cannot reach a flying enemy. A spell — passed as
 * `{ def, level, cost }` — rolls the spell's own formula off effective MAG,
 * reaches flying enemies (the original's "ranged weapon or projectile magic"),
 * and does nothing at all to a magic-immune one. A skill strike — `skill` as
 * `{ def, level, cost }` — is the weapon swing plus the skill's bonus roll:
 * Slice, Smash and Aim add rand(1, lvl); Magic Strike adds a magic roll, so
 * it reaches a flying enemy like a spell and, against a magic-immune one, the
 * swing lands but the magic does not. Either way the enemy answers with a
 * single rand(0, DEF) block and the result floors at zero.
 */
function resolvePlayerAttack(battleState, otherCombatants, { spell = null, skill = null } = {}) {
  const bonus = 1 + otherCombatants * 0.1
  const enemy = battleState.enemy
  const weaponCat = battleState.equippedWeaponCategory || 'MELEE'

  if (spell) {
    const effectiveMag = Math.floor(battleState.baseMag * bonus)
    if (enemy.isMagicImmune) {
      return {
        playerRaw: 0,
        enemyBlock: 0,
        playerFinal: 0,
        effectiveOff: effectiveMag,
        weaponCategory: weaponCat,
        missedFlyingMelee: false,
        immuneToMagic: true,
        immuneToWeapon: null,
        spell: describeSpellCast(spell, null),
      }
    }
    const roll = rollSpell(spell.def, spell.level, effectiveMag, rand)
    const enemyBlock = rand(0, enemy.def)
    return {
      playerRaw: roll.amount,
      enemyBlock,
      playerFinal: Math.max(0, roll.amount - enemyBlock),
      effectiveOff: effectiveMag,
      weaponCategory: weaponCat,
      missedFlyingMelee: false,
      immuneToMagic: false,
      immuneToWeapon: null,
      spell: describeSpellCast(spell, roll),
    }
  }

  const offStat = pickPlayerOffensiveStat(battleState)
  // True effective stat — may be negative when mods outweigh the base stat
  const effectiveOff = Math.floor(offStat * bonus)

  // A Magic Strike is projectile magic on top of the swing, so it reaches what
  // a bare melee swing cannot. A Slice is still a sword.
  const reachesFlying = weaponCat !== 'MELEE' || Boolean(skill && skill.def.magic)
  if (enemy.isFlying && !reachesFlying) {
    return {
      playerRaw: 0,
      enemyBlock: 0,
      playerFinal: 0,
      effectiveOff,
      weaponCategory: weaponCat,
      missedFlyingMelee: true,
      immuneToMagic: false,
      immuneToWeapon: null,
      spell: null,
      skill: null,
    }
  }

  // The original's eStrImm / eDexImm: a blade that bounces off the Troll
  // Queen, an arrow that never finds the Dark Ranger. Nothing is rolled, the
  // way nothing is rolled for a fizzled spell, and the turn says so.
  const immuneToWeapon = weaponImmunity(enemy, weaponCat)
  if (immuneToWeapon) {
    return {
      playerRaw: 0,
      enemyBlock: 0,
      playerFinal: 0,
      effectiveOff,
      weaponCategory: weaponCat,
      missedFlyingMelee: false,
      immuneToMagic: false,
      immuneToWeapon,
      spell: null,
      skill: null,
    }
  }

  // Negative STR rolls negative — it can't heal the enemy, so playerFinal floors at 0 below
  const weaponRaw = rand(0, effectiveOff)
  let playerRaw = weaponRaw
  let skillUse = null
  let immuneToMagic = false
  if (skill) {
    if (skill.def.magic && enemy.isMagicImmune) {
      // The sword still bites; the magic fizzles and (see the handlers) costs nothing.
      immuneToMagic = true
      skillUse = describeSkillUse(skill, null, weaponRaw)
    } else {
      const effectiveMag = Math.floor(battleState.baseMag * bonus)
      const roll = rollSkillBonus(skill.def, skill.level, effectiveMag, rand)
      playerRaw = weaponRaw + roll.amount
      skillUse = describeSkillUse(skill, roll, weaponRaw)
    }
  }
  const enemyBlock = rand(0, enemy.def)
  return {
    playerRaw,
    enemyBlock,
    playerFinal: Math.max(0, playerRaw - enemyBlock),
    effectiveOff,
    weaponCategory: weaponCat,
    missedFlyingMelee: false,
    immuneToMagic,
    immuneToWeapon: null,
    spell: null,
    skill: skillUse,
  }
}

/**
 * The client-facing record of a skill strike: what was used, at what level
 * and cost, and the split behind the number — the weapon's own roll and the
 * bonus on top. `roll` is null when a Magic Strike fizzled on a magic-immune
 * enemy (no bonus rolled, nothing charged).
 */
function describeSkillUse(skill, roll, weaponRaw) {
  return {
    id: skill.def.id,
    name: skill.def.name,
    level: skill.level,
    cost: skill.cost,
    icon: skill.def.icon,
    attackIcon: skill.def.attackIcon || skill.def.icon,
    hue: skill.def.hue,
    magic: Boolean(skill.def.magic),
    weaponRaw,
    bonus: roll ? roll.amount : 0,
    bonusMax: roll ? roll.max : 0,
    rolls: roll ? roll.rolls : [],
    text: roll ? `${weaponRaw} + ${roll.amount}` : null,
  }
}

/**
 * Which weapon category, if any, this enemy shrugs off. `isMeleeImmune` and
 * `isRangedImmune` on the definition are the original's eStrImm and eDexImm;
 * magic immunity is its own flag and its own check because a spell is a
 * different pipeline. Returns 'MELEE' | 'RANGED' | null.
 */
function weaponImmunity(enemy, weaponCategory) {
  if (weaponCategory === 'RANGED' && enemy.isRangedImmune) return 'RANGED'
  if (weaponCategory !== 'RANGED' && enemy.isMeleeImmune) return 'MELEE'
  return null
}

/**
 * The companion's swing, on every attack turn the player takes. The original's
 * companion attack exactly: its own small roll, blocked by a tenth of the
 * enemy's DEF, floored at zero, and subtracted from the enemy on top of the
 * player's own hit. Returns null when nothing is equipped in the slot.
 */
function resolveCompanionAttack(battleState) {
  const companion = battleState.companion
  if (!companion) return null
  const roll = rand(companion.damageMin, companion.damageMax)
  const block = rand(0, Math.floor(battleState.enemy.def / 10))
  return {
    name: companion.name,
    roll,
    block,
    damage: Math.max(0, roll - block),
  }
}

/**
 * The client-facing record of a cast: what was cast, at what level and cost,
 * and the roll behind the number. `roll` is null when the cast fizzled against
 * a magic-immune enemy (nothing was rolled, nothing was charged).
 */
function describeSpellCast(spell, roll) {
  return {
    id: spell.def.id,
    name: spell.def.name,
    level: spell.level,
    cost: spell.cost,
    icon: spell.def.icon,
    attackIcon: spell.def.attackIcon || spell.def.icon,
    hue: spell.def.hue,
    amount: roll ? roll.amount : 0,
    rolls: roll ? roll.rolls : [],
    text: roll ? roll.text : null,
  }
}

function resolveEnemyAttack(battleState, otherCombatants) {
  const bonus = 1 + otherCombatants * 0.1
  const enemy = battleState.enemy
  const enemyDmgType = enemy.damageType || 'MELEE'
  const defStat = pickPlayerDefensiveStat(battleState, enemy)
  // True effective stat — may be negative when mods outweigh the base stat
  const effectiveDef = Math.floor(defStat * bonus)

  // At most one special resolves per attack. A special replaces how the enemy's
  // raw damage is rolled; everything downstream — the single defense roll, the
  // zero floor, damageType — is unchanged, so perks never fork the pipeline.
  const special = selectEnemySpecial(enemy, rand)

  let enemyRaw
  let enemyAction = null
  if (special) {
    const rolled = special.rollDamage(enemy, rand)
    enemyRaw = rolled.raw
    enemyAction = { id: special.id, name: special.name, rolls: rolled.rolls }
  } else {
    enemyRaw = rand(0, enemy.att)
  }

  // Defense is rolled ONCE against whatever raw damage the attack produced —
  // a Power Attack does not get blocked three times.
  // Negative DEF rolls negative, so enemyRaw - playerBlock grows — you take extra damage
  //
  // A `bypassesDefense` special (bite, rage, the Cyclops' standing pure attack)
  // is the original's "pure" damage: the roll IS the damage. Report the block as
  // 0 rather than rolling and discarding it, so the `( rolls ) − block = total`
  // line the battle panel prints still adds up.
  //
  // Dodge (the skill) is a flat lvl% chance the whole swing does nothing —
  // no block rolled, no damage taken — exactly the original's "You DODGE".
  const dodgeChance = battleState.dodgeChance || 0
  const dodged = dodgeChance > 0 && rand(1, 100) <= dodgeChance
  const playerBlock = dodged || special?.bypassesDefense ? 0 : rand(0, effectiveDef)
  return {
    enemyRaw,
    playerBlock,
    enemyFinal: dodged ? 0 : Math.max(0, enemyRaw - playerBlock),
    effectiveDef,
    enemyDamageType: enemyDmgType,
    enemyAction,
    dodged,
  }
}

function resolveTurn(battleState, otherCombatants, { spell = null, skill = null } = {}) {
  const player = resolvePlayerAttack(battleState, otherCombatants, { spell, skill })
  const companion = resolveCompanionAttack(battleState)
  const enemyAtk = resolveEnemyAttack(battleState, otherCombatants)

  return {
    // The player's own hit. The companion's is reported beside it, never
    // folded in, so the `raw − block = total` line the panel prints stays true.
    playerDealtDamage: player.playerFinal,
    // null with nothing in the slot; { name, roll, block, damage } otherwise.
    companion,
    enemyDealtDamage: enemyAtk.enemyFinal,
    playerRaw: player.playerRaw,
    enemyRaw: enemyAtk.enemyRaw,
    enemyBlocked: player.enemyBlock,
    playerBlocked: enemyAtk.playerBlock,
    playerStrMax: player.effectiveOff,
    playerDefMax: enemyAtk.effectiveDef,
    enemyStrMax: battleState.enemy.att,
    multiplayerBonus: otherCombatants > 0,
    bonusPercent: otherCombatants * 10,
    missedFlyingMelee: player.missedFlyingMelee,
    weaponCategory: player.weaponCategory,
    enemyDamageType: enemyAtk.enemyDamageType,
    // null on a normal attack; { id, name, rolls } when a special fired.
    enemyAction: enemyAtk.enemyAction,
    // null on a weapon strike; the cast record when a spell was thrown.
    spell: player.spell,
    // null on a plain swing or a spell; the strike record when a skill was used.
    skill: player.skill,
    immuneToMagic: player.immuneToMagic,
    // 'MELEE' | 'RANGED' when the enemy shrugged the weapon off; null otherwise.
    immuneToWeapon: player.immuneToWeapon,
    // True when Dodge turned the enemy's swing into nothing.
    playerDodged: enemyAtk.dodged,
  }
}

/** Everything the enemy lost this turn: the player's hit plus the companion's. */
function totalDamageToEnemy(turn) {
  return (turn.playerDealtDamage || 0) + (turn.companion?.damage || 0)
}

module.exports = {
  rand,
  describeSpellCast,
  describeSkillUse,
  resolveTurn,
  resolveCompanionAttack,
  totalDamageToEnemy,
  weaponImmunity,
  resolvePlayerAttack,
  resolveEnemyAttack,
  pickPlayerOffensiveStat,
  pickPlayerDefensiveStat,
  getOtherCombatantCount,
}
