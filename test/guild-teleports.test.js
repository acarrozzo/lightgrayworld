/**
 * Guild teleport invariants.
 *
 * The original's teleport grid had a square per guild, lit once the guild's
 * initiation quest was turned in: Warrior's Guild (226), Wizard's Guild (225),
 * Mining Guild (308), Ranger's Guild (515a). Here each is a sub-hub of the
 * region that holds it, opened by membership rather than by standing in it.
 * This keeps the registry, the faction list and the open check in step.
 *
 * Run: npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

const {
  TELEPORT_HUBS,
  getTeleportHubByMembership,
  getTeleportHubByRoom,
  getWorldRegionForRoom,
  teleportHubLabel,
} = require('../src/lib/game-data/world-map')
const { FACTIONS, memberGuildIds } = require('../src/lib/game-data/factions')
const {
  TELEPORT_LOCATIONS,
  TELEPORT_MP_COST,
  getTeleportDestination,
  isTeleportDestinationOpen,
} = require('../src/lib/game-data/teleport-destinations')

const GUILDS = FACTIONS.filter((f) => f.kind === 'guild')
const ORIGINAL_LANDINGS = {
  'warriors-guild': '226',
  'wizards-guild': '225',
  'mining-guild': '308',
  'rangers-guild': '515a',
}

test('every guild has exactly one hall on the teleport page, where the original landed it', () => {
  assert.equal(GUILDS.length, 4)
  for (const guild of GUILDS) {
    const halls = TELEPORT_HUBS.filter((hub) => hub.unlockedByMembership === guild.id)
    assert.equal(halls.length, 1, `${guild.id} should have one hall, has ${halls.length}`)
    const [hall] = halls
    assert.equal(hall.roomId, ORIGINAL_LANDINGS[guild.id], `${guild.id} lands in the wrong room`)
    assert.equal(hall.isSubHub, true, `${guild.id}'s hall must sit under a region, not be one`)
    assert.equal(hall.alwaysOpen, false)
    assert.equal(hall.unlockedByKill, null)
    assert.equal(getTeleportHubByMembership(guild.id), hall)
  }
})

test('a hall is nested under the region whose map holds it', () => {
  for (const hub of TELEPORT_HUBS.filter((h) => h.unlockedByMembership)) {
    const region = getWorldRegionForRoom(hub.roomId)
    assert.ok(region, `${hub.roomId} is on no region's map`)
    assert.equal(hub.regionId, region.id, `${hub.name} sits under ${hub.regionId} but is drawn on ${region.id}`)
  }
})

test('unlockedByMembership only ever names a guild faction', () => {
  const guildIds = new Set(GUILDS.map((g) => g.id))
  for (const hub of TELEPORT_HUBS) {
    if (hub.unlockedByMembership) assert.ok(guildIds.has(hub.unlockedByMembership), `${hub.name}: ${hub.unlockedByMembership} is not a guild`)
  }
})

test('a hall opens by membership alone: discovery does not open it, membership does, and it costs the hub price', () => {
  for (const guild of GUILDS) {
    const roomId = ORIGINAL_LANDINGS[guild.id]
    const destination = getTeleportDestination(roomId)
    assert.ok(destination, `${roomId} is not a teleport destination`)
    assert.equal(destination.membershipFactionId, guild.id)
    assert.equal(destination.cost, TELEPORT_MP_COST)
    assert.equal(destination.bossSlug, undefined)

    // The discovery id written for an ordinary sub-hub must not open a hall.
    assert.equal(isTeleportDestinationOpen(destination, [destination.discoveryId, destination.regionId], [], []), false)
    assert.equal(isTeleportDestinationOpen(destination, [], [], []), false)
    assert.equal(isTeleportDestinationOpen(destination, [], [], [guild.id]), true)
    assert.equal(isTeleportDestinationOpen(destination, [], [], new Set([guild.id])), true)
    // Another guild's badge does not open this one.
    const other = GUILDS.find((g) => g.id !== guild.id)
    assert.equal(isTeleportDestinationOpen(destination, [], [], [other.id]), false)
  }
  // Ordinary sub-hubs still open by discovery, untouched.
  const underwater = getTeleportDestination('484')
  assert.equal(underwater.membershipFactionId, null)
  assert.equal(isTeleportDestinationOpen(underwater, ['ocean/underwater'], [], []), true)
  assert.equal(isTeleportDestinationOpen(underwater, [], [], ['warriors-guild']), false)
})

test('memberGuildIds reads membership off the quest rows the way isMember does', () => {
  assert.deepEqual(memberGuildIds([]), [])
  assert.deepEqual(memberGuildIds(null), [])
  const warriors = GUILDS.find((g) => g.id === 'warriors-guild')
  const rangers = GUILDS.find((g) => g.id === 'rangers-guild')
  const rows = [
    { questId: warriors.membershipQuest, completed: true },
    { questId: rangers.membershipQuest, completed: false }, // accepted, not turned in
    { questId: 'quest_unrelated', completed: true },
  ]
  assert.deepEqual(memberGuildIds(rows), ['warriors-guild'])
})

test('the four halls are in the fixed network and announce themselves by region and name', () => {
  for (const guild of GUILDS) {
    const roomId = ORIGINAL_LANDINGS[guild.id]
    const location = TELEPORT_LOCATIONS.find((l) => l.roomId === roomId)
    assert.ok(location, `${roomId} missing from TELEPORT_LOCATIONS`)
    assert.equal(location.membershipFactionId, guild.id)
    const hub = getTeleportHubByRoom(roomId)
    assert.equal(teleportHubLabel(hub), `${hub.regionName}, ${hub.name}`)
    assert.equal(location.name, teleportHubLabel(hub))
  }
  assert.equal(teleportHubLabel(getTeleportHubByRoom('001')), 'Grassy Field')
})
