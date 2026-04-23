const { prisma } = require('../db-client')
const { BattleState } = require('./battle-state')
const { resolveTurn, getOtherCombatantCount } = require('./battle-calculator')
const { handleBattleWin, handleBattleDefeat } = require('./battle-win-handler')
const { getEnemy } = require('../game-data/enemies')
const { getRoomEnemies } = require('../game-data/room-enemies')

function makeFeedback(action, outcome, message, data = {}) {
  const ts = Date.now()
  return {
    action,
    message,
    outcome,
    ts,
    timestamp: new Date(ts).toISOString(),
    success: outcome === 'success',
    data,
  }
}

function errorResult(action, message) {
  return {
    success: false,
    action,
    message,
    playerEvent: {
      event: 'action:feedback',
      payload: makeFeedback(action, 'failure', message),
    },
  }
}

// Fetch the stats needed for BattleState from DB
async function fetchPlayerStats(playerId) {
  return prisma.user.findUnique({
    where: { id: playerId },
    select: { str: true, dex: true, mag: true, def: true, strMod: true, dexMod: true, magMod: true, defMod: true, hp: true, hpMax: true },
  })
}

// ─── start_battle ───────────────────────────────────────────────────────────

async function executeStartBattle(action, playerId, roomState) {
  const player = roomState.players.get(playerId)
  if (!player) return errorResult('start_battle', 'Player not found in this room')

  if (roomState.activeBattles.has(playerId)) {
    return errorResult('start_battle', 'You are already in a battle.')
  }

  const { enemySlug } = action.data || {}
  if (!enemySlug) return errorResult('start_battle', 'No enemy specified.')

  const roomConfig = getRoomEnemies(roomState.roomId)
  if (!roomConfig || !roomConfig.enemies.includes(enemySlug)) {
    return errorResult('start_battle', 'That enemy is not here.')
  }

  const enemy = getEnemy(enemySlug)
  if (!enemy) return errorResult('start_battle', 'Unknown enemy.')

  const playerStats = await fetchPlayerStats(playerId)
  if (!playerStats) return errorResult('start_battle', 'Could not load your stats.')

  const battleState = new BattleState({ playerId, roomId: roomState.roomId, enemy, playerStats })
  roomState.activeBattles.set(playerId, battleState)

  await prisma.user.update({ where: { id: playerId }, data: { inFight: true } })
  roomState.touchActivity()

  const snapshot = battleState.getSnapshot()
  return {
    success: true,
    action: 'start_battle',
    playerEvent: {
      event: 'battle:started',
      payload: {
        ...snapshot,
        enemyDescription: enemy.description,
        playerHp: playerStats.hp,
        playerHpMax: playerStats.hpMax,
      },
    },
    broadcastEvents: [
      {
        event: 'action:feedback',
        targetRoomId: roomState.roomId,
        payload: makeFeedback('start_battle', 'info', `${player.username} engages a ${enemy.name}!`),
      },
    ],
  }
}

// ─── player_attack ──────────────────────────────────────────────────────────

async function executePlayerAttack(action, playerId, roomState) {
  const player = roomState.players.get(playerId)
  if (!player) return errorResult('player_attack', 'Player not found in this room')

  const battleState = roomState.activeBattles.get(playerId)
  if (!battleState || !battleState.isActive) {
    return errorResult('player_attack', 'You are not in a battle.')
  }

  const otherCombatants = getOtherCombatantCount(roomState, playerId)
  const turnResult = resolveTurn(battleState, otherCombatants)

  battleState.applyDamageToEnemy(turnResult.playerDealtDamage)
  battleState.incrementTurn()

  // Victory check
  if (battleState.isEnemyDead()) {
    battleState.end()
    roomState.activeBattles.delete(playerId)

    const winData = await handleBattleWin(playerId, battleState)

    // Rebuild feedback message
    const rewardParts = [`+${winData.xpAwarded} XP`, `+${winData.goldAwarded} Gold`]
    if (winData.droppedItems.length > 0) rewardParts.push(`+${winData.droppedItems.join(', ')}`)
    const winMsg = `You defeated the ${battleState.enemyName}! ${rewardParts.join('  ')}`

    return {
      success: true,
      action: 'player_attack',
      playerEvent: {
        event: 'battle:victory',
        payload: {
          enemyName: battleState.enemyName,
          xpAwarded: winData.xpAwarded,
          goldAwarded: winData.goldAwarded,
          droppedItems: winData.droppedItems,
          lastTurnResult: turnResult,
          message: winMsg,
        },
      },
    }
  }

  // Fetch current player HP for enemy damage application
  const dbPlayer = await prisma.user.findUnique({
    where: { id: playerId },
    select: { hp: true, hpMax: true },
  })
  if (!dbPlayer) return errorResult('player_attack', 'Could not load player state.')

  const newHp = Math.max(0, dbPlayer.hp - turnResult.enemyDealtDamage)
  await prisma.user.update({ where: { id: playerId }, data: { hp: newHp } })

  // Death check
  if (newHp <= 0) {
    battleState.end()
    roomState.activeBattles.delete(playerId)
    await handleBattleDefeat(playerId)

    return {
      success: true,
      action: 'player_attack',
      playerEvent: {
        event: 'battle:defeat',
        payload: {
          enemyName: battleState.enemyName,
          respawnRoomId: '999',
          message: `The ${battleState.enemyName} overwhelms you. You black out...`,
        },
      },
    }
  }

  // Fight continues
  const snapshot = battleState.getSnapshot()
  const parts = []
  parts.push(`You strike the ${battleState.enemyName} for ${turnResult.playerDealtDamage} damage.`)
  if (turnResult.multiplayerBonus) parts[0] += ` (+${turnResult.bonusPercent}% group bonus)`
  if (turnResult.enemyDealtDamage === 0) {
    parts.push(`The ${battleState.enemyName} attacks but you block it!`)
  } else {
    parts.push(`The ${battleState.enemyName} hits you for ${turnResult.enemyDealtDamage} damage. (HP: ${newHp}/${dbPlayer.hpMax})`)
  }

  return {
    success: true,
    action: 'player_attack',
    playerEvent: {
      event: 'battle:turn',
      payload: {
        ...snapshot,
        playerHp: newHp,
        playerHpMax: dbPlayer.hpMax,
        playerDealtDamage: turnResult.playerDealtDamage,
        enemyDealtDamage: turnResult.enemyDealtDamage,
        playerBlocked: turnResult.playerBlocked,
        enemyBlocked: turnResult.enemyBlocked,
        multiplayerBonus: turnResult.multiplayerBonus,
        bonusPercent: turnResult.bonusPercent,
        message: parts.join(' '),
      },
    },
  }
}

// ─── player_flee ─────────────────────────────────────────────────────────────

async function executePlayerFlee(action, playerId, roomState) {
  const battleState = roomState.activeBattles.get(playerId)
  if (!battleState || !battleState.isActive) {
    return errorResult('player_flee', 'You are not in a battle.')
  }

  if (!battleState.canFlee) {
    const turnsLeft = 10 - battleState.turnCount
    return errorResult('player_flee', `You cannot flee yet. Fight for ${turnsLeft} more turn${turnsLeft !== 1 ? 's' : ''}.`)
  }

  battleState.end()
  roomState.activeBattles.delete(playerId)
  await prisma.user.update({ where: { id: playerId }, data: { inFight: false } })

  return {
    success: true,
    action: 'player_flee',
    playerEvent: {
      event: 'battle:fled',
      payload: { message: 'You managed to escape!' },
    },
  }
}

module.exports = { executeStartBattle, executePlayerAttack, executePlayerFlee }
