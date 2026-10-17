/**
 * What an enemy's hit is called, and where it says so.
 *
 * A magic attacker's ordinary hit was blocked by MAG all along, but the feed,
 * the card and the history all called it a swing. The original said "casts a
 * spell at you for", in blue, with its eMag icon; a ranged hit was green with
 * eDex and kept the melee words. These pin the server's feed line, the type a
 * history row keeps, and the icon lookup the card uses. Pure functions; Prisma
 * is stubbed before anything loads it.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')

const dbPath = require.resolve(path.join(ROOT, 'src/lib/db-client.js'))
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma: {} } }

const { describeEnemyAttack } = require(path.join(ROOT, 'src/lib/game-engine/battle-action-handlers.js'))
const { compactTurn } = require(path.join(ROOT, 'src/lib/game-engine/fight-ledger.js'))
const { perkIcon } = require(path.join(ROOT, 'src/lib/game-data/enemy-traits.js'))

const POWER = { id: 'power', name: 'Power Attack', rolls: [4, 5, 6] }
const magic = (over = {}) => ({ enemyDamageType: 'MAGIC', ...over })

// --- The feed line -----------------------------------------------------------

test("a caster's hit is a spell, and MAG is what wards it off", () => {
  assert.equal(
    describeEnemyAttack('Kobold Shaman', 9, null, '', false, magic()),
    'The Kobold Shaman casts a spell at you for 9 damage.'
  )
  assert.equal(
    describeEnemyAttack('Kobold Shaman', 0, null, '', false, magic()),
    'The Kobold Shaman casts a spell, but your MAG wards it off!'
  )
  assert.equal(
    describeEnemyAttack('Kobold Shaman', 9, null, '', true, magic()),
    "You DODGE the Kobold Shaman's spell!"
  )
})

test("a caster's extra hits are casts; a special keeps its own name", () => {
  const line = describeEnemyAttack('Phoenix', 15, null, '', false, magic({
    extraHits: [
      { raw: 8, block: 2, damage: 6, dodged: false },
      { raw: 3, block: 5, damage: 0, dodged: false },
    ],
  }))
  assert.equal(
    line,
    'The Phoenix casts a spell at you for 9 damage. It casts again for 6! It casts again, but your MAG wards it off! (15 total)'
  )
  // A special on a caster reads exactly as it does on anyone else.
  assert.equal(
    describeEnemyAttack('Jiemji', 15, POWER, '', false, magic()),
    'The Jiemji unleashes a POWER ATTACK for 15 damage!'
  )
})

test('melee and ranged hits keep their words, as the original had them', () => {
  for (const type of ['MELEE', 'RANGED', null]) {
    assert.equal(
      describeEnemyAttack('Bowman', 7, null, '', false, { enemyDamageType: type }),
      'The Bowman hits you for 7 damage.'
    )
    assert.equal(
      describeEnemyAttack('Bowman', 0, null, '', false, { enemyDamageType: type }),
      'The Bowman attacks but you block it!'
    )
  }
})

// --- The history row ---------------------------------------------------------

const enemyTurn = (over = {}) => ({
  playerDealtDamage: 4,
  enemyDealtDamage: 9,
  playerRaw: 6,
  enemyRaw: 14,
  playerBlocked: 5,
  enemyBlocked: 2,
  enemyAction: null,
  extraHits: [],
  ...over,
})
const row = (over) => compactTurn(enemyTurn(over), { turn: 3, playerHp: 31, enemyHp: 18 })

test('a history row keeps a magic or ranged hit type, and only those', () => {
  assert.equal(row({ enemyDamageType: 'MAGIC' }).foe.type, 'MAGIC')
  assert.equal(row({ enemyDamageType: 'RANGED' }).foe.type, 'RANGED')
  assert.equal(row({ enemyDamageType: 'MAGIC', enemyAction: POWER }).foe.type, 'MAGIC')
  // Melee rows are the size they were: no key at all.
  assert.equal('type' in row({ enemyDamageType: 'MELEE' }).foe, false)
  assert.equal('type' in row({}).foe, false)
  // An enemy that never acted (the turn that killed it) has no hit to type.
  const killed = compactTurn(enemyTurn({ enemyDamageType: 'MAGIC', enemyDealtDamage: 0, enemyRaw: null }), {
    turn: 4, playerHp: 31, enemyHp: 0, enemyActed: false,
  })
  assert.equal('type' in killed.foe, false)
})

// --- The card's icon slot ----------------------------------------------------

test("the original's icons are found for the types and the specials", () => {
  assert.equal(perkIcon('magic'), 'eMag')
  assert.equal(perkIcon('ranged'), 'eDex')
  assert.equal(perkIcon('power'), 'ePow')
  assert.equal(perkIcon('crit'), 'eCrit')
  assert.equal(perkIcon('dragonfire'), 'eDragonfire')
  assert.equal(perkIcon('heal'), 'eHeal')
  assert.equal(perkIcon('no-such-perk'), null)
  assert.equal(perkIcon(null), null)
})
