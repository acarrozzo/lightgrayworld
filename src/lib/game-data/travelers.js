/**
 * Travelers: the NPCs and creatures that move between rooms.
 *
 * The original game had nobody who walked. Every NPC stood in one room for
 * ever, and the only things that came and went were enemies. Travelers are a
 * modern addition beside that: a bunny that hops the Grassy Field, Sherman who
 * paces it because he is scared of everything past its edge, and Wendell, a
 * merchant who loops out through the Forest to Red Town and back through the
 * Rocky Flats.
 *
 * This module is the authored half — who they are, where they may go, how fast,
 * what they say — and it is plain CommonJS so the server, the client and the
 * World Tool read the same table. Where they ARE right now is answered by
 * game-engine/traveler-state.js; the exception is a `route` traveler, whose
 * position is a pure function of the clock (`routePositionAt`) and needs no
 * state at all. That is deliberate: a shop on wheels must give the same answer
 * to the socket server and to the buy route, on any instance, after a restart.
 *
 * Two movement kinds:
 *   wander — picks an adjacent room from `rooms` every `everyMs` (a [min, max]
 *            range). Live, process-local, forgotten on restart. For creatures
 *            and flavour NPCs where a reset costs nothing.
 *   route  — walks `stops` in order and loops, dwelling `dwellMs` at each. The
 *            loop is anchored to the UTC epoch, so every process agrees.
 *
 * Presence is shared: everyone in the room sees the same traveler. Fighting
 * one (a traveler with `enemySlug`) is still per player, through the ordinary
 * battle state; killing it is what makes it leave for everyone.
 */

// The open field the bunny and Sherman keep to, and how its rooms join. Kept
// here rather than read from the database so a move can be decided and
// described ("hops in from the west") without a query. Mirrors the seed.
const FIELD_EXITS = {
  '001': { north: '005', south: '002', east: '006', west: '004' },
  '002': { north: '001', northeast: '006', northwest: '004' },
  '004': { east: '001', northeast: '005', southeast: '002' },
  '005': { south: '001', southeast: '006', southwest: '004' },
  '006': { west: '001', northwest: '005', southwest: '002' },
}

const OPPOSITE = {
  north: 'south', south: 'north', east: 'west', west: 'east',
  northeast: 'southwest', southwest: 'northeast', northwest: 'southeast', southeast: 'northwest',
  up: 'down', down: 'up',
}

const MINUTE = 60 * 1000

// Wendell's loop. Out the east road through the Forest to Red Town's Grand
// Square, back out the Grand Gate and home through the Rocky Flats. `via` is
// the exit he takes INTO that stop, for the arrival line. Two-minute stops on
// the road, five at either end: a little under an hour round.
const ROAD = 2 * MINUTE
const REST = 5 * MINUTE
const MERCHANT_STOPS = [
  { roomId: '001', via: 'north', dwellMs: REST, region: 'grassyField' },
  { roomId: '006', via: 'east', dwellMs: ROAD, region: 'grassyField' },
  { roomId: '022', via: 'east', dwellMs: ROAD, region: 'grassyField' },
  { roomId: '023', via: 'east', dwellMs: ROAD, region: 'grassyField' },
  { roomId: '101', via: 'east', dwellMs: ROAD, region: 'forest' },
  { roomId: '102', via: 'southeast', dwellMs: ROAD, region: 'forest' },
  { roomId: '104', via: 'east', dwellMs: ROAD, region: 'forest' },
  { roomId: '106', via: 'south', dwellMs: ROAD, region: 'forest' },
  { roomId: '107', via: 'south', dwellMs: ROAD, region: 'forest' },
  { roomId: '201', via: 'south', dwellMs: ROAD, region: 'redTown' },
  { roomId: '203', via: 'southwest', dwellMs: ROAD, region: 'redTown' },
  { roomId: '202', via: 'south', dwellMs: ROAD, region: 'redTown' },
  { roomId: '204', via: 'south', dwellMs: ROAD, region: 'redTown' },
  { roomId: '209', via: 'east', dwellMs: ROAD, region: 'redTown' },
  { roomId: '210', via: 'east', dwellMs: REST, region: 'redTown' },
  { roomId: '209', via: 'west', dwellMs: ROAD, region: 'redTown' },
  { roomId: '204', via: 'west', dwellMs: ROAD, region: 'redTown' },
  { roomId: '205', via: 'west', dwellMs: ROAD, region: 'redTown' },
  { roomId: '301', via: 'west', dwellMs: ROAD, region: 'rockyFlats' },
  { roomId: '306', via: 'northwest', dwellMs: ROAD, region: 'rockyFlats' },
  { roomId: '303', via: 'west', dwellMs: ROAD, region: 'rockyFlats' },
  { roomId: '304', via: 'northwest', dwellMs: ROAD, region: 'rockyFlats' },
  { roomId: '305', via: 'north', dwellMs: ROAD, region: 'rockyFlats' },
  { roomId: '027', via: 'north', dwellMs: ROAD, region: 'grassyField' },
  { roomId: '026', via: 'north', dwellMs: ROAD, region: 'grassyField' },
  { roomId: '002', via: 'north', dwellMs: ROAD, region: 'grassyField' },
]

const TRAVELERS = [
  {
    id: 'bunny',
    kind: 'creature',
    name: 'Bunny',
    article: 'a',
    description: 'A small brown bunny working its way through the grass one mouthful at a time. It has not noticed you, or does not care.',
    icon: 'enemy-Bunny',
    iconFile: '/icons/enemy/Bunny.svg',
    // Attacking it goes through the ordinary battle path against this enemy
    // (game-data/enemies.js). A kill despawns the shared bunny for `respawnMs`.
    enemySlug: 'bunny',
    respawnMs: 5 * MINUTE,
    movement: { type: 'wander', rooms: Object.keys(FIELD_EXITS), everyMs: [1 * MINUTE, 2 * MINUTE] },
    actions: [
      { action: 'watch bunny', label: 'Watch', icon: 'enemy-Bunny' },
      { action: 'catch bunny', label: 'Catch', icon: 'enemy-Bunny' },
    ],
    // Trying to catch it: most of the time it bolts into the next room (a real
    // move, everyone sees it go); sometimes it just hops out of reach and stays.
    catchBoltChance: 0.7,
    lines: {
      arrive: [
        'A bunny hops in from the {from}.',
        'A bunny comes bounding in from the {from} and stops dead, nose twitching.',
        'Something small rustles in from the {from}. A bunny.',
      ],
      leave: [
        'The bunny hops off to the {to}.',
        'The bunny bolts to the {to} for no reason you can see.',
      ],
      respawn: [
        'A bunny pokes its head out of the tall grass.',
        'A bunny hops out from under a bush, as if nothing ever happened.',
      ],
      gone: ['The bunny is gone.'],
      // First person, to the one who lunged. {to} is the exit it took.
      catchMiss: [
        'You lunge. The bunny is gone to the {to} before your hands close on grass.',
        'You creep up, you pounce, you get a mouthful of field. The bunny bolts {to}.',
        'You almost have it. Almost. It kicks off your palm and streaks off to the {to}.',
      ],
      // First person, when it dodges but does not leave.
      catchStay: [
        'You grab. The bunny hops exactly one bunny-length to the left and looks at you.',
        'You dive. The bunny is not where you dove. It is behind you, chewing.',
        'You close your hands on nothing. The bunny has moved a foot and is unimpressed.',
      ],
      // What the room sees when it bolts. Neutral, so it reads right for the
      // lunger and the bystanders alike.
      startle: [
        'The bunny startles and bolts to the {to}.',
        'Something spooks the bunny. It is gone to the {to} in two hops.',
      ],
      watch: [
        'The bunny nibbles a blade of grass, then another, then the same one again.',
        'The bunny freezes, stares straight through you for a long moment, and goes back to eating.',
        'The bunny scratches behind one ear with a back foot and nearly falls over.',
        'The bunny hops exactly one hop, sits, and reconsiders.',
        'The bunny nibbles. The grass does not seem to mind.',
      ],
    },
  },
  {
    id: 'sherman',
    kind: 'npc',
    name: 'Sherman',
    spokenName: 'Sherman',
    description: 'A young man in a coat two sizes too big, standing very still in the way people do when they hope nothing will notice them. He has never once left the Grassy Field.',
    icon: 'npc-sherman',
    iconFile: '/icons/npc/npc-sherman.svg',
    movement: { type: 'wander', rooms: Object.keys(FIELD_EXITS), everyMs: [3 * MINUTE, 6 * MINUTE] },
    // A fight starting in his room is more than he can take: he is gone
    // within seconds (traveler-state.onBattleStarted).
    fleesFights: true,
    fleeDelayMs: [4 * 1000, 12 * 1000],
    actions: [{ action: 'talk to sherman', label: 'Talk', icon: 'npc-sherman' }],
    lines: {
      arrive: [
        'Sherman edges in from the {from}, glancing over his shoulder.',
        'Sherman comes in from the {from}, walking the way you walk past a dog you do not trust.',
      ],
      leave: [
        'Sherman hurries off to the {to}, muttering.',
        'Sherman decides the {to} looks marginally safer and goes.',
      ],
      flee: [
        'Sherman sees the fight start and is gone to the {to} before you can blink.',
        'Sherman makes a small noise and bolts {to}.',
      ],
      // What he says depends on where you catch him. The generic lines fill in
      // when a room has nothing of its own.
      talk: {
        '001': [
          '"The crossroads. Eight ways out. Eight ways for something to come IN." He counts them again to be sure.',
          '"That chest. Have you seen anyone open it? What if something\'s living in it?"',
        ],
        '002': [
          '"The berries are fine. The berries are FINE. It\'s the cave to the east I don\'t like. Things come out of caves."',
          '"There\'s a path south into rocks. Rocks. Do you know what lives in rocks? Neither do I. That\'s the problem."',
        ],
        '004': [
          '"The road west goes to the sea. I heard the sea is mostly water. I don\'t swim." He looks at the horizon like it owes him money.',
          '"Someone said there are dunes past the old man\'s cabin. Sand gets in everything. Everything."',
        ],
        '005': [
          '"There\'s a shaman to the east who sells pajamas. Why pajamas? What does he KNOW?"',
          '"I don\'t go north. There\'s an angel up there. Angels only show up when something\'s about to happen."',
        ],
        '006': [
          '"That\'s the road to the forest. I\'ve heard the forest has trees in it. Big ones. I\'m fine here, thanks."',
          '"A shop, a soldier, a road out. Three things to worry about and I haven\'t even started on the sky."',
        ],
        default: [
          '"Oh! Oh, it\'s you. It\'s a person. Good. People are fine. Mostly." He does not look convinced.',
          '"I don\'t leave the field. I\'ve thought about it. I\'ve thought about it a LOT. And then I don\'t."',
          '"Did you hear that? ... No? Me neither. That\'s what worries me."',
          '"You go out there and fight things? On purpose?" He takes a small step back.',
          '"I had a plan to visit Red Town once. I got as far as thinking about the road."',
        ],
      },
    },
  },
  {
    id: 'merchant',
    kind: 'npc',
    name: 'Wendell',
    title: 'the Wandering Merchant',
    spokenName: 'Wendell',
    description: 'A weathered merchant with a handcart that has been repaired more times than it has been built. He walks the loop from the Grassy Field to Red Town and back, and he will sell to you anywhere on it.',
    icon: 'npc-merchant',
    iconFile: '/icons/npc/npc-merchant.svg',
    movement: { type: 'route', stops: MERCHANT_STOPS },
    actions: [
      { action: 'talk to wendell', label: 'Talk', icon: 'npc-merchant' },
      { action: 'trade with wendell', label: 'Trade', icon: 'basicshop', className: 'fill-mood-treasure' },
    ],
    // The cart. Travel goods everywhere, plus one or two odd wares picked up
    // from wherever he is standing. Prices come from ItemTemplate.value like
    // every other shop (see shops.js); this only says what is on the cart.
    shop: {
      name: "Wendell's Cart",
      stock: ['red-potion', 'blue-potion', 'arrow', 'bread', 'cooked-meat', 'string'],
      extraByRegion: {
        grassyField: ['coffee'],
        forest: ['wood'],
        redTown: ['veggies', 'meatball'],
        rockyFlats: ['stone', 'coal'],
      },
    },
    lines: {
      arrive: [
        'Wendell the Wandering Merchant trundles in from the {from}, cart creaking.',
        'A handcart with one squeaking wheel comes in from the {from}. Wendell is behind it.',
      ],
      leave: [
        'Wendell packs up the cart and heads {to}.',
        'Wendell tips his hat and trundles off to the {to}.',
      ],
      talk: {
        toward: {
          '210': [
            '"Red Town next. Good customers, bad roads. Need anything before I go?"',
            '"Heading east through the Forest, then down to the Square. Same as every time. The wheel\'ll hold. Probably."',
          ],
          '001': [
            '"Homeward through the Flats. The Grassy Field\'s the only place nobody\'s tried to sell ME anything."',
            '"Back to the Crossroads. Long way round through the rocks, but the Forest\'s worse with a full cart."',
          ],
        },
        default: [
          '"Everything on the cart\'s for sale. Everything on ME is not, so don\'t ask about the hat."',
          '"You buy, I sell. You sell, I buy. Simplest arrangement in the world and people still find ways to complicate it."',
        ],
      },
    },
  },
]

const BY_ID = new Map(TRAVELERS.map((t) => [t.id, t]))
const BY_ENEMY_SLUG = new Map(TRAVELERS.filter((t) => t.enemySlug).map((t) => [t.enemySlug, t]))

function getTraveler(id) {
  return BY_ID.get(id) || null
}

function getTravelerByEnemySlug(slug) {
  return BY_ENEMY_SLUG.get(slug) || null
}

/** The traveler that owns an action name ("talk to sherman"), or null. */
function getTravelerByAction(action) {
  const wanted = String(action || '').toLowerCase().trim()
  return TRAVELERS.find((t) => t.actions.some((a) => a.action === wanted)) || null
}

/** Exits a wanderer may take out of `roomId`, restricted to its own rooms. */
function wanderExits(traveler, roomId) {
  const allowed = new Set(traveler.movement.rooms)
  return Object.entries(FIELD_EXITS[roomId] || {})
    .filter(([, to]) => allowed.has(to))
    .map(([direction, to]) => ({ direction, to }))
}

function oppositeDirection(direction) {
  return OPPOSITE[direction] || direction
}

/** Total period of a route traveler's loop. */
function routePeriodMs(traveler) {
  return traveler.movement.stops.reduce((sum, stop) => sum + stop.dwellMs, 0)
}

/**
 * Where a route traveler is at `now`, from the clock alone.
 * Returns { index, stop, arrivedAt, leavesAt, next } — `next` is the stop after.
 */
function routePositionAt(traveler, now = Date.now()) {
  const stops = traveler.movement.stops
  const period = routePeriodMs(traveler)
  const cycleStart = now - (((now % period) + period) % period)
  let cursor = cycleStart
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index]
    if (now < cursor + stop.dwellMs) {
      return {
        index,
        stop,
        arrivedAt: cursor,
        leavesAt: cursor + stop.dwellMs,
        next: stops[(index + 1) % stops.length],
      }
    }
    cursor += stop.dwellMs
  }
  // Unreachable: the loop above covers the whole period.
  return { index: 0, stop: stops[0], arrivedAt: cycleStart, leavesAt: cycleStart + stops[0].dwellMs, next: stops[1 % stops.length] }
}

/** The room a route traveler is in at `now`. */
function routeRoomAt(traveler, now = Date.now()) {
  return routePositionAt(traveler, now).stop.roomId
}

/**
 * The stock on a traveling shop at a given stop: the always-carried goods plus
 * the region's odd wares. Order is display order.
 */
function travelerStockAt(traveler, roomId) {
  if (!traveler?.shop) return []
  const stop = traveler.movement.type === 'route'
    ? traveler.movement.stops.find((s) => s.roomId === roomId)
    : null
  const extra = stop ? traveler.shop.extraByRegion?.[stop.region] || [] : []
  return [...traveler.shop.stock, ...extra.filter((slug) => !traveler.shop.stock.includes(slug))]
}

/**
 * When a route traveler next reaches `roomId`, from the clock. Returns
 * { here: true, leavesAt } while standing there, { here: false, arrivesAt }
 * otherwise, or null if the room is not on the route. What a sign can promise.
 */
function routeNextArrivalAt(traveler, roomId, now = Date.now()) {
  const stops = traveler.movement.stops
  if (!stops.some((s) => s.roomId === roomId)) return null
  const position = routePositionAt(traveler, now)
  if (position.stop.roomId === roomId) return { here: true, leavesAt: position.leavesAt }
  let cursor = position.leavesAt
  for (let step = 1; step <= stops.length; step += 1) {
    const stop = stops[(position.index + step) % stops.length]
    if (stop.roomId === roomId) return { here: false, arrivesAt: cursor }
    cursor += stop.dwellMs
  }
  return null
}

/** Which of the two ends a route traveler is heading for — the next REST stop. */
function routeHeadingTo(traveler, now = Date.now()) {
  const { index } = routePositionAt(traveler, now)
  const stops = traveler.movement.stops
  for (let step = 1; step <= stops.length; step += 1) {
    const stop = stops[(index + step) % stops.length]
    if (stop.dwellMs === REST) return stop.roomId
  }
  return stops[0].roomId
}

function pickLine(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return ''
  return lines[Math.floor(Math.random() * lines.length)]
}

module.exports = {
  TRAVELERS,
  FIELD_EXITS,
  MERCHANT_STOPS,
  getTraveler,
  getTravelerByEnemySlug,
  getTravelerByAction,
  wanderExits,
  oppositeDirection,
  routePeriodMs,
  routePositionAt,
  routeRoomAt,
  routeHeadingTo,
  routeNextArrivalAt,
  travelerStockAt,
  pickLine,
}
