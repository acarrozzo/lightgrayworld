/**
 * Boss rest timers (decided 4–5 Nov 2026).
 *
 * Beat a ranked enemy with a lair and it rests for you: its level band in
 * minutes (minibosses half), stripped from every roll it sits in, the lair
 * SAFE, its Boss Chest open once per kill. The kill time is KillList.lastKilledAt,
 * mirrored per process by kill-list-service; the test reset clears it and
 * exists only behind BOSS_REST_TEST=1.
 *
 * Run: npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const stub = (rel, exportsObject) => {
  const file = require.resolve(path.join(ROOT, rel))
  require.cache[file] = { id: file, filename: file, loaded: true, exports: exportsObject }
}

// --- a fake database: the two tables the system writes, in memory ---
const db = {
  killRows: new Map(), // `${userId}:${monster}` -> { kills, lastKilledAt }
  caps: new Map(), // `${playerId}:${roomId}:${actionKey}` -> { lastActionAt }
}
const fakePrisma = {
  killList: {
    findMany: async ({ where }) =>
      [...db.killRows.entries()]
        .filter(([key, row]) => key.startsWith(`${where.userId}:`) && row.kills >= 1)
        .map(([key, row]) => ({ monster: key.split(':')[1], lastKilledAt: row.lastKilledAt })),
    findUnique: async ({ where }) => {
      const row = db.killRows.get(`${where.userId_monster.userId}:${where.userId_monster.monster}`)
      return row ? { kills: row.kills, lastKilledAt: row.lastKilledAt } : null
    },
    updateMany: async ({ where, data }) => {
      const row = db.killRows.get(`${where.userId}:${where.monster}`)
      if (!row) return { count: 0 }
      Object.assign(row, data)
      return { count: 1 }
    },
  },
  actionCap: {
    findUnique: async ({ where }) => {
      const k = where.playerId_roomId_actionKey
      return db.caps.get(`${k.playerId}:${k.roomId}:${k.actionKey}`) ?? null
    },
    upsert: async ({ where }) => {
      const k = where.playerId_roomId_actionKey
      const key = `${k.playerId}:${k.roomId}:${k.actionKey}`
      if (!db.caps.has(key)) db.caps.set(key, { lastActionAt: null })
      return db.caps.get(key)
    },
    updateMany: async ({ where, data }) => {
      const key = `${where.playerId}:${where.roomId}:${where.actionKey}`
      const cap = db.caps.get(key)
      if (!cap) return { count: 0 }
      if (where.OR) {
        const lt = where.OR[1].lastActionAt.lt
        const ok = cap.lastActionAt == null || cap.lastActionAt < lt
        if (!ok) return { count: 0 }
      }
      Object.assign(cap, data)
      return { count: 1 }
    },
  },
  user: { update: async () => ({ id: 'p1', currency: 100, xp: 50 }), findUnique: async () => ({ id: 'p1', currency: 100, xp: 50 }) },
  $transaction: async (fn) => fn(fakePrisma),
}
stub('src/lib/db-client.js', { prisma: fakePrisma })
stub('src/lib/game-engine/services/present-enemy-service.js', { savePresentEnemy: async () => {}, loadPresentEnemy: async () => null })
stub('src/lib/game-engine/services/inventory-service.js', {
  grantItemOnce: async () => ({ granted: true }),
  getPlayerInventory: async () => [],
  getItemBySlug: async (slug) => ({ name: slug }),
  playerHasItem: async () => false,
  getHeldQuantity: async () => 0,
  removeItemBySlug: async () => ({ success: true }),
})
stub('src/lib/game-engine/services/leveling-service.js', { checkAndApplyLevelUp: async () => ({ leveled: false }) })

const bossRest = require(path.join(ROOT, 'src/lib/game-data/boss-rest.js'))
const { ENEMIES, getEnemy } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))
const { ROOM_ENEMIES, rollRoomEnemy, listRoomEnemySlugs } = require(path.join(ROOT, 'src/lib/game-data/room-enemies.js'))
const killList = require(path.join(ROOT, 'src/lib/game-engine/services/kill-list-service.js'))
const restService = require(path.join(ROOT, 'src/lib/game-engine/services/boss-rest-service.js'))
const { BOSS_TELEPORTS } = require(path.join(ROOT, 'src/lib/game-data/teleport-destinations.js'))

const MIN = 60 * 1000
const withRandom = (value, fn) => {
  const original = Math.random
  Math.random = () => value
  try {
    return fn()
  } finally {
    Math.random = original
  }
}

test.beforeEach(() => {
  db.killRows.clear()
  db.caps.clear()
  killList.clearKillSet('p1')
  delete process.env.BOSS_REST_TEST
})

test('the rest is the level band, minibosses half, and only a ranked enemy with a lair rests', () => {
  assert.equal(bossRest.restMinutesFor(getEnemy('gator')), 5) // L5
  assert.equal(bossRest.restMinutesFor(getEnemy('goblin-chief')), 30) // L10
  assert.equal(bossRest.restMinutesFor(getEnemy('minotaur')), 360) // L60: about six hours
  assert.equal(bossRest.restMinutesFor(getEnemy('skeleton-king')), 1440) // L100: a day
  assert.equal(bossRest.restMinutesFor(getEnemy('chimera')), 360) // L80 miniboss: half of 12h
  assert.equal(bossRest.restMinutesFor(getEnemy('war-turtle')), 30) // L25 miniboss: half of 1h
  // Nothing that moves rests: King Blade has no lair, the Dragon no rank.
  assert.equal(bossRest.restMinutesFor(getEnemy('king-blade')), 0)
  assert.equal(bossRest.restMinutesFor(getEnemy('jikay')), 0)
  assert.equal(bossRest.restMinutesFor(getEnemy('dragon')), 0)
  assert.equal(bossRest.restMinutesFor(getEnemy('rat')), 0)
  // A definition may override its band by hand.
  assert.equal(bossRest.restMinutesFor({ rank: 'boss', lair: '013', level: 5, rest: 42 }), 42)
  // The clock is the kill plus the rest.
  const at = Date.UTC(2026, 10, 5, 12, 0, 0)
  assert.equal(bossRest.restingUntil(getEnemy('gator'), at), at + 5 * MIN)
  assert.equal(bossRest.isResting(getEnemy('gator'), at, at + 4 * MIN), true)
  assert.equal(bossRest.isResting(getEnemy('gator'), at, at + 5 * MIN), false)
  assert.equal(bossRest.restingUntil(getEnemy('gator'), null), null)
  assert.equal(bossRest.formatRestMinutes(90), '1h 30m')
  assert.equal(bossRest.formatRestMinutes(5), '5m')
})

test('the rest clock and the teleport shelf are one list: every resting enemy has a landing and vice versa', () => {
  const resting = new Set(ENEMIES.filter((e) => bossRest.isRestingBoss(e)).map((e) => e.slug))
  const shelf = new Set(BOSS_TELEPORTS.map((b) => b.slug))
  // The Master Temple's Guardian rests but lands on the sub-hub instead of a tile of its own.
  shelf.add('water-temple-guardian')
  assert.deepEqual(resting, shelf)
  assert.equal(resting.size, 39)
})

test('a resting boss is stripped from its lair roll; a rung whose every boss rests is quiet', () => {
  // The Gator's marsh: nothing can come out while it rests, whatever the dice say.
  assert.equal(withRandom(0, () => rollRoomEnemy('013', { resting: new Set(['gator']) })), null)
  assert.equal(withRandom(0, () => rollRoomEnemy('013', { resting: new Set() })), 'gator')
  assert.equal(withRandom(0, () => rollRoomEnemy('013', {})), 'gator')
  // Every lair is its boss's alone, so a resting boss leaves the lair empty.
  for (const enemy of ENEMIES.filter((e) => bossRest.isRestingBoss(e))) {
    assert.deepEqual(listRoomEnemySlugs(ROOM_ENEMIES[enemy.lair]), [enemy.slug], enemy.slug)
    assert.equal(withRandom(0, () => rollRoomEnemy(enemy.lair, { resting: new Set([enemy.slug]) })), null, enemy.slug)
  }
  // A shared pool loses only the resting entry (a synthetic table).
  ROOM_ENEMIES['test-mixed'] = { probabilistic: true, spawnChance: 1, enemies: [{ slug: 'gator', weight: 1 }, { slug: 'rat', weight: 1 }] }
  try {
    assert.equal(withRandom(0, () => rollRoomEnemy('test-mixed', { resting: new Set(['gator']) })), 'rat')
    assert.equal(withRandom(0.99, () => rollRoomEnemy('test-mixed', { resting: new Set(['gator']) })), 'rat')
    assert.equal(withRandom(0, () => rollRoomEnemy('test-mixed', { resting: new Set(['gator', 'rat']) })), null)
  } finally {
    delete ROOM_ENEMIES['test-mixed']
  }
})

test('the kill mirror knows when, and says who rests now', async () => {
  const now = Date.now()
  db.killRows.set('p1:gator', { kills: 3, lastKilledAt: new Date(now - 2 * MIN) })
  db.killRows.set('p1:rat', { kills: 9, lastKilledAt: new Date(now - 1000) })
  db.killRows.set('p1:goblin-chief', { kills: 1, lastKilledAt: new Date(now - 40 * MIN) })
  db.killRows.set('p1:minotaur', { kills: 1, lastKilledAt: null }) // a row older than the clock
  const kills = await killList.loadKillSet('p1', fakePrisma)
  assert.deepEqual([...kills].sort(), ['gator', 'goblin-chief', 'minotaur', 'rat'])
  // The Gator (5m) still rests two minutes in; the Chief (30m) is back forty minutes on;
  // the rat is no boss; the Minotaur's row has no time.
  assert.deepEqual([...killList.getRestingSet('p1', now)], ['gator'])
  assert.equal(killList.getLastKilledAt('p1', 'gator'), now - 2 * MIN)
  // A fresh kill rests from its moment; the test reset forgets it, the count stays.
  killList.noteKill('p1', 'goblin-chief', now)
  assert.deepEqual([...killList.getRestingSet('p1', now)].sort(), ['gator', 'goblin-chief'])
  killList.clearLastKill('p1', 'goblin-chief')
  assert.deepEqual([...killList.getRestingSet('p1', now)], ['gator'])
  assert.ok(killList.getKillSet('p1').has('goblin-chief'))
  // Nothing loaded, nothing rests: the roll strips nothing.
  assert.equal(killList.getRestingSet('nobody').size, 0)
})

test('the room roll reads the mirror: a resting lair boss does not come out, and comes back when the rest ends', async () => {
  const { RoomState } = require(path.join(ROOT, 'src/lib/game-engine/room-state.js'))
  const now = Date.now()
  db.killRows.set('p1:gator', { kills: 1, lastKilledAt: new Date(now - 1 * MIN) })
  await killList.loadKillSet('p1', fakePrisma)
  const marsh = new RoomState('013')
  assert.equal(withRandom(0, () => marsh.maybeSpawnEnemy('p1')), null)
  assert.equal(marsh.getPresentEnemy('p1'), null)
  // Five minutes on, the marsh rolls again.
  killList.noteKill('p1', 'gator', now - 6 * MIN)
  assert.equal(withRandom(0, () => marsh.maybeSpawnEnemy('p1')), 'gator')
})

test('the lair status: who rests here for me, for how long, and whether the Boss Chest is still full', async () => {
  const now = Date.now()
  assert.equal(restService.getLairBoss('013').slug, 'gator')
  assert.equal(restService.getLairBoss('001'), null)
  // No kill: nothing rests, the room is itself.
  assert.equal(await restService.buildBossRestStatus('p1', '013', now), null)
  db.killRows.set('p1:gator', { kills: 1, lastKilledAt: new Date(now - 2 * MIN) })
  await killList.loadKillSet('p1', fakePrisma)
  const status = await restService.buildBossRestStatus('p1', '013', now)
  assert.equal(status.slug, 'gator')
  assert.equal(status.rank, 'boss')
  assert.equal(status.restMinutes, 5)
  assert.equal(status.secondsRemaining, 180)
  assert.equal(status.totalSeconds, 300)
  assert.equal(status.restingUntil, now - 2 * MIN + 5 * MIN)
  assert.deepEqual(status.chest, { action: 'open boss chest', label: 'Gator Chest', opened: false })
  assert.equal(status.testReset, false)
  // An open newer than the kill: the chest is empty until the next kill.
  db.caps.set('p1:013:open boss chest', { lastActionAt: new Date(now - MIN) })
  assert.equal((await restService.buildBossRestStatus('p1', '013', now)).chest.opened, true)
  // An open older than the kill: this kill filled it again.
  db.caps.set('p1:013:open boss chest', { lastActionAt: new Date(now - 10 * MIN) })
  assert.equal((await restService.buildBossRestStatus('p1', '013', now)).chest.opened, false)
  // The rest over: nothing to show, and `isLairBossResting` agrees.
  assert.equal(await restService.buildBossRestStatus('p1', '013', now + 4 * MIN), null)
  assert.equal(restService.isLairBossResting('p1', '013', now), true)
  assert.equal(restService.isLairBossResting('p1', '013', now + 4 * MIN), false)
})

test('the Boss Chest opens once per kill: a second try, a second socket and a reset all find it shut', async () => {
  const handlers = require(path.join(ROOT, 'src/lib/game-engine/room-action-handlers.js'))
  const open = handlers.ROOM_ACTIONS['013']['open boss chest']
  const room = { roomId: '013', touchActivity() {} }
  const feedback = (result) => result.playerEvents[0].payload
  const now = Date.now()

  // No kill yet: shut.
  let result = await open('p1', room)
  assert.equal(result.noTurn, true)
  assert.match(feedback(result).message, /is shut/)

  // Killed two minutes ago: open, once.
  db.killRows.set('p1:gator', { kills: 1, lastKilledAt: new Date(now - 2 * MIN) })
  result = await open('p1', room)
  assert.equal(feedback(result).outcome, 'success')
  assert.deepEqual(feedback(result).data.bossChest, { bossSlug: 'gator', opened: true })
  assert.ok(feedback(result).data.questComplete.rewards.some((r) => r.type === 'item' && r.itemSlug === 'red-potion' && r.quantity === 2))
  assert.ok(feedback(result).data.questComplete.rewards.some((r) => r.type === 'item' && r.itemSlug === 'blue-potion' && r.quantity === 2))
  // No Boss Chest gives XP (5 Nov 2026).
  assert.ok(!feedback(result).data.questComplete.rewards.some((r) => r.type === 'xp'))
  const opened = db.caps.get('p1:013:open boss chest').lastActionAt
  assert.ok(opened > new Date(now - 2 * MIN))

  // Again, from this or another socket: already emptied, and the row is untouched.
  result = await open('p1', room)
  assert.match(feedback(result).message, /already emptied/)
  assert.equal(db.caps.get('p1:013:open boss chest').lastActionAt, opened)

  // The rest over (the kill is old): shut, not emptied.
  db.killRows.set('p1:gator', { kills: 1, lastKilledAt: new Date(now - 20 * MIN) })
  result = await open('p1', room)
  assert.match(feedback(result).message, /is shut/)

  // A new kill fills it again.
  db.killRows.set('p1:gator', { kills: 2, lastKilledAt: new Date(now + 1000) })
  result = await open('p1', room)
  assert.equal(feedback(result).outcome, 'success')

  // The chest is listed for the World Tool, with the Thief's folded chest beside it.
  assert.deepEqual(handlers.BOSS_CHEST_LOOT.map((c) => [c.roomId, c.bossSlug]), [['013', 'gator'], ['232o', 'master-thief']])
  assert.ok(!handlers.REPEATABLE_CHEST_LOOT.some((c) => c.roomId === '232o'))
})

test('the test reset exists only behind the flag, forgets the time and keeps the count', async () => {
  const now = Date.now()
  db.killRows.set('p1:gator', { kills: 4, lastKilledAt: new Date(now) })
  await killList.loadKillSet('p1', fakePrisma)
  assert.equal(restService.isTestResetEnabled(), false)
  let result = await restService.resetBossRest('p1', 'gator')
  assert.equal(result.ok, false)
  assert.equal(db.killRows.get('p1:gator').lastKilledAt.getTime(), now)

  process.env.BOSS_REST_TEST = '1'
  assert.equal(restService.isTestResetEnabled(), true)
  assert.equal((await restService.resetBossRest('p1', 'rat')).ok, false) // no clock to reset
  result = await restService.resetBossRest('p1', 'gator')
  assert.equal(result.ok, true)
  assert.equal(db.killRows.get('p1:gator').lastKilledAt, null)
  assert.equal(db.killRows.get('p1:gator').kills, 4)
  assert.equal(killList.getRestingSet('p1', now).size, 0)
  assert.equal(await restService.buildBossRestStatus('p1', '013', now), null)
})
