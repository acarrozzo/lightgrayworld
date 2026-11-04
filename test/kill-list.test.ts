/**
 * The Kill List page model (lib/kill-list.ts) and the roster it is drawn
 * from: every enemy in exactly one of the 27 boxes, boxes revealed by the
 * sheet underfoot or by a kill, the three row states, the filters, and the
 * generated roster being what enemies.js says. Pure functions. Run: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { buildKillList, applyKillView, DEFAULT_KILL_VIEW, AREAS, ROSTER, killRecordNote, KL_TONE_VARS, toneStyle } from '../src/lib/kill-list'

const ROOT = path.join(__dirname, '..')
const { ENEMIES } = require(path.join(ROOT, 'src/lib/game-data/enemies.js'))
const { buildRoster, renderRoster, ROSTER_OUT } = require(path.join(ROOT, 'scripts/generate-bosses.js'))
const { KL_TONES } = require(path.join(ROOT, 'src/lib/game-data/kill-list-areas.js'))

test('roster.generated.js is what enemies.js says it is (run npm run generate-bosses)', () => {
  assert.equal(fs.readFileSync(ROSTER_OUT, 'utf8'), renderRoster(buildRoster(ENEMIES)))
  assert.deepEqual(ROSTER, buildRoster(ENEMIES))
})

test('the original\'s 27 boxes, every enemy in one of them, 26 marked rare', () => {
  assert.equal(AREAS.length, 27)
  const ids = new Set(AREAS.map((a) => a.id))
  for (const enemy of ROSTER) assert.ok(ids.has(enemy.area), `${enemy.slug} is in no box`)
  assert.equal(ROSTER.filter((e) => e.rare).length, 26)
  for (const tone of KL_TONES) assert.ok(KL_TONE_VARS[tone], `tone ${tone} has no token`)
  assert.deepEqual(toneStyle('gold'), { color: 'var(--hue-gold)' })
  assert.equal(toneStyle(undefined), undefined)
})

test('a new character sees the Grassy Field boxes and nothing killed', () => {
  const model = buildKillList({ kills: [], flags: { grassyFieldMap: true }, currentRoomId: '001' })
  assert.deepEqual(model.boxes.map((b) => b.area.id), ['grassy-field', 'spider-cave'])
  assert.equal(model.hidden.length, 25)
  assert.equal(model.total, 0)
  assert.equal(model.killed, 0)
  assert.equal(model.roster, ROSTER.length)
  assert.ok(model.boxes.every((b) => b.rows.every((r) => r.state === 'unknown')))
  assert.ok(model.boxes.every((b) => b.here), 'standing in the field marks its boxes here')
})

test('a kill shows the box even before its sheet is found; a loss or a retreat marks the enemy met', () => {
  const model = buildKillList({
    kills: [{ monster: 'troll', kills: 2 }],
    marks: [{ enemySlug: 'golden-bat', losses: 1, fled: 0 }, { enemySlug: 'scorpion-king', losses: 0, fled: 3 }],
    flags: { grassyFieldMap: true, grassyFieldUndergroundMap: true },
    currentRoomId: null,
  })
  const ids = model.boxes.map((b) => b.area.id)
  assert.ok(ids.includes('dark-forest'), 'the troll\'s box is drawn on the strength of the kill')
  assert.ok(ids.includes('scorpion-pit') && ids.includes('bat-cave'))
  const bat = model.boxes.find((b) => b.area.id === 'bat-cave')!.rows.find((r) => r.enemy.slug === 'golden-bat')!
  assert.equal(bat.state, 'met')
  assert.equal(bat.losses, 1)
  const king = model.boxes.find((b) => b.area.id === 'scorpion-pit')!.rows.find((r) => r.enemy.slug === 'scorpion-king')!
  assert.equal(king.state, 'met')
  assert.equal(king.fled, 3)
  const troll = model.boxes.find((b) => b.area.id === 'dark-forest')!.rows.find((r) => r.enemy.slug === 'troll')!
  assert.equal(troll.state, 'killed')
  assert.equal(model.total, 2)
  assert.equal(model.killed, 1)
})

test('rows sit in level order and a cleared box counts', () => {
  const field = ['rat', 'bunny', 'sand-crab', 'giant-rat', 'gator'].map((monster) => ({ monster, kills: 1 }))
  const model = buildKillList({ kills: field, flags: {}, currentRoomId: null })
  const box = model.boxes.find((b) => b.area.id === 'grassy-field')!
  assert.deepEqual(box.rows.map((r) => r.enemy.level), [...box.rows.map((r) => r.enemy.level)].sort((a, b) => a - b))
  assert.equal(box.cleared, true)
  assert.equal(model.cleared, 1)
  assert.equal(killRecordNote(model), `5 of ${ROSTER.length} on the list · 1 area cleared`)
})

test('the view: unkilled, bosses and rare drop rows, hide cleared drops boxes, here keeps the sheet underfoot', () => {
  const model = buildKillList({
    kills: [{ monster: 'rat', kills: 1 }, { monster: 'bunny', kills: 1 }, { monster: 'sand-crab', kills: 1 }, { monster: 'giant-rat', kills: 1 }, { monster: 'gator', kills: 1 }, { monster: 'bat', kills: 1 }],
    flags: { grassyFieldMap: true, grassyFieldUndergroundMap: true, forestMap: true },
    currentRoomId: '028b',
  })
  const all = applyKillView(model.boxes, DEFAULT_KILL_VIEW)
  assert.equal(all.length, model.boxes.length)

  const unkilled = applyKillView(model.boxes, { ...DEFAULT_KILL_VIEW, filter: 'unkilled' })
  assert.ok(!unkilled.some((b) => b.area.id === 'grassy-field'), 'a cleared box has no unkilled rows')
  assert.ok(unkilled.find((b) => b.area.id === 'bat-cave')!.rows.every((r) => r.state !== 'killed'))

  const bosses = applyKillView(model.boxes, { ...DEFAULT_KILL_VIEW, filter: 'bosses' })
  assert.ok(bosses.every((b) => b.rows.every((r) => r.enemy.rank)))
  assert.deepEqual(bosses.find((b) => b.area.id === 'grassy-field')!.rows.map((r) => r.enemy.slug), ['gator'])

  const rare = applyKillView(model.boxes, { ...DEFAULT_KILL_VIEW, filter: 'rare' })
  assert.ok(rare.every((b) => b.rows.every((r) => r.enemy.rare)))
  assert.deepEqual(rare.find((b) => b.area.id === 'bat-cave')!.rows.map((r) => r.enemy.slug), ['golden-bat'])

  const hidden = applyKillView(model.boxes, { ...DEFAULT_KILL_VIEW, hideCleared: true })
  assert.ok(!hidden.some((b) => b.cleared))

  const here = applyKillView(model.boxes, { ...DEFAULT_KILL_VIEW, hereOnly: true })
  assert.deepEqual(here.map((b) => b.area.id), ['scorpion-pit', 'bat-cave'])
  // The box's own counts are untouched by the row filter.
  assert.equal(bosses.find((b) => b.area.id === 'grassy-field')!.total, 5)
})

test('the Battle Log snapshot: level and XP as columns, the rest as JSON, the closing HP from the last turn', () => {
  const { BattleState } = require(path.join(ROOT, 'src/lib/game-engine/battle-state.js'))
  const enemy = { slug: 'rat', name: 'Rat', hp: 3, level: 1, att: 1, def: 1, description: '' }
  const stats = { level: 2, xp: 9, hp: 14, hpMax: 14, str: 2, def: 1, dex: 1, mag: 1 }
  const state = new BattleState({ playerId: 'p', roomId: '001', enemy, playerStats: stats, gear: { weaponCategory: 'MELEE', loadout: ['Dagger', 'Training Helmet'] } })
  // No turn kept yet: the fight's end is unknown.
  assert.equal(state.logSnapshot().snapshot.hpEnd, null)
  state.recordLedgerTurn({ t: 1, hp: { you: 11, foe: 1 } })
  state.recordLedgerTurn({ t: 2, hp: { you: 5, foe: 0 } })
  // A mid-fight re-read (a potion) does not rewrite how the fight began.
  state.updateStats({ ...stats, hp: 40, level: 3, xp: 99 })
  const cols = state.logSnapshot()
  assert.equal(cols.playerLevel, 2)
  assert.equal(cols.playerXp, 9)
  assert.deepEqual(cols.snapshot, { hp: 14, hpMax: 14, str: 2, def: 1, dex: 1, mag: 1, loadout: ['Dagger', 'Training Helmet'], hpEnd: 5 })
})
