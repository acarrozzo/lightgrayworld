function rand(a, b) {
  // Tolerate inverted ranges — a negative stat makes the low bound exceed the high one
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return Math.floor(Math.random() * (hi - lo + 1)) + lo
}

const partyStore = require('../services/party-store')

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

function resolvePlayerAttack(battleState, otherCombatants) {
  const bonus = 1 + otherCombatants * 0.1
  const enemy = battleState.enemy
  const weaponCat = battleState.equippedWeaponCategory || 'MELEE'
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
  }
}

function resolveEnemyAttack(battleState, otherCombatants) {
  const bonus = 1 + otherCombatants * 0.1
  const enemy = battleState.enemy
  const enemyDmgType = enemy.damageType || 'MELEE'
  const defStat = pickPlayerDefensiveStat(battleState, enemy)
  // True effective stat — may be negative when mods outweigh the base stat
  const effectiveDef = Math.floor(defStat * bonus)

  const enemyRaw = rand(0, enemy.att)
  // Negative DEF rolls negative, so enemyRaw - playerBlock grows — you take extra damage
  const playerBlock = rand(0, effectiveDef)
  return {
    enemyRaw,
    playerBlock,
    enemyFinal: Math.max(0, enemyRaw - playerBlock),
    effectiveDef,
    enemyDamageType: enemyDmgType,
  }
}

function resolveTurn(battleState, otherCombatants) {
  const player = resolvePlayerAttack(battleState, otherCombatants)
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
  }
}

module.exports = {
  rand,
  resolveTurn,
  resolvePlayerAttack,
  resolveEnemyAttack,
  pickPlayerOffensiveStat,
  pickPlayerDefensiveStat,
  getOtherCombatantCount,
}
