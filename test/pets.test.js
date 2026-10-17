/**
 * Pets: collectibles with no numbers.
 *
 * Three promises are pinned here. A pet never carries a stat or a roll. Its
 * lines are rare and placed: more likely where the registry names the room or
 * sheet, those lines first, and nothing repeats until the pet has said all it
 * has for the place. And the server half remembers what was said per player,
 * so a walk through the same rooms does not loop the same line.
 *
 * Run: npm test
 */

const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const pets = require(path.join(ROOT, 'src/lib/game-data/pets.js'))
const { getMapIdForRoom } = require(path.join(ROOT, 'src/lib/game-data/world-map.js'))

const bat = pets.getPet('pet-bat')
const hamster = pets.getPet('pet-hampster')

// A fixed sequence of "random" numbers, so a pick is deterministic.
function fixed(values) {
  let i = 0
  return () => values[i++ % values.length]
}

test('the registry: two pets, no stats, each with lines for anywhere', () => {
  assert.equal(pets.PETS.length, 2)
  for (const pet of pets.PETS) {
    assert.equal('statMods' in pet, false)
    assert.equal('damageMin' in pet, false)
    assert.ok(pet.lines.any.length >= 3, `${pet.slug} needs lines for anywhere`)
    assert.ok(pet.icon)
  }
  assert.equal(pets.isPetSlug('pet-bat'), true)
  assert.equal(pets.isPetSlug('elf-ranger'), false)
  assert.equal(pets.isPetMetadata({ pet: true }), true)
  assert.equal(pets.isPetMetadata({ statMods: { str: 1 } }), false)
})

test('placed lines come first, and are more likely, where the pet has them', () => {
  // In the Dwarf Treasury (309) the bat has room lines; the roll 0.2 is under
  // the placed chance (1 in 4) but over the plain one (1 in 8).
  const said = new Set()
  const inTreasury = pets.pickPetLine(bat, { roomId: '309', sheetId: getMapIdForRoom('309') }, said, fixed([0.2, 0]))
  assert.ok(inTreasury)
  assert.equal(inTreasury.placed, true)
  assert.ok(inTreasury.key.startsWith('rooms:309:'))

  // The same roll in a plain field room: silence.
  assert.equal(pets.pickPetLine(bat, { roomId: '001', sheetId: 'grassy-field' }, new Set(), fixed([0.2, 0])), null)
  // A low enough roll speaks anywhere, from the "any" pool.
  const anywhere = pets.pickPetLine(bat, { roomId: '001', sheetId: 'grassy-field' }, new Set(), fixed([0.05, 0]))
  assert.ok(anywhere)
  assert.equal(anywhere.placed, false)
  assert.ok(anywhere.key.startsWith('any:'))
})

test('a line is not said twice until everything the place offers has been said', () => {
  const said = new Set()
  const where = { roomId: '309', sheetId: getMapIdForRoom('309') }
  const pool = pets.linePool(bat, where)
  const total = pool.placed.length + pool.any.length
  const heard = []
  // Always speak, always pick the first unsaid.
  for (let i = 0; i < total; i += 1) {
    const picked = pets.pickPetLine(bat, where, said, fixed([0, 0]))
    assert.ok(picked)
    assert.equal(said.has(picked.key), false, `repeated ${picked.key} before the pool ran out`)
    said.add(picked.key)
    heard.push(picked.key)
  }
  assert.equal(new Set(heard).size, total)
  // Everything said: the slate is wiped and the pet starts over.
  const again = pets.pickPetLine(bat, where, said, fixed([0, 0]))
  assert.ok(again)
  assert.equal(said.size, 0)
})

test('the hamster has something to say at Suzie’s plaza and nothing on the mine sheet', () => {
  const plaza = pets.linePool(hamster, { roomId: '221', sheetId: getMapIdForRoom('221') })
  assert.ok(plaza.placed.some((entry) => entry.key.startsWith('rooms:221:')))
  const mine = pets.linePool(hamster, { roomId: '350', sheetId: 'neverending-mine' })
  assert.equal(mine.placed.length, 0)
})

test('the server half remembers what each player has heard', () => {
  // pet-service touches prisma only for setActivePet; the line picker is pure
  // over its own per-player memory, so it is exercised here without a database.
  const service = require(path.join(ROOT, 'src/lib/game-engine/services/pet-service.js'))
  service.forgetPetLines('p1')
  const first = service.petLineOnArrival('p1', 'pet-bat', '309', fixed([0, 0]))
  const second = service.petLineOnArrival('p1', 'pet-bat', '309', fixed([0, 0]))
  assert.ok(first && second)
  assert.notEqual(first, second)
  // Another player hears the first line fresh.
  service.forgetPetLines('p2')
  assert.equal(service.petLineOnArrival('p2', 'pet-bat', '309', fixed([0, 0])), first)
  // No pet, no line.
  assert.equal(service.petLineOnArrival('p1', null, '309', fixed([0, 0])), null)
  assert.equal(service.petLineOnArrival('p1', 'elf-ranger', '309', fixed([0, 0])), null)
})
