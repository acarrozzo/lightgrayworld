/**
 * Talkers: NPCs who have lines but neither quests nor a shop, so the quest
 * givers' Chat and the shops' keeper button cannot reach them. A gate guard,
 * a hooded man in a tent. Each gets a free talk button in their room that
 * serves their lines in order, pinned in the room box, on the Lines path
 * (game-data/lines.js, set kind `talker`).
 *
 * `sets` is a priority list, like a giver's asides: the first set whose gate
 * is open is the one served. A set with `ifMember` (one faction id, or a list
 * meaning any of them) opens only for a member of that guild; a set with no
 * gate is the default. A talker with one set just has the one.
 *
 * Keyed by roomId. Shared by the server (room-action-handlers.js registers a
 * handler per talker), the client (room-actions.ts draws the button) and the
 * World Tool's Lines page.
 *
 * @typedef {{ ifMember?: string | string[], lines: string[] }} TalkerSet
 * @typedef {{ id: string, name: string, action: string, label: string, sets: TalkerSet[] }} Talker
 * @type {Record<string, Talker>}
 */
const TALKERS = {
  // The Green Guard at the Forest gate: the Grassy Field's own. Proud, no backstory.
  '023': {
    id: 'green_guard',
    name: 'Green Guard',
    action: 'talk to guard',
    label: 'Guard',
    sets: [
      {
        lines: [
          "\"I'm the Green Guard.\"",
          '"One road out, one guard on it. Me."',
          "\"Finish Jack's work. Then the Forest. Them's the rules.\"",
          "\"Red Town's got like 50 guards. We've got me. We're doing fine.\"",
          '"Wanderer? Good. Go help Jack."',
        ],
      },
    ],
  },
  // The Pajama Shaman: nobody knows where he is from and every line is an evasion.
  '021': {
    id: 'pajama_shaman',
    name: 'Pajama Shaman',
    action: 'talk to shaman',
    label: 'Pajama Shaman',
    sets: [
      {
        lines: [
          "\"Don't think to much about it\"",
          '"The pajamas? Comfortable."',
          '"Is that right?"',
          "\"So thats you? Keep it up, you're doing great.\"",
          '"Am I asleep?"',
          '"O right, they gave me a shop. Would you like some uhh... pajamas."',
          '"What a weird vacation."',
        ],
      },
    ],
  },
  // The Dwarf Guard at the Rocky Flats gate: "Badge." until you have one.
  // Drafted lines, not yet rewritten by Anthony (see docs/story/slice-3-lines.md).
  '027': {
    id: 'dwarf_guard',
    name: 'Dwarf Guard',
    action: 'talk to dwarf',
    label: 'Dwarf',
    sets: [
      {
        ifMember: ['warriors-guild', 'wizards-guild'],
        lines: [
          '"Badge. Good. Go on."',
          '"I was in the Village when Frederick put the shield up. Whole sky went gold. Lost four dwarves instead of all of them."',
          "\"Frederick? Don't know where he went. Village says he's still around. Village says a lot of things.\"",
          "\"You've got a badge, so I'll say it: the Flats are safer than this field. Go.\"",
        ],
      },
      {
        lines: [
          '"Badge."',
          '"Flats are south. Badge first."',
          '"Wanderers. Hm. Still need a badge."',
          "\"Captain's orders. Nobody through without a guild. Not since the army came up this road.\"",
        ],
      },
    ],
  },
}

function getTalker(roomId) {
  const t = TALKERS[roomId]
  return t && t.sets.some((s) => s.lines.length > 0) ? t : null
}

/** [roomId, talker] for every talker with lines. */
function listTalkers() {
  return Object.keys(TALKERS)
    .filter((roomId) => getTalker(roomId))
    .map((roomId) => [roomId, TALKERS[roomId]])
}

/**
 * The first set whose gate is open. `isMemberOf(factionId)` answers for the
 * player; a set with no `ifMember` always opens.
 */
async function openTalkerSet(talker, isMemberOf) {
  for (const set of talker.sets) {
    if (!set.ifMember) return set
    const ids = Array.isArray(set.ifMember) ? set.ifMember : [set.ifMember]
    for (const id of ids) {
      if (await isMemberOf(id)) return set
    }
  }
  return null
}

module.exports = { TALKERS, getTalker, listTalkers, openTalkerSet }
