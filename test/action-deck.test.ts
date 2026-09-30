/**
 * The action deck's strike row: what Attack and each power attack can roll,
 * and why one is refused. One set of rules for the battle deck, the Action
 * layer over the compass and the phone sheet, so the same target reads the
 * same in all three. The ranges are raw rolls before the enemy's block.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attackBlockedBy, buildStrikeRow, deckContextFromRoom, targetFromRoomEnemy, type DeckTarget } from '../src/lib/action-deck'
import { SKILLS } from '../src/lib/skillbook'

const smash = (SKILLS as Array<{ id: string; column: string; weapon?: string }>).find((s) => s.id === 'smash')!
const magicStrike = (SKILLS as Array<{ id: string; column: string; magic?: boolean }>).find((s) => s.id === 'magic-strike')!

function twoHander(slug = 'great-axe') {
  return {
    id: 'w1',
    quantity: 1,
    isEquipped: true,
    slot: 'MAIN_HAND',
    template: { slug, name: 'Great Axe', type: 'WEAPON', weaponCategory: 'MELEE', metadata: { isTwoHanded: true, statMods: { str: 50 } } },
  } as any
}

function player(over: Record<string, unknown> = {}) {
  return {
    level: 28, str: 143, dex: 10, mag: 7, def: 95, strMod: 0, dexMod: 0, magMod: 0, defMod: 0,
    hp: 663, hpMax: 663, mp: 100, mpMax: 159, buffs: {},
    skills: { [smash.column]: 2, [magicStrike.column]: 1 },
    spells: {},
    ...over,
  } as any
}

const squid: DeckTarget = { name: 'Squid', def: 25, flying: false, immuneMelee: false, immuneRanged: false, immuneMagic: false }

function ctx(over: Partial<Parameters<typeof buildStrikeRow>[0]> = {}) {
  const p = player()
  return { player: p, inventory: [twoHander()], isRanged: false, swingMax: 193, groupScale: 1, playerMp: 100, inBattle: false, target: squid, ...over }
}

test('with nothing in the room, Attack and every strike say so', () => {
  const c = ctx({ target: null })
  assert.equal(attackBlockedBy(c), 'Nothing to hit')
  const row = buildStrikeRow(c)
  assert.ok(row.length >= 1, 'a two-hander carries Smash')
  for (const strike of row) {
    assert.equal(strike.reason, 'Nothing to hit')
    assert.equal(strike.range, null)
  }
})

test('a strike adds its bonus on top of the swing, and prints the total', () => {
  const row = buildStrikeRow(ctx())
  const entry = row.find((s) => s.entry.def.id === 'smash')!
  assert.equal(entry.reason, null)
  assert.ok(entry.range)
  assert.equal(entry.range.lo, entry.entry.preview!.min)
  assert.equal(entry.range.hi, 193 + entry.entry.preview!.max)
})

test('a flyer is out of reach for a grounded melee swing, and for the strikes', () => {
  const bat = { ...squid, name: 'Bat', flying: true }
  const c = ctx({ target: bat })
  assert.equal(attackBlockedBy(c), "Can't reach")
  assert.ok(buildStrikeRow(c).every((s) => s.reason === "Can't reach" && s.range === null))
  // A bow reaches it.
  assert.equal(attackBlockedBy({ ...c, isRanged: true }), null)
})

test('weapon immunity refuses the swing; magic immunity only fizzles the magic strike', () => {
  const stone = { ...squid, name: 'Stone Sphinx', immuneMelee: true }
  assert.equal(attackBlockedBy(ctx({ target: stone })), "Can't hurt it")
  const golden = { ...squid, name: 'Golden Bat', immuneMagic: true }
  const row = buildStrikeRow(ctx({ target: golden }))
  const magic = row.find((s) => s.entry.def.id === 'magic-strike')
  const plain = row.find((s) => s.entry.def.id === 'smash')
  assert.equal(magic?.reason, 'Magic fizzles')
  assert.equal(plain?.reason, null)
})

test('short on MP dims the strike but leaves its range readable', () => {
  const row = buildStrikeRow(ctx({ playerMp: 0 }))
  const entry = row.find((s) => s.entry.def.id === 'smash')!
  assert.equal(entry.reason, 'Not enough MP')
  assert.ok(entry.range, 'the range still prints; only the cost line becomes the reason')
})

test("the room's enemy becomes the deck's target with its flags", () => {
  assert.equal(targetFromRoomEnemy(null), null)
  const t = targetFromRoomEnemy({ name: 'Albatross', def: 15, isFlying: true, isMagicImmune: false })
  assert.deepEqual(t, { name: 'Albatross', def: 15, flying: true, immuneMelee: false, immuneRanged: false, immuneMagic: false })
  const c = deckContextFromRoom({ name: 'Squid', def: 25 }, player(), [twoHander()])
  assert.equal(c.situation.inBattle, false)
  assert.equal(c.situation.hasTarget, true)
  assert.equal(c.groupScale, 1)
  assert.ok(c.swingMax > 0)
})
