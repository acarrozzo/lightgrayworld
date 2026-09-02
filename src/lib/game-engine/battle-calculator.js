function rand(a, b) {
  // Tolerate inverted ranges — a negative stat makes the low bound exceed the high one
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

const partyStore = require('../services/party-store')
const { selectEnemySpecial } = require('../game-data/enemy-specials')
const { rollSpell } = require('../game-data/spells')

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
 * Two shapes share the pipeline. A weapon strike rolls the weapon's stat
 * (STR melee, DEX ranged) and cannot reach a flying enemy. A spell — passed as
 * `{ def, level, cost }` — rolls the spell's own formula off effective MAG,
 * reaches flying enemies (the original's "ranged weapon or projectile magic"),
 * and does nothing at all to a magic-immune one. Either way the enemy answers
 * with a single rand(0, DEF) block and the result floors at zero.
 */
function resolvePlayerAttack(battleState, otherCombatants, { spell = null } = {}) {
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
      spell: describeSpellCast(spell, roll),
    }
  }

  const offStat = pickPlayerOffensiveStat(battleState)
  // True effective stat — may be negative when mods outweigh the base stat
  const effectiveOff = Math.floor(offStat * bonus)

  if (enemy.isFlying && weaponCat === 'MELEE') {
    return {
      playerRaw: 0,
      enemyBlock: 0,
      playerFinal: 0,
      effectiveOff,
      weaponCategory: weaponCat,
      missedFlyingMelee: true,
      immuneToMagic: false,
      spell: null,
    }
  }

  // Negative STR rolls negative — it can't heal the enemy, so playerFinal floors at 0 below
  const playerRaw = rand(0, effectiveOff)
  const enemyBlock = rand(0, enemy.def)
  return {
    playerRaw,
    enemyBlock,
    playerFinal: Math.max(0, playerRaw - enemyBlock),
    effectiveOff,
    weaponCategory: weaponCat,
    missedFlyingMelee: false,
    immuneToMagic: false,
    spell: null,
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
  const playerBlock = special?.bypassesDefense ? 0 : rand(0, effectiveDef)
  return {
    enemyRaw,
    playerBlock,
    enemyFinal: Math.max(0, enemyRaw - playerBlock),
    effectiveDef,
    enemyDamageType: enemyDmgType,
    enemyAction,
  }
}

function resolveTurn(battleState, otherCombatants, { spell = null } = {}) {
  const player = resolvePlayerAttack(battleState, otherCombatants, { spell })
  const enemyAtk = resolveEnemyAttack(battleState, otherCombatants)

  return {
    playerDealtDamage: player.playerFinal,
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
    immuneToMagic: player.immuneToMagic,
  }
}

module.exports = {
  rand,
  describeSpellCast,
  resolveTurn,
  resolvePlayerAttack,
  resolveEnemyAttack,
  pickPlayerOffensiveStat,
  pickPlayerDefensiveStat,
  getOtherCombatantCount,
}
