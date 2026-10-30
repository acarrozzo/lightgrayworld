/**
 * The action deck's strike row: what Attack and each power attack can roll,
 * and why one is refused. One set of rules for the battle deck, the Action
 * layer over the compass and the phone sheet, so the same target reads the
 * same in all three. The ranges are raw rolls before the enemy's block.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attackBlockedBy, buildAttackMenu, buildStrikeRow, deckContextFromBattle, deckContextFromRoom, targetFromRoomEnemy, type DeckTarget } from '../src/lib/action-deck'
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

test('in a room that rolls, nothing present is a hunt: Attack and the strikes stay live', () => {
  const c = ctx({ target: null, canHunt: true })
  assert.equal(attackBlockedBy(c), null)
  const row = buildStrikeRow(c)
  assert.ok(row.length >= 1)
  for (const strike of row) {
    assert.equal(strike.reason, null)
    assert.ok(strike.range, 'the range prints against whatever comes out')
  }
  const hunting = deckContextFromRoom(null, player(), [twoHander()], { canHunt: true })
  assert.equal(hunting.situation.hasTarget, false)
  assert.equal(hunting.situation.canHunt, true)
  // A room with no table still has nothing to hit.
  assert.equal(deckContextFromRoom(null, player(), [twoHander()]).situation.canHunt, false)
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

test("in a fight, Attack's range is the weapon's stat, even after a spell turn sent MAG", () => {
  const battle = (over: Record<string, unknown>) =>
    ({ enemyName: 'Squid', enemyDef: 25, enemyTraits: [], playerHp: 663, playerHpMax: 663, bonusPercent: 0, playerStrMax: null, spell: null, ...over }) as any
  const p = player({ mag: 900, strMod: 50 })
  const inv = [twoHander()]
  // A swing or a support turn: the server's top of swing is the weapon's.
  assert.equal(deckContextFromBattle(battle({ playerStrMax: 210 }), p, inv).swingMax, 210)
  // A spell turn: that number is the MAG the spell rolled, so the deck works the weapon's out itself.
  const afterSpell = deckContextFromBattle(battle({ playerStrMax: 900, spell: { id: 'fireball', name: 'Fireball' } }), p, inv)
  assert.equal(afterSpell.swingMax, 143 + 50)
})

test("Explore's Attack menu: the swing, then the strikes, then the attack spells only", () => {
  const p = player({ spells: { fireball: 2, magicMissile: 1, ironSkin: 3, heal: 1 } })
  const inv = [twoHander()]
  const rows = buildAttackMenu({ player: p, inventory: inv, context: deckContextFromRoom({ name: 'Squid', def: 25 }, p, inv) })
  assert.equal(rows[0].kind, 'attack')
  assert.equal(rows[0].weapon, 'Great Axe')
  assert.equal(rows[0].reason, null)
  assert.deepEqual(rows.filter((r) => r.kind === 'strike').map((r) => r.id).sort(), ['magic-strike', 'smash'])
  // Buffs and heals are not attacks: Iron Skin and Heal stay out.
  assert.deepEqual(rows.filter((r) => r.kind === 'spell').map((r) => r.id), ['magic-missile', 'fireball'])
  const fireball = rows.find((r) => r.id === 'fireball')!
  assert.ok(fireball.range && fireball.cost !== null && fireball.cost > 0)
})

test('the Attack menu refuses as the deck does: nothing to hit, and an empty quiver', () => {
  const p = player({ spells: { fireball: 1 } })
  const inv = [twoHander()]
  const empty = buildAttackMenu({ player: p, inventory: inv, context: deckContextFromRoom(null, p, inv) })
  assert.ok(empty.every((r) => r.reason === 'Nothing to hit'))
  // In a room that rolls, everything hunts instead.
  const hunt = buildAttackMenu({ player: p, inventory: inv, context: deckContextFromRoom(null, p, inv, { canHunt: true }) })
  assert.ok(hunt.every((r) => r.reason === null))

  const bow = {
    id: 'b1', quantity: 1, isEquipped: true, slot: 'MAIN_HAND',
    template: { slug: 'hunting-bow', name: 'Hunting Bow', type: 'WEAPON', weaponCategory: 'RANGED', metadata: { ammo: 'arrow' } },
  } as any
  const quiverless = buildAttackMenu({ player: p, inventory: [bow], context: deckContextFromRoom({ name: 'Squid', def: 25 }, p, [bow]) })
  assert.equal(quiverless[0].reason, 'No arrow')
  assert.equal(quiverless[0].range, null)
  // A spell needs no arrows.
  assert.equal(quiverless.find((r) => r.id === 'fireball')?.reason, null)
})
