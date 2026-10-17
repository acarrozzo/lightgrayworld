/**
 * Pets: the small creatures a player collects and carries for the company.
 *
 * The original had two (Little Suzie's hamster, the Dwarf Treasury's bat) and
 * half-wrote a third (the Snow Owl's chick). They swung for 0–2 and 0–3 in a
 * fight, a smaller version of the companion slot. Companions came out of the
 * game in October 2026 and pets came back the other way round: a pet is a
 * story you carry, never a number. It cannot swing, block, carry, find or
 * buff. What it can do is be seen, be remembered, and talk.
 *
 * This module is the authored half, plain CommonJS so the server, the client
 * and the World Tool read the same table:
 *   - a pet is an ordinary bag item (`metadata.pet`), granted by its source
 *     like any other reward, never sold and never dropped;
 *   - one pet is "along" at a time: `User.activePet` holds its slug, set from
 *     the bag with "Take along" and cleared with "Leave home", free and never
 *     a turn;
 *   - lines are rare and placed. On arrival in a room the pet may say one
 *     line, in the feed only. A room or map sheet the registry names for that
 *     pet is where it has something to say, so those are more likely and come
 *     first. A line is not said again until the pet has said all its others.
 *
 * Where the pet is shown (a small icon beside the player's name, the room's
 * player cards, the profile) is the client's; what it says is here.
 *
 * Sheet ids are world-map.js map sheets (`getMapIdForRoom`); room ids are
 * room ids. `pickPetLine` is pure and takes its randomness as an argument.
 */

/** Chance to speak on an ordinary arrival: about one room in eight. */
const PET_LINE_CHANCE = 1 / 8
/** Chance to speak on arrival somewhere the pet has a placed line: one in four. */
const PLACED_LINE_CHANCE = 1 / 4

const PETS = [
  {
    slug: 'pet-hampster',
    name: 'Pet Hampster',
    icon: 'enemy-Rat',
    description:
      "Little Suzie's hamster, spelled the way she spells it. It decided it liked your pocket better than her shoebox.",
    source: { kind: 'quest', questId: 'quest_townhallplaza_003', roomId: '221', text: "Little Suzie, with the Stolen Teddy Bear" },
    lines: {
      any: [
        'The hamster climbs out of your pocket, looks around, and climbs back in.',
        'The hamster is asleep. It has been asleep for most of this.',
        'Something is chewing on the inside of your pocket.',
        'The hamster stuffs its cheeks with nothing in particular and looks pleased.',
        'The hamster sits up on your shoulder for exactly as long as it takes you to notice.',
        'The hamster has found a crumb from somewhere. It is not sharing.',
      ],
      sheets: {
        'red-town': [
          'The hamster perks up. It knows these streets.',
          'The hamster looks toward the plaza, then at you, then goes back to sleep.',
        ],
        'red-town-sewers': [
          'The hamster has strong opinions about the smell and no way to express them.',
          'The hamster climbs as high up your collar as it can get.',
        ],
        'grassy-field': [
          'The hamster sniffs the grass with great seriousness.',
          'The hamster seems to think the whole field is for it.',
        ],
        'ocean': [
          'The hamster has never seen this much water and would like to go home now.',
        ],
        'ocean-underwater': [
          'The hamster is holding its breath. It did not need to. It does not know that.',
        ],
        'mountains': [
          'The hamster has gone deep into your coat and is not coming out until spring.',
        ],
        'the-despair': [
          'The hamster is very still. You can feel its heart going.',
        ],
      },
      rooms: {
        '221': [
          'Suzie waves at the hamster. The hamster, to its credit, waves back.',
          "The hamster looks at Suzie's window for a long moment.",
        ],
      },
    },
  },
  {
    slug: 'pet-bat',
    name: 'Pet Bat',
    icon: 'enemy-Bat',
    description:
      'It was living in the Dwarf Treasury gold chest, which explains the state of the gold. It hangs off your pack and resents the daytime.',
    source: { kind: 'chest', roomId: '309', text: "The Dwarf Treasury's gold chest" },
    lines: {
      any: [
        'The bat hangs off your pack with its wings over its face and complains.',
        'The bat shifts, resettles, and goes back to pretending it is not here.',
        'The bat clicks at something you cannot see. Then at nothing. Then at you.',
        'The bat has turned the right way up, which it only does when it is worried.',
        'The bat yawns. Its mouth is mostly teeth.',
        'The bat unfolds one wing, checks it, and folds it away again.',
      ],
      sheets: {
        'neverending-mine': [
          'The bat perks up. This is more like it.',
          'The bat drops off your pack, loops the shaft once, and lands back where it was.',
        ],
        'rocky-flats-underground': [
          'The bat is awake, alert, and almost cheerful. You did not know it could be cheerful.',
        ],
        'grassy-field-underground': [
          'The bat approves of the dark down here, if not of the company.',
        ],
        'forest-underground': [
          'The bat clicks into the dark and listens to what comes back. It does not like what comes back.',
        ],
        'red-town-sewers': [
          'The bat is in its element. The element is terrible.',
        ],
        'dark-forest': [
          'The bat is quiet here. Something bigger than it lives in these trees.',
        ],
        'dark-forest-upper': [
          'The bat looks down through the branches and clings a little tighter.',
        ],
        'mountains': [
          'The bat is in a ball at the bottom of your pack, radiating resentment.',
        ],
        'ocean-underwater': [
          'The bat has concluded that this is a mistake and is waiting for you to agree.',
        ],
        'the-despair': [
          'The bat is awake and silent, which is worse than the complaining.',
        ],
      },
      rooms: {
        '309': [
          'The bat looks at the gold chest the way you might look at an old flat.',
          'The bat drops into the empty chest, turns around once, and climbs back out, unimpressed.',
        ],
      },
    },
  },
]

const BY_SLUG = new Map(PETS.map((pet) => [pet.slug, pet]))

function getPet(slug) {
  return (slug && BY_SLUG.get(slug)) || null
}

function isPetSlug(slug) {
  return BY_SLUG.has(slug)
}

/** True for an item template's metadata that marks it as a pet. */
function isPetMetadata(metadata) {
  return Boolean(metadata && typeof metadata === 'object' && metadata.pet)
}

/**
 * The pet's lines for a place, keyed so a "said" set can remember them:
 * `rooms:<roomId>:<n>`, `sheets:<sheetId>:<n>`, `any:<n>`.
 */
function linePool(pet, { roomId = null, sheetId = null } = {}) {
  const placed = []
  const roomLines = roomId ? pet.lines.rooms?.[roomId] : null
  if (Array.isArray(roomLines)) roomLines.forEach((line, i) => placed.push({ key: `rooms:${roomId}:${i}`, line }))
  const sheetLines = sheetId ? pet.lines.sheets?.[sheetId] : null
  if (Array.isArray(sheetLines)) sheetLines.forEach((line, i) => placed.push({ key: `sheets:${sheetId}:${i}`, line }))
  const any = (pet.lines.any || []).map((line, i) => ({ key: `any:${i}`, line }))
  return { placed, any }
}

/**
 * What the pet says on arriving in a room, or null when it keeps quiet.
 *
 * `said` is the set of line keys already spoken to this player; the caller
 * owns it and adds the returned key. When every line the place could offer
 * has been said, the slate is wiped (the set is cleared) and the pet starts
 * over. `rand` returns [0, 1).
 */
function pickPetLine(pet, where = {}, said = new Set(), rand = Math.random) {
  if (!pet) return null
  const pool = linePool(pet, where)
  let placed = pool.placed.filter((entry) => !said.has(entry.key))
  let any = pool.any.filter((entry) => !said.has(entry.key))
  if (placed.length === 0 && any.length === 0) {
    said.clear()
    placed = pool.placed
    any = pool.any
  }
  if (placed.length === 0 && any.length === 0) return null

  const chance = placed.length > 0 ? PLACED_LINE_CHANCE : PET_LINE_CHANCE
  if (rand() >= chance) return null

  const from = placed.length > 0 ? placed : any
  const entry = from[Math.floor(rand() * from.length)]
  return { key: entry.key, line: entry.line, placed: placed.length > 0 }
}

module.exports = {
  PETS,
  PET_LINE_CHANCE,
  PLACED_LINE_CHANCE,
  getPet,
  isPetSlug,
  isPetMetadata,
  linePool,
  pickPetLine,
}
