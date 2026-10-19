/**
 * Lines: the one system by which the world speaks outside the quest flow.
 *
 * A line is one short spoken sentence from a set, served in order one press
 * at a time (game-engine/line-cursor-state.js keeps each player's place),
 * shown in yellow italic in the room box (until the next line or the next
 * room) and written to the world feed as a `line` event with its speaker and
 * a source tag. It never costs a turn. Three kinds of set feed it:
 *
 *   keeper   shops.js `keeper.lines`        — a shopkeeper's talk button
 *   listen   overheard.js `lines`           — a room's "listen in" button
 *   talker   talkers.js `sets`              — an NPC with no quest and no shop
 *   idle /   quest-givers.json `idleDialogs` — a quest giver's Chat button,
 *   aside    and `asides`                     the same sets Talk draws on
 *
 * The source tag `<roomId> · <speaker> · <set> #<n>` names the data row a
 * line came from, so a line read in the feed can be found and edited. The
 * feed shows it only while the "line sources" setting is on.
 *
 * This file is the registry the server, the client and the World Tool share:
 * it knows every set, where it lives and who speaks it. Picking happens here
 * too, so the index in the tag is the index in the data.
 */
const { SHOPS, listKeeperShops } = require('./shops')
const { OVERHEARD, listOverheardRooms } = require('./overheard')
const { listTalkers } = require('./talkers')
const { GIVERS } = require('./quest-registry')

/** The action a giver's Chat button sends: `chatAction` if authored, else "chat with …". */
function chatActionForGiver(giver) {
  if (!giver) return null
  if (giver.chatAction) return giver.chatAction
  return giver.action.replace(/^talk to /, 'chat with ')
}

/** One of a set at random with its index, for callers that want chance rather than order (the shop window's title line is not one; the World Tool's examples are). */
function pickIndexed(lines, rand = Math.random) {
  const list = Array.isArray(lines) ? lines : typeof lines === 'string' && lines ? [lines] : []
  if (list.length === 0) return null
  const index = Math.floor(rand() * list.length)
  return { text: list[index], index }
}

/** The feed's source tag for a line. */
function sourceTag(source) {
  if (!source) return ''
  return `${source.roomId} · ${source.speaker} · ${source.set} #${source.index + 1}`
}

/**
 * Every authored set, for the World Tool and the validators: one entry per
 * set, with the room, the speaker, the kind and its lines. Giver sets carry
 * the quest gate they open on (`null` = always).
 */
function listLineSets() {
  const sets = []
  for (const [roomId, keeper] of listKeeperShops()) {
    sets.push({ roomId, speaker: keeper.label, speakerId: keeper.label.toLowerCase(), set: 'keeper', action: keeper.action, lines: keeper.lines, gate: null, shop: SHOPS[roomId].name })
  }
  for (const roomId of listOverheardRooms()) {
    const o = OVERHEARD[roomId]
    sets.push({ roomId, speaker: o.label, speakerId: 'crowd', set: 'listen', action: o.action, lines: o.lines, gate: null, shop: null })
  }
  for (const [roomId, t] of listTalkers()) {
    for (const s of t.sets) {
      if (s.lines.length === 0) continue
      const member = s.ifMember ? (Array.isArray(s.ifMember) ? s.ifMember : [s.ifMember]) : null
      sets.push({ roomId, speaker: t.name, speakerId: t.id, set: 'talker', action: t.action, lines: s.lines, gate: null, memberOf: member, shop: null })
    }
  }
  for (const [giverId, g] of Object.entries(GIVERS)) {
    const action = chatActionForGiver(g)
    for (const entry of g.idleDialogs || []) {
      const lines = Array.isArray(entry.message) ? entry.message : [entry.message]
      sets.push({ roomId: g.roomId, speaker: g.name, speakerId: giverId, set: 'idle', action, lines, gate: entry.ifCompleted ?? null, shop: null })
    }
    for (const entry of g.asides || []) {
      sets.push({ roomId: g.roomId, speaker: g.name, speakerId: giverId, set: 'aside', action, lines: entry.lines, gate: entry.ifCompleted ?? null, shop: null })
    }
  }
  return sets
}

module.exports = { chatActionForGiver, pickIndexed, sourceTag, listLineSets }
