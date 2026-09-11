/**
 * The Stone Mountains' mechanics.
 *
 * The boss ladder in the spawn tables (a Flying Dung Beetle until the
 * mountain's guardians fall, then Jikay or Jiemji, then King Blade), the two
 * enemy specials the mountain adds (Whirlwind and Firebreath), the Master
 * Trainer's Pro proficiencies (a multiplier on the gear-side stat, only once
 * the base skill is at 20), the Icy Path's slip table, the toll pass and the
 * graveyard's loop. Pure functions, no database.
 *
 * Run: npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const roomEnemies = require(path.join(ROOT, 'src/lib/game-data/room-enemies.js'))
const { ENEMY_SPECIALS, SPECIAL_PRIORITY, selectEnemySpecial } = require(path.join(ROOT, 'src/lib/game-data/enemy-specials.js'))
const { getEnemy } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))
const skills = require(path.join(ROOT, 'src/lib/game-data/skills.js'))
const { ROOM_GATES } = require(path.join(ROOT, 'src/lib/game-engine/room-gates.js'))
const { REVEAL_DEFINITIONS } = require(path.join(ROOT, 'src/lib/game-engine/search-reveal-state.js'))

const withRandom = (value, fn) => {
  const original = Math.random
  Math.random = () => value
  try {
    return fn()
  } finally {
    Math.random = original
  }
}

const bossSlot = (roomId) => roomEnemies.ROOM_ENEMIES[roomId].enemies.find((e) => Array.isArray(e.ladder))

test('the mountain boss slot climbs with the kill list, from a dung beetle to King Blade', () => {
  const ladder = bossSlot('601').ladder
  const pool = (kills) => roomEnemies.resolveLadder(ladder, new Set(kills)).map((e) => e.slug)

  assert.deepEqual(pool([]), ['flying-dung-beetle'])
  assert.deepEqual(pool(['yeti', 'dragon']), ['flying-dung-beetle'])
  assert.deepEqual(pool(['gatekeeper']), ['jikay', 'jiemji'])
  assert.deepEqual(pool(['giant-mountain-giant']), ['jikay', 'jiemji'])
  assert.deepEqual(pool(['giant-mountain-giant', 'jikay']), ['jiemji'])
  assert.deepEqual(pool(['gatekeeper', 'jiemji']), ['jikay'])
  const ready = roomEnemies.resolveLadder(ladder, new Set(['jikay', 'jiemji']))
  assert.deepEqual(ready.map((e) => [e.slug, e.weight]), [['jikay', 1], ['jiemji', 1], ['king-blade', 3]])
  assert.deepEqual(pool(['jikay', 'jiemji', 'king-blade']), ['jikay', 'jiemji', 'king-blade'])
})

test("the Cathedral's rare slots hand out rats until a guardian falls, and nothing once King Blade is dead", () => {
  const [first, second] = roomEnemies.ROOM_ENEMIES['622'].enemies.filter((e) => Array.isArray(e.ladder))
  const pool = (ladder, kills) => roomEnemies.resolveLadder(ladder, new Set(kills)).map((e) => e.slug)

  assert.deepEqual(pool(first.ladder, []), ['rat'])
  assert.deepEqual(pool(first.ladder, ['giant-mountain-giant']), ['jikay'])
  assert.deepEqual(pool(first.ladder, ['gatekeeper']), ['jiemji'])
  assert.deepEqual(pool(first.ladder, ['giant-mountain-giant', 'gatekeeper']), ['king-blade'])
  assert.deepEqual(pool(first.ladder, ['giant-mountain-giant', 'gatekeeper', 'king-blade']), [])
  assert.deepEqual(pool(second.ladder, []), ['giant-rat'])
  assert.deepEqual(pool(second.ladder, ['gatekeeper']), ['jikay'])
  // The Altar shares both slots.
  assert.equal(roomEnemies.ROOM_ENEMIES['623'].enemies.filter((e) => Array.isArray(e.ladder)).length, 2)
})

test('a roll with no kill set only ever reaches the unconditional rung', () => {
  // Math.random = 0.999 lands on the last entry of the table, the boss slot.
  const slug = withRandom(0.9999, () => roomEnemies.rollRoomEnemy('601'))
  assert.equal(slug, null, 'a 0.9999 roll fails the spawn chance')
  const config = roomEnemies.ROOM_ENEMIES['601']
  const spawn = withRandom(0.4, () => {
    // Force the spawn roll to pass and the pick to land on the ladder by
    // stubbing spawnChance for the duration of the call.
    const saved = config.spawnChance
    config.spawnChance = 1
    try {
      return roomEnemies.rollRoomEnemy('601', { kills: null })
    } finally {
      config.spawnChance = saved
    }
  })
  assert.ok(typeof spawn === 'string')
  assert.ok(roomEnemies.listRoomEnemySlugs(config).includes(spawn))
})

test('every slug a Mountains table can produce is a defined enemy, ladders included', () => {
  for (const roomId of ['601', '604', '620', '621', '622', '623', '625', '617', '619', '616']) {
    for (const slug of roomEnemies.listRoomEnemySlugs(roomEnemies.ROOM_ENEMIES[roomId])) {
      assert.ok(getEnemy(slug), `${roomId} can spawn "${slug}", which does not exist`)
    }
  }
  assert.deepEqual(roomEnemies.ROOM_ENEMIES['619'].enemies, ['gatekeeper'])
})

test('Whirlwind sums six ATT rolls and Firebreath is 3–5 gouts at full ATT, pure', () => {
  const rolls = [10, 20, 30, 40, 50, 60]
  let i = 0
  const seq = () => rolls[i++]
  const whirlwind = ENEMY_SPECIALS.whirlwind.rollDamage({ att: 100 }, seq)
  assert.deepEqual(whirlwind.rolls, rolls)
  assert.equal(whirlwind.raw, 210)
  assert.equal(ENEMY_SPECIALS.whirlwind.bypassesDefense, undefined)

  const fire = ENEMY_SPECIALS.dragonfire.rollDamage({ att: 250 }, () => 4)
  assert.deepEqual(fire.rolls, [250, 250, 250, 250])
  assert.equal(fire.raw, 1000)
  assert.equal(ENEMY_SPECIALS.dragonfire.bypassesDefense, true)

  // The original's own order: whirlwind before firebreath before crit.
  assert.deepEqual(SPECIAL_PRIORITY.slice(0, 3), ['whirlwind', 'dragonfire', 'crit'])
  // King Blade carries both rage and whirlwind; a 1-in-4 roll fires the whirlwind first.
  const kingBlade = getEnemy('king-blade')
  assert.equal(selectEnemySpecial(kingBlade, () => 1).id, 'whirlwind')
  assert.equal(getEnemy('dragon').specials.includes('dragonfire'), true)
})

test('a Pro proficiency is 5% a level of the gear-side stat plus the flat proficiency, for the matching weapon only', () => {
  const oneHanded = { weaponCategory: 'MELEE', isTwoHanded: false, hasShield: false }
  const bow = { weaponCategory: 'RANGED', isTwoHanded: false, hasShield: false }
  const levels = { oneHanded: 20, oneHandedPro: 5, ranged: 20, rangedPro: 2 }

  const swing = skills.getPassiveSkillBonuses(levels, oneHanded, { str: 100, dex: 300 })
  // (100 gear + 20 flat) × 0.25
  assert.equal(swing.str, 20 + 30)
  assert.deepEqual(swing.parts.find((p) => p.skillId === 'one-handed-pro'), { skillId: 'one-handed-pro', stat: 'str', amount: 30 })
  assert.equal(swing.dex, 0, 'Ranged Pro does nothing with a sword in hand')

  const shot = skills.getPassiveSkillBonuses(levels, bow, { str: 100, dex: 300 })
  // (300 gear + 20 flat) × 0.10
  assert.equal(shot.dex, 20 + 32)
  assert.equal(shot.str, 0)

  // Without the gear-side numbers the Pro skills add nothing (the book's "what would this do" line).
  assert.equal(skills.getPassiveSkillBonuses(levels, oneHanded).str, 20)
})

test('the Pro proficiencies want the Master Trainer and the base skill at 20, and cost 5 SP a level', () => {
  const pro = skills.getSkill('one-handed-pro')
  assert.equal(skills.getSkillMaxLevel(pro, {}), 0)
  assert.equal(skills.getSkillMaxLevel(pro, { masterTrainerFlag: true }), 5)
  assert.equal(skills.getSkillMaxLevel(pro, { masterTrainerFlag: true }, { oneHanded: 19 }), 0)
  assert.equal(skills.getSkillMaxLevel(pro, { masterTrainerFlag: true }, { oneHanded: 20 }), 5)
  assert.equal(skills.getSkillMaxLevel(pro, { starCitySkillsFlag: true }, { oneHanded: 25 }), 10)
  assert.equal(skills.prerequisiteReason(pro, { oneHanded: 3 }), 'Needs One Handed 20')
  assert.equal(skills.prerequisiteReason(pro, { oneHanded: 20 }), null)
  assert.equal(skills.prerequisiteReason(skills.getSkill('one-handed'), {}), null)
  assert.deepEqual([1, 2, 3].map((lvl) => skills.getNextLearnCost(pro, lvl - 1, 5)), [5, 10, 15])
  assert.equal(skills.SKILL_TEACHER_ROOMS['610'].flag, 'masterTrainerFlag')
})

test('the graveyard loops every direction back into itself, and the hidden ways in are gated until found', async () => {
  const graveyard = ROOM_GATES['616']
  for (const direction of ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest', 'up', 'down']) {
    assert.equal(await graveyard[direction].check('p1'), false)
    assert.match(graveyard[direction].message, /even more lost/)
  }
  assert.equal(REVEAL_DEFINITIONS['615'].toRoom, '616')
  assert.equal(REVEAL_DEFINITIONS['623'].toRoom, '616')
  assert.equal(REVEAL_DEFINITIONS['620'].toRoom, '625')
  assert.ok(ROOM_GATES['615'].northwest.silent && ROOM_GATES['623'].southwest.silent && ROOM_GATES['620'].northwest.silent)
})

test('the Highway Toll opens west on the session pass and spends it on the crossing', async () => {
  const lever = require(path.join(ROOT, 'src/lib/game-engine/lever-state.js'))
  const gate = ROOM_GATES['504'].west
  lever.resetLever('toll-p', lever.HIGHWAY_TOLL)
  assert.equal(await gate.check('toll-p'), false)
  lever.pullLever('toll-p', lever.HIGHWAY_TOLL)
  assert.equal(await gate.check('toll-p'), true)
  await gate.onPass('toll-p')
  assert.equal(await gate.check('toll-p'), false, 'a pass buys one crossing')
})

test('the Icy Mountain Path slips one time in three into the pit below, floored at 1 HP', () => {
  const { ROOM_TRAVEL_HAZARDS } = require(path.join(ROOT, 'src/lib/game-engine/room-state.js'))
  const slip = ROOM_TRAVEL_HAZARDS['614']
  assert.equal(slip.toRoom, '615')
  assert.ok(Math.abs(slip.chance - 1 / 3) < 1e-9)
  assert.deepEqual([slip.min, slip.max], [100, 1000])
  assert.match(slip.message('west', 250), /slip on the ice.*250 damage/)
})
