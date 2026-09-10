// A teammate's fight, at a glance.
//
// Presence tells the world that somebody is in a battle and what they are
// fighting. The party wants one thing more: whether the fight is being won.
// This module turns the events a player's own client receives into the small
// party-scoped summary their teammates see — enemy HP, the last exchange, the
// turn — and nothing the owner has not already been told. CommonJS with no
// Node-only imports, so the client can share the shape.

/**
 * @typedef {object} BattleGlance
 * @property {string} id            the fighting player
 * @property {string|null} enemyName
 * @property {number|null} enemyHp
 * @property {number|null} enemyHpMax
 * @property {number|null} enemyHpPct  0–100
 * @property {number|null} lastHit    damage the player dealt this turn
 * @property {number|null} lastTook   damage the enemy dealt this turn
 * @property {number|null} turn
 * @property {number} ts
 */

const TERMINAL = new Set(['battle:victory', 'battle:defeat', 'battle:fled'])

function pct(cur, max) {
  if (typeof cur !== 'number' || typeof max !== 'number' || max <= 0) return null
  return Math.max(0, Math.min(100, Math.round((cur / max) * 100)))
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Read one action's player events for what they say about the fight.
 *
 * @returns {BattleGlance | { id: string, ended: true, ts: number } | null}
 *   a glance when the fight moved, an `ended` marker when it is over, null
 *   when the action had nothing to do with a battle.
 */
function glanceFromEvents(playerId, playerEvents, now = Date.now()) {
  if (!Array.isArray(playerEvents) || !playerEvents.length) return null
  if (playerEvents.some((e) => TERMINAL.has(e?.event))) return { id: playerId, ended: true, ts: now }

  // The last battle payload wins: a one-turn fight emits started then turn.
  let latest = null
  for (const e of playerEvents) {
    if (e?.event === 'battle:started' || e?.event === 'battle:turn') latest = e.payload ?? latest
  }
  if (!latest) return null

  return {
    id: playerId,
    enemyName: latest.enemyName ?? null,
    enemyHp: num(latest.enemyCurrentHp),
    enemyHpMax: num(latest.enemyMaxHp),
    enemyHpPct: pct(latest.enemyCurrentHp, latest.enemyMaxHp),
    lastHit: num(latest.playerDealtDamage),
    lastTook: num(latest.enemyDealtDamage),
    turn: num(latest.turnCount),
    ts: now,
  }
}

/**
 * The same summary read off a live battle, for somebody who was not there for
 * the events — a member who has just joined, or a client that reconnected.
 * The last exchange is not stored on the battle, so it is absent here.
 */
function glanceFromBattle(playerId, battle, now = Date.now()) {
  if (!battle || !battle.isActive) return null
  return {
    id: playerId,
    enemyName: battle.enemyName ?? null,
    enemyHp: num(battle.enemyCurrentHp),
    enemyHpMax: num(battle.enemyMaxHp),
    enemyHpPct: pct(battle.enemyCurrentHp, battle.enemyMaxHp),
    lastHit: null,
    lastTook: null,
    turn: num(battle.turnCount),
    ts: now,
  }
}

module.exports = { glanceFromEvents, glanceFromBattle }
