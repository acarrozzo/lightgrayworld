/**
 * Lair stir lines (5 Nov 2026): what a lair says while its boss is about but
 * has not come out — the NOT HERE state of the room card's boss box ("if I'm
 * in the room and the boss can attack but doesn't attack, display one of those
 * yellow lines"). Every turn spent there on anything but the swing — a rest,
 * a search, a pickaxe, a potion — serves the set's next line, in order from
 * the player's cursor like any spoken line (room-state appendLairStir), pinned
 * in the room's own line slot and written to the feed as a `line` event with
 * its source tag. Attack is the hunt and calls the boss out instead. A
 * defeated boss says nothing: the lair is quiet until it is back.
 *
 * `bySlug` is a boss's own set; `any` is the set for every other lair, with
 * `{name}` filled in. Listed on the World Tool's Lines page as the `stir` set
 * of each lair, spoken by the boss.
 *
 * DRAFTS: every line here is mine, written to Anthony's voice (short, second
 * person, deadpan) for him to rewrite. Canon is docs/STORY.md.
 */
const LAIR_LINES = {
  any: [
    'Something moves in the dark. Big.',
    'You hear the {name} somewhere close.',
    'The {name} is here. It just isn\'t here yet.',
    'A sound you don\'t like. Then nothing.',
    'Whatever lives here knows you\'re standing in it.',
    'Tracks. Fresh ones.',
  ],
  bySlug: {
    gator: [
      'Something slides into the water.',
      'The reeds move. The wind doesn\'t.',
      'A long shape, just under the surface. Then just mud.',
      'Bubbles. Big ones.',
      'The mud is warm where something was lying.',
    ],
    'master-thief': [
      'A coin rolls off a pile. Nobody touched it.',
      'You get the feeling you\'re being counted.',
      'Footsteps on the stairs. Then none.',
      'Half of Red Town is in here. So is he, somewhere.',
    ],
    kraken: [
      'The water goes dark for a moment. Then it doesn\'t.',
      'Something very large is thinking about you.',
      'The wreck shifts. Nothing is pushing it.',
    ],
    'skeleton-king': [
      'Bones, settling. A lot of them.',
      'The throne is empty. It was not empty a moment ago.',
      'Something laughs with no lungs to do it with.',
    ],
  },
}

/** The lines a lair speaks for this boss, with its name filled in. */
function lairStirLines(slug, name) {
  const own = LAIR_LINES.bySlug[slug]
  const set = Array.isArray(own) && own.length > 0 ? own : LAIR_LINES.any
  return set.map((line) => line.replace(/\{name\}/g, name))
}

module.exports = { LAIR_LINES, lairStirLines }
