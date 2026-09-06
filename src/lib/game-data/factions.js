/**
 * The factions of Vega: the peoples and guilds that quests are done for.
 *
 * A faction is a place to belong to, not a rank ladder. Standing with one is
 * simply how many of its quests you have finished out of how many it has,
 * derived from QuestProgress whenever it is read — nothing is stored. The one
 * thing a faction earns you is its title, at max standing.
 *
 * Two kinds:
 *  - `region`: a town or land (Grassy Field, Red Town, the Blue Ocean). Its
 *    givers are the people who live there. The original paid a "Savior" title
 *    per region at the Grand Quest Pillar, which is where these titles come from.
 *  - `guild`: a membership. `membershipQuest` is the initiation; turning it in
 *    is what "being a member" means everywhere — guild doors, shops, trainers,
 *    and the NPCs who only talk to members ask `isMember`, never a quest id.
 *
 * Regions and guilds are separate: a guild quest does not raise its town.
 * Mountains and Star City are declared so the Pillar's capstones can name
 * them; they have no givers until their maps are ported.
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
  { id: 'grassy-field', name: 'Grassy Field', kind: 'region', colorToken: 'world.grassyField', hubRoomId: '001', title: 'Grassy Field Savior' },
  { id: 'forest', name: 'Forest', kind: 'region', colorToken: 'world.forest', hubRoomId: '104', title: 'Forest Savior' },
  { id: 'red-town', name: 'Red Town', kind: 'region', colorToken: 'world.redTown', hubRoomId: '210', title: 'Red Town Savior' },
  { id: 'warriors-guild', name: "Warrior's Guild", kind: 'guild', colorToken: 'mood.calm', hubRoomId: '226', membershipQuest: 'quest_warriorsguild_000', memberTitle: 'Warrior', title: 'True Warrior' },
  { id: 'wizards-guild', name: "Wizard's Guild", kind: 'guild', colorToken: 'mood.arcane', hubRoomId: '225', membershipQuest: 'quest_wizardsguild_000', memberTitle: 'Wizard', title: 'Powerful Wizard' },
  { id: 'dwarf-village', name: 'Dwarf Village', kind: 'region', colorToken: 'world.rockyFlats', hubRoomId: '303', title: 'Rocky Flats Savior' },
  { id: 'mining-guild', name: 'Mining Guild', kind: 'guild', colorToken: 'mood.treasure', hubRoomId: '308', membershipQuest: 'quest_miningguild_000', memberTitle: 'Miner', title: 'Master Miner' },
  { id: 'ocean', name: 'Blue Ocean', kind: 'region', colorToken: 'world.ocean', hubRoomId: '413', title: 'Blue Ocean Savior' },
  { id: 'dark-forest', name: 'Dark Forest', kind: 'region', colorToken: 'world.darkForest', hubRoomId: '507', title: 'Dark Forest Savior' },
  { id: 'rangers-guild', name: "Ranger's Guild", kind: 'guild', colorToken: 'world.rangersGuild', hubRoomId: '515', membershipQuest: 'quest_rangersguild_000', memberTitle: 'Ranger', title: 'Elite Ranger' },
  { id: 'mountains', name: 'Mountains', kind: 'region', colorToken: null, placeholder: true, title: 'Mountain Savior' },
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

module.exports = { FACTIONS, getFaction, factionByMembershipQuest, listLiveFactions }
