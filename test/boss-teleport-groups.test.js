/**
 * The Bosses ladder laid over the world.
 *
 * The Teleport page draws beaten bosses under a heading per region, in the
 * Regions ladder's order, lowest level first, with a chip naming the sheet
 * when the lair is below the surface. The World Tool's Teleport page uses the
 * same grouping. This pins the shape so neither can drift from the registry.
 *
 * Run: npm test
 */
const test = require('node:test')
const assert = require('node:assert/strict')

const { BOSS_TELEPORTS, groupBossTeleportsByRegion, bossSheetLevel } = require('../src/lib/game-data/teleport-destinations')
const { WORLD_REGIONS, MAP_SHEETS, getWorldRegionForRoom, getMapIdForRoom } = require('../src/lib/game-data/world-map')

test('every boss landing sits on some region\'s sheet, so none falls out of the grouping', () => {
  for (const boss of BOSS_TELEPORTS) {
    assert.ok(getWorldRegionForRoom(boss.roomId), `${boss.name}'s lair ${boss.roomId} is on no region's map`)
  }
  const grouped = groupBossTeleportsByRegion(BOSS_TELEPORTS).flatMap((g) => g.bosses)
  assert.equal(grouped.length, BOSS_TELEPORTS.length)
  assert.deepEqual(new Set(grouped.map((b) => b.slug)), new Set(BOSS_TELEPORTS.map((b) => b.slug)))
})

test('groups run in the world\'s order (by hub room) and only for regions with a kill', () => {
  const worldOrder = WORLD_REGIONS.filter((r) => r.hub)
    .sort((a, b) => Number(a.hub.roomId) - Number(b.hub.roomId))
    .map((r) => r.id)
  const all = groupBossTeleportsByRegion(BOSS_TELEPORTS).map((g) => g.region.id)
  assert.deepEqual(all, worldOrder.filter((id) => all.includes(id)))
  assert.equal(all[0], 'grassy-field')

  // Nine beaten: two early, one in the Mine, one under the ocean.
  const beaten = BOSS_TELEPORTS.filter((b) => ['gator', 'goblin-chief', 'phoenix', 'kraken'].includes(b.slug))
  assert.equal(beaten.length, 4, 'fixture slugs drifted')
  const groups = groupBossTeleportsByRegion(beaten)
  assert.deepEqual(groups.map((g) => g.region.id), ['grassy-field', 'rocky-flats', 'ocean'])
  assert.deepEqual(groups[0].bosses.map((b) => b.slug), ['gator', 'goblin-chief'])
  // No empty groups for regions without a kill.
  assert.ok(groups.every((g) => g.bosses.length > 0))
})

test('within a region: lowest level first; a tie goes to the sheet nearer the surface', () => {
  const sheetIndex = (roomId) => MAP_SHEETS.findIndex((sheet) => sheet.id === getMapIdForRoom(roomId))
  for (const group of groupBossTeleportsByRegion(BOSS_TELEPORTS)) {
    for (let i = 1; i < group.bosses.length; i++) {
      const a = group.bosses[i - 1]
      const b = group.bosses[i]
      const sa = sheetIndex(a.roomId)
      const sb = sheetIndex(b.roomId)
      assert.ok(
        a.level < b.level || (a.level === b.level && (sa < sb || (sa === sb && a.name.localeCompare(b.name) <= 0))),
        `${group.region.id}: ${a.name} before ${b.name}`
      )
    }
  }
  // Anthony's examples. Rocky Flats: the Death Worm (23) above the Axeman
  // (25); Red Beard (30, surface) above Phoenix (30, the Mine).
  const byRegion = new Map(groupBossTeleportsByRegion(BOSS_TELEPORTS).map((g) => [g.region.id, g.bosses.map((b) => b.slug)]))
  assert.deepEqual(byRegion.get('rocky-flats'), ['mongolian-death-worm', 'possessed-axeman', 'red-beard', 'phoenix', 'cyclops', 'minotaur'])
  // Blue Ocean: the Kraken (25, underwater) above the four L35 surface bosses.
  assert.equal(byRegion.get('ocean')[0], 'kraken')
})

test('the sheet chip names the level below the surface and nothing on it', () => {
  assert.equal(bossSheetLevel('013'), null) // Gator, Grassy Field surface
  assert.equal(bossSheetLevel('028i'), 'Underground') // Goblin Chief
  assert.equal(bossSheetLevel('232o'), 'Sewers') // Master Thief
  assert.equal(bossSheetLevel('311-10'), 'Mine') // Phoenix
  assert.equal(bossSheetLevel('499'), 'Underwater') // Kraken
  assert.equal(bossSheetLevel('516h'), 'Upper Level') // Dark Prince
  assert.equal(bossSheetLevel('925'), 'The Despair') // Skeleton King
  assert.equal(bossSheetLevel('625'), null) // Silver Titan, Mountains surface
})
