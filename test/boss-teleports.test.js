/**
 * Boss teleport invariants.
 *
 * The browser draws bosses from bosses.generated.js, a copy of the ranked
 * enemies cut out of enemies.js by scripts/generate-bosses.js (the registry
 * itself is far too big to ship). This keeps the copy honest and the Travel
 * tab's shelf in step with the `rank`/`lair` tags: every boss with a lair is
 * a landing unless a hub already lands there (minibosses with a lair too,
 * since 5 Nov 2026), and the shelf is sorted highest level first.
 *
 * Run: npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

const {
  BOSS_TELEPORTS,
  TELEPORT_LOCATIONS,
  getTeleportDestination,
  getBossTeleport,
  isTeleportDestinationOpen,
  defeatedBossTeleports,
  isFixedTeleportDestination,
} = require('../src/lib/game-data/teleport-destinations')
const { ENEMIES, getEnemy } = require('../src/lib/game-data/enemies')
const { BOSSES } = require('../src/lib/game-data/bosses.generated')
const { ROOM_ENEMIES, listRoomEnemySlugs } = require('../src/lib/game-data/room-enemies')
const { buildBosses, render, OUT } = require('../scripts/generate-bosses')

test('bosses.generated.js is what enemies.js says it is (run npm run generate-bosses)', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), render(buildBosses(ENEMIES)))
  assert.deepEqual(BOSSES, buildBosses(ENEMIES))
  for (const boss of BOSSES) {
    assert.equal(boss.description, undefined, `${boss.slug}: prose should not ship`)
    assert.equal(boss.drops, undefined, `${boss.slug}: loot should not ship`)
  }
})

test('every ranked enemy is a boss or a miniboss; a lair is a one-entry roll its ranked enemy has to itself', () => {
  const ranked = ENEMIES.filter((enemy) => enemy.rank !== undefined || enemy.lair !== undefined)
  assert.ok(ranked.length >= 40)
  for (const enemy of ranked) {
    assert.ok(enemy.rank === 'boss' || enemy.rank === 'miniboss', `${enemy.slug}: rank "${enemy.rank}"`)
    if (enemy.lair === undefined) continue
    const table = ROOM_ENEMIES[enemy.lair]
    assert.ok(table?.probabilistic, `${enemy.slug}'s lair ${enemy.lair} is static — the rest clock cannot strip it`)
    assert.deepEqual(listRoomEnemySlugs(table), [enemy.slug], `${enemy.slug}'s lair ${enemy.lair} is not its alone`)
  }
  // The mountain ladder: King Blade is a boss without a home; Jikay and Jiemji roll in.
  assert.equal(getEnemy('king-blade').rank, 'boss')
  assert.equal(getEnemy('king-blade').lair, undefined)
  assert.equal(getEnemy('jikay').rank, 'miniboss')
  assert.equal(getEnemy('jiemji').rank, 'miniboss')
  // 5 Nov 2026: the Dragon, the Hydra and the Crocodile are strong regulars;
  // the Despair's five are minibosses with lairs; the mine guards, Victoria,
  // the King Squid and the (promoted) Stone Sphinx have lairs of their own.
  for (const slug of ['dragon', 'hydra', 'crocodile']) assert.equal(getEnemy(slug).rank, undefined, slug)
  for (const slug of ['chimera', 'basilisk', 'medusa', 'cerberus', 'manticore']) assert.equal(getEnemy(slug).rank, 'miniboss', slug)
  assert.equal(getEnemy('stone-sphinx').rank, 'boss')
  assert.deepEqual(
    ['victoria-the-dead', 'war-turtle', 'ulfberht', 'griffin', 'king-squid', 'stone-sphinx'].map((slug) => getEnemy(slug).lair),
    ['232v', '311-05', '311-15', '311-25', '421', '516d']
  )
  // No ranked enemy stands in a static room anywhere.
  for (const [roomId, config] of Object.entries(ROOM_ENEMIES)) {
    if (config.probabilistic) continue
    for (const slug of config.enemies) assert.equal(getEnemy(slug)?.rank, undefined, `${slug} is ranked but static in ${roomId}`)
  }
})

test('the shelf is every ranked enemy with a lair that is not already a hub, highest level first', () => {
  const hubRooms = new Set(TELEPORT_LOCATIONS.map((location) => location.roomId))
  const expected = ENEMIES.filter((enemy) => enemy.rank && enemy.lair && !hubRooms.has(enemy.lair)).map((e) => e.slug)
  assert.deepEqual(new Set(BOSS_TELEPORTS.map((b) => b.slug)), new Set(expected))
  const levels = BOSS_TELEPORTS.map((boss) => boss.level)
  assert.deepEqual(levels, [...levels].sort((a, b) => b - a))
  for (const boss of BOSS_TELEPORTS) {
    const enemy = getEnemy(boss.slug)
    assert.equal(boss.roomId, enemy.lair)
    assert.equal(boss.cost, enemy.level, `${boss.slug}: a boss landing costs its level`)
    assert.equal(boss.icon, enemy.icon)
    assert.ok(!hubRooms.has(boss.roomId), `${boss.roomId} is already a hub`)
  }
  assert.equal(new Set(BOSS_TELEPORTS.map((b) => b.roomId)).size, BOSS_TELEPORTS.length)
  // The Master Temple is a sub-hub, so its Guardian has no second tile; the
  // Hydra and the Crocodile are not ranked; the ladder's bosses have nowhere
  // to land. A miniboss with a lair (the Despair's five, the mine guards) is
  // on the shelf since 5 Nov 2026: the shelf and the rest clocks are one list.
  for (const slug of ['hydra', 'water-temple-guardian', 'crocodile', 'jikay', 'king-blade']) {
    assert.ok(!BOSS_TELEPORTS.some((b) => b.slug === slug), `${slug} should not be on the shelf`)
  }
  for (const slug of ['chimera', 'war-turtle', 'victoria-the-dead', 'king-squid']) {
    assert.ok(BOSS_TELEPORTS.some((b) => b.slug === slug), `${slug} should be on the shelf`)
  }
})

test('a boss room is a network destination that opens on the kill, not on a visit', () => {
  const gator = getTeleportDestination('013')
  assert.ok(isFixedTeleportDestination('013'))
  assert.equal(gator.bossSlug, 'gator')
  assert.equal(gator.cost, 5)
  assert.equal(isTeleportDestinationOpen(gator, ['grassy-field'], []), false)
  assert.equal(isTeleportDestinationOpen(gator, [], ['gator']), true)
  assert.equal(isTeleportDestinationOpen(gator, [], new Set(['gator'])), true)
  assert.equal(getBossTeleport('gator').roomId, '013')
  assert.equal(getBossTeleport('rat'), null)
  // Mountains: the Silver Titan's hall, the Gatekeeper's pass, the Cathedral's angel.
  assert.equal(getTeleportDestination('625').bossSlug, 'silver-titan')
  assert.equal(getTeleportDestination('619').cost, 60)
  assert.equal(getTeleportDestination('623').bossSlug, 'fallen-angel')
})

test('a hub destination is untouched by kills', () => {
  const crossroads = getTeleportDestination('001')
  assert.equal(crossroads.bossSlug, undefined)
  assert.equal(crossroads.cost, 1)
  assert.equal(isTeleportDestinationOpen(crossroads, [], ['gator']), true)
  const forest = getTeleportDestination('104')
  assert.equal(isTeleportDestinationOpen(forest, [], ['gator']), false)
  assert.equal(isTeleportDestinationOpen(forest, ['forest'], undefined), true)
})

test('defeated bosses come back in shelf order, only the ones killed', () => {
  const shelf = defeatedBossTeleports(['gator', 'rat', 'minotaur', 'jikay'])
  assert.deepEqual(shelf.map((b) => b.slug), ['minotaur', 'gator'])
  assert.deepEqual(defeatedBossTeleports([]), [])
  assert.deepEqual(defeatedBossTeleports(undefined), [])
})
