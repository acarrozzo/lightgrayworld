/**
 * The factions of Vega: the peoples and guilds that quests are done for.
 *
 * A faction is a place to belong to, not a rank ladder. Standing with one is
 * simply how many of its quests you have finished out of how many it has,
 * derived from QuestProgress whenever it is read — nothing is stored.
 *
 * Two kinds:
 *  - `region`: a town or land (Grassy Field, Red Town, the Blue Ocean). Its
 *    givers are the people who live there. A region at max standing is a mark
 *    in the journal, not a title: the lands' titles are the Guardian Angel's
 *    to give, one growing name carved into the Grand Quest Pillar (the
 *    `grantsTitle` of the grand quests in quests.json), as the original paid
 *    its "Savior" titles at the Pillar and nowhere else.
 *  - `guild`: a membership. `membershipQuest` is the initiation; turning it in
 *    is what "being a member" means everywhere — guild doors, shops, trainers,
 *    and the NPCs who only talk to members ask `isMember`, never a quest id.
 *    A guild at max standing does earn its `title`: that is a different deed.
 *
 * Regions and guilds are separate: a guild quest does not raise its town.
 * Star City is declared so the Pillar's fifth name can be carved (dark until
 * its map is ported); it has no givers.
 *
 * `colorToken` is the room-colour token (theme/room-colors.ts) the faction's
 * standing bar is painted with: a region takes its world colour, a guild
 * takes the colour its own rooms are titled in — the Wizard's Guild is
 * arcane purple, the Warrior's Guild calm blue, the Mining Guild treasure
 * gold, the Ranger's Guild its own world token — not its town's.
 *
 * Shared by the server (membership checks, standing) and the client (journal
 * grouping, titles), like world-map.js.
 */
const FACTIONS = [
  { id: 'grassy-field', name: 'Grassy Field', kind: 'region', colorToken: 'world.grassyField', hubRoomId: '001' },
  { id: 'forest', name: 'Forest', kind: 'region', colorToken: 'world.forest', hubRoomId: '104' },
  { id: 'red-town', name: 'Red Town', kind: 'region', colorToken: 'world.redTown', hubRoomId: '210' },
  { id: 'warriors-guild', name: "Warrior's Guild", kind: 'guild', colorToken: 'mood.calm', hubRoomId: '226', membershipQuest: 'quest_warriorsguild_000', memberTitle: 'Warrior', title: 'True Warrior' },
  { id: 'wizards-guild', name: "Wizard's Guild", kind: 'guild', colorToken: 'mood.arcane', hubRoomId: '225', membershipQuest: 'quest_wizardsguild_000', memberTitle: 'Wizard', title: 'Powerful Wizard' },
  { id: 'dwarf-village', name: 'Dwarf Village', kind: 'region', colorToken: 'world.rockyFlats', hubRoomId: '303' },
  { id: 'mining-guild', name: 'Mining Guild', kind: 'guild', colorToken: 'mood.treasure', hubRoomId: '308', membershipQuest: 'quest_miningguild_000', memberTitle: 'Miner', title: 'Master Miner' },
  { id: 'ocean', name: 'Blue Ocean', kind: 'region', colorToken: 'world.ocean', hubRoomId: '413' },
  { id: 'dark-forest', name: 'Dark Forest', kind: 'region', colorToken: 'world.darkForest', hubRoomId: '507' },
  { id: 'rangers-guild', name: "Ranger's Guild", kind: 'guild', colorToken: 'world.rangersGuild', hubRoomId: '515', membershipQuest: 'quest_rangersguild_000', memberTitle: 'Ranger', title: 'Elite Ranger' },
  { id: 'mountains', name: 'Mountains', kind: 'region', colorToken: 'world.mountains', hubRoomId: '605' },
  { id: 'star-city', name: 'Star City', kind: 'region', colorToken: null, placeholder: true, title: 'Eternal Mage' },
]

const FACTIONS_BY_ID = new Map(FACTIONS.map((f) => [f.id, f]))
const FACTION_BY_MEMBERSHIP_QUEST = new Map(FACTIONS.filter((f) => f.membershipQuest).map((f) => [f.membershipQuest, f]))

/** @returns {typeof FACTIONS[number] | null} */
function getFaction(factionId) {
  return FACTIONS_BY_ID.get(factionId) ?? null
}

/** The guild whose initiation this quest is, if it is one. */
function factionByMembershipQuest(questId) {
  return FACTION_BY_MEMBERSHIP_QUEST.get(questId) ?? null
}

/** Factions with givers in the game today, in world order. */
function listLiveFactions() {
  return FACTIONS.filter((f) => !f.placeholder)
}

/**
 * The guilds a player belongs to, as faction ids, from their QuestProgress
 * rows (`{ questId, completed }`): the client's answer to `isMember`, read off
 * the same rows the journal already holds, so the Teleport page knows which
 * guild halls are open without a round trip.
 */
function memberGuildIds(progressRows) {
  const done = new Set()
  for (const row of progressRows ?? []) if (row.completed) done.add(row.questId)
  return FACTIONS.filter((f) => f.membershipQuest && done.has(f.membershipQuest)).map((f) => f.id)
}

module.exports = { FACTIONS, getFaction, factionByMembershipQuest, listLiveFactions, memberGuildIds }
