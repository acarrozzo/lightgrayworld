function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Count other players in the same room who also have an active battle
function getOtherCombatantCount(roomState, excludePlayerId) {
  let count = 0
  for (const [pid, battle] of roomState.activeBattles.entries()) {
    if (pid !== excludePlayerId && battle.isActive) count++
  }
  return count
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
  const effectiveOff = Math.max(1, Math.floor(offStat * bonus))

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

  const playerRaw = rand(Math.floor(effectiveOff * 0.5), effectiveOff)
  const enemyBlock = rand(Math.floor(enemy.def * 0.5), enemy.def)
  return {
    playerRaw,
    enemyBlock,
    playerFinal: Math.max(1, playerRaw - enemyBlock),
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
  const effectiveDef = Math.max(1, Math.floor(defStat * bonus))

  const enemyRaw = rand(Math.floor(enemy.att * 0.5), enemy.att)
  const playerBlock = rand(Math.floor(effectiveDef * 0.5), effectiveDef)
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
