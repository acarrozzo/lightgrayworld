/**
 * Overheard lines: a free "listen in" action a room offers, answered with one
 * line at random from the room's set. It is how a crowd talks without an NPC
 * to click on — the argument at Todd's about whose tragedy was worse, the
 * faith talk in the Grand Square — and it costs no turn, like reading a sign.
 *
 * Keyed by roomId. A room with no lines has no button: both the server
 * (room-action-handlers.js registers a handler per room here) and the client
 * (room-actions.ts appends the button) read this one table, so they agree.
 *
 * Shared by server and client (CommonJS). Lines are authored text in
 * Anthony's voice; see docs/STORY.md.
 *
 * @typedef {{ action: string, label: string, icon: string, iconColor: string,
 *   title: string, feed: string, lines: string[] }} Overheard
 * @type {Record<string, Overheard>}
 */
const OVERHEARD = {
  // Todd's Pub & Inn — where the natives and the people from Fables argue
  // about who lost more.
  '220': {
    action: 'listen in',
    label: 'Listen In',
    icon: 'bar',
    iconColor: 'red-500',
    title: "You listen in at Todd's",
    feed: "You listen in at Todd's.",
    lines: [
      "\"We lost more.\" \"No we lost more.\" \"You don't know that.\" \"Neither do you.\"",
      "Two men at the bar. One says Vega. The other says Fables. Neither says what happened.",
      "\"At least you got to bury yours.\"",
      "Todd, from behind the bar: \"House rule. Be nice.\"",
      "\"They came by sea, we came by road, we all came to Red Town. Drink.\"",
      "\"I wish i could have did something\"",
      "\"I was on a boat watching it burn behind me. Where were you?\"",
      "Todd puts a bowl of meatballs between two arguing customers.",
      "\"New Babylon.\" \"Red Town.\" \"It's on the gate.\" \"I know what's on the gate.\"",
      "\"I don't argue about it anymore. I just come here.\"",
      "\"The Wanderers don't die right. Don't trust a thing that doesn't die right.\"",
    ],
  },
}

/** Rooms that have something to overhear right now (a non-empty set). */
function listOverheardRooms() {
  return Object.keys(OVERHEARD).filter((roomId) => OVERHEARD[roomId].lines.length > 0)
}

function getOverheard(roomId) {
  const entry = OVERHEARD[roomId]
  return entry && entry.lines.length > 0 ? entry : null
}

/** One line from the room's set, or '' when the room has none. */
function pickOverheard(roomId, rand = Math.random) {
  const entry = getOverheard(roomId)
  if (!entry) return ''
  return entry.lines[Math.floor(rand() * entry.lines.length)] ?? ''
}

module.exports = { OVERHEARD, listOverheardRooms, getOverheard, pickOverheard }
