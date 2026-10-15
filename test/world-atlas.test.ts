/**
 * The World tab's zoomable map: which sheet a region's square shows, which
 * rooms a tap lands on, which landings a sheet carries, and the camera maths
 * that makes zooming from the world into a sheet seamless.
 *
 * Run: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ATLAS_GRID,
  centreOn,
  clampCamera,
  foundLevels,
  landingsOnSheet,
  levelOfSheet,
  neighbourIndex,
  openLandingAt,
  regionTile,
  roomAt,
  roomCell,
  stepZoom,
  tileCamera,
  tileIndexAt,
  worldPointFor,
  zoomCamera,
  type TeleportContext,
} from '../src/lib/world-atlas'

const NONE: TeleportContext = { discoveredTeleports: [], killedSlugs: [], memberships: [] }

test('the grid is the original Map of Vega, Grassy Field in the middle', () => {
  assert.equal(ATLAS_GRID.length, 9)
  assert.equal(ATLAS_GRID[4].id, 'grassy-field')
})

test('a region square shows its surface, or what lies under it, and never an unfound sheet', () => {
  const found = ['red-town', 'red-town-sewers', 'rocky-flats']
  assert.deepEqual(regionTile('red-town', 'surface', found, null), { state: 'open', sheetId: 'red-town' })
  assert.deepEqual(regionTile('red-town', 'below', found, null), { state: 'open', sheetId: 'red-town-sewers' })
  // Rocky Flats has sheets below, none of them found yet.
  assert.deepEqual(regionTile('rocky-flats', 'below', found, null), { state: 'locked' })
  // The Mountains have nothing below at all.
  assert.deepEqual(regionTile('mountains', 'below', ['mountains'], null), { state: 'none' })
  // The Swamp has no sheets: unfound on both layers.
  assert.deepEqual(regionTile('swamp', 'surface', found, null), { state: 'locked' })
})

test('below, a region shows the sheet you stand on, else the nearest one down', () => {
  const found = ['rocky-flats', 'rocky-flats-underground', 'neverending-mine']
  assert.deepEqual(regionTile('rocky-flats', 'below', found, null), { state: 'open', sheetId: 'rocky-flats-underground' })
  assert.deepEqual(regionTile('rocky-flats', 'below', found, 'neverending-mine'), { state: 'open', sheetId: 'neverending-mine' })
  // The tree tops are off the surface but above it: they come after the Despair.
  assert.deepEqual(regionTile('dark-forest', 'below', ['dark-forest-upper', 'the-despair'], null), { state: 'open', sheetId: 'the-despair' })
})

test('a region\'s levels run top to bottom and only list what was found', () => {
  assert.deepEqual(foundLevels('rocky-flats', ['neverending-mine', 'rocky-flats']), ['rocky-flats', 'neverending-mine'])
  assert.deepEqual(foundLevels('dark-forest', ['the-despair', 'dark-forest', 'dark-forest-upper']), ['dark-forest-upper', 'dark-forest', 'the-despair'])
  assert.equal(levelOfSheet('red-town-sewers'), 'below')
  assert.equal(levelOfSheet('lobby'), 'surface')
})

test('a tap on a sheet lands on the room drawn under it', () => {
  // Sewer Crossroads is drawn at (455, 455) on the sewers sheet.
  assert.equal(roomAt('red-town-sewers', 500, 500), '232e')
  assert.equal(roomAt('red-town-sewers', 454, 500), null)
  // The Plane of Rebirth is one room in the middle of its sheet.
  assert.equal(roomAt('lobby', 400, 400), '999')
  // The mine's levels share one picture: the centre is whichever you are in.
  assert.equal(roomAt('neverending-mine', 400, 400, '311-07'), '311-07')
  assert.deepEqual(roomCell('neverending-mine', '311-07', '311-07'), { id: '311-07', x: 350, y: 350 })
  // A room is never placed on a sheet it is not drawn on.
  assert.equal(roomCell('red-town', '232e'), null)
})

test('landings follow the server\'s rule: found hubs, guild halls by membership, beaten bosses', () => {
  assert.equal(openLandingAt('210', NONE), null)
  assert.deepEqual(openLandingAt('210', { ...NONE, discoveredTeleports: ['red-town'] }), {
    roomId: '210',
    kind: 'landing',
    name: 'Grand Square',
    cost: 1,
    guild: false,
  })
  // The Warrior's Guild opens with the membership, not by standing in it.
  assert.equal(openLandingAt('226', { ...NONE, discoveredTeleports: ['red-town/warriors-guild'] }), null)
  assert.equal(openLandingAt('226', { ...NONE, memberships: ['warriors-guild'] })?.guild, true)
  // A boss lair costs the boss's level.
  const thief = openLandingAt('232o', { ...NONE, killedSlugs: ['master-thief'] })
  assert.equal(thief?.kind, 'boss')
  assert.equal(thief?.cost, thief?.level)
  // The Crossroads is always open.
  assert.equal(openLandingAt('001', NONE)?.name, 'Crossroads')
})

test('a sheet carries its open landings, then its beaten lairs', () => {
  const ctx = { discoveredTeleports: ['red-town'], killedSlugs: ['master-thief', 'omar-the-dead'], memberships: ['warriors-guild'] }
  assert.deepEqual(landingsOnSheet('red-town', ctx).map((l) => l.roomId).sort(), ['210', '226'])
  assert.deepEqual(landingsOnSheet('red-town-sewers', ctx).map((l) => l.roomId), ['232o', '232w'])
  assert.deepEqual(landingsOnSheet('red-town-sewers', NONE), [])
})

test('a region square zoomed ×3 is exactly its sheet at ×1', () => {
  for (let index = 0; index < 9; index++) {
    const cam = tileCamera(index)
    // The square's centre lands on the stage's centre…
    const centre = worldPointFor(index, 0.5, 0.5)
    assert.ok(Math.abs((centre.x - 0.5) * cam.z + cam.px) < 1e-9)
    assert.ok(Math.abs((centre.y - 0.5) * cam.z + cam.py) < 1e-9)
    // …and is still inside the clamp, so nothing snaps on the hand-off.
    assert.deepEqual(clampCamera(cam), cam)
    assert.equal(tileIndexAt(centre.x, centre.y), index)
  }
})

test('zooming keeps the focal point still and never shows past the art\'s edge', () => {
  const start = { z: 1, px: 0, py: 0 }
  const focal = { x: 0.8, y: 0.3 }
  const zoomed = zoomCamera(start, 2, focal)
  // Screen offset of the focal point from the stage centre, before and after.
  const before = { x: (focal.x - 0.5) * start.z + start.px, y: (focal.y - 0.5) * start.z + start.py }
  const after = { x: (focal.x - 0.5) * zoomed.z + zoomed.px, y: (focal.y - 0.5) * zoomed.z + zoomed.py }
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9)
  // A corner room cannot be centred: the camera stops at the edge.
  assert.deepEqual(centreOn({ x: 0, y: 0 }, 2), { z: 2, px: 0.5, py: 0.5 })
  assert.deepEqual(clampCamera({ z: 0.5, px: 3, py: -3 }), { z: 1, px: 0, py: 0 })
})

test('zoom steps walk 1 → 1.6 → 2.4 → 3.2 and back from anywhere', () => {
  assert.equal(stepZoom(1, 1), 1.6)
  assert.equal(stepZoom(2, 1), 2.4)
  assert.equal(stepZoom(3.2, 1), 3.2)
  assert.equal(stepZoom(2, -1), 1.6)
  assert.equal(stepZoom(1, -1), 1)
})

test('the arrows walk the 3×3: up from the Grassy Field is the Mountains', () => {
  const at = (id: string) => ATLAS_GRID.findIndex((r) => r.id === id)
  const name = (index: number | null) => (index === null ? null : ATLAS_GRID[index].id)
  assert.equal(name(neighbourIndex(at('grassy-field'), 'up')), 'mountains')
  assert.equal(name(neighbourIndex(at('grassy-field'), 'left')), 'ocean')
  assert.equal(name(neighbourIndex(at('grassy-field'), 'right')), 'forest')
  assert.equal(name(neighbourIndex(at('grassy-field'), 'down')), 'rocky-flats')
  assert.equal(name(neighbourIndex(at('red-town'), 'left')), 'rocky-flats')
  // Past the edge there is nothing.
  assert.equal(neighbourIndex(at('star-city'), 'up'), null)
  assert.equal(neighbourIndex(at('star-city'), 'left'), null)
  assert.equal(neighbourIndex(at('red-town'), 'right'), null)
})
