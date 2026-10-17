/**
 * Quests, their givers, and the factions they count toward — one read-only view
 * over quests.json + quest-givers.json + factions.js.
 *
 * The shape:
 *  - A **giver** (quest-givers.json) is an NPC: who
 *    they are, where they stand, which faction they speak for, how the player
 *    hears of them (`revealedBy`), what must be true before they will talk
 *    (`meetRequirements` / `lockedDialog`), what they say on first meeting
 *    (`greeting`), afterwards (`idleDialogs`), and their quests in order.
 *  - A **quest** (quests.json) belongs to one giver (`giverId`). It opens when
 *    the giver is met and every quest in its `after` list is complete. There
 *    are no start effects: the giver's list and `after` are the whole chain.
 *  - **Standing** with a faction is completed quests / total quests across that
 *    faction's givers. Derived here from a player's QuestProgress rows.
 *
 * Meeting a giver is a durable row (GiverMet); being *revealed* is derived from
 * what the player has already done, so the journal can say who is still out
 * there to find without a row per hint.
 *
 * Shared by the engine, the API routes, the client, and the validators.
 */
const QUESTS = require('./quests.json')
const GIVERS = require('./quest-givers.json')
const { FACTIONS, getFaction, listLiveFactions } = require('./factions')

const GIVER_IDS = Object.keys(GIVERS)

/** Every quest id in authored order: givers as listed, quests as each giver lists them. */
const QUEST_ORDER = []
const GIVER_OF_QUEST = new Map()
for (const giverId of GIVER_IDS) {
  for (const questId of GIVERS[giverId].quests) {
    QUEST_ORDER.push(questId)
    GIVER_OF_QUEST.set(questId, giverId)
  }
}
const QUEST_INDEX = new Map(QUEST_ORDER.map((id, i) => [id, i]))

function getQuestDef(questId) {
  return QUESTS[questId] ?? null
}

function getGiver(giverId) {
  return GIVERS[giverId] ?? null
}

/** The giver definition a quest belongs to. */
function giverForQuest(questId) {
  const giverId = GIVER_OF_QUEST.get(questId) ?? QUESTS[questId]?.giverId
  return giverId ? GIVERS[giverId] ?? null : null
}

function giverIdForQuest(questId) {
  return GIVER_OF_QUEST.get(questId) ?? QUESTS[questId]?.giverId ?? null
}

/** A giver's quest ids in the order they are listed. */
function listGiverQuestIds(giverId) {
  return GIVERS[giverId]?.quests ?? []
}

/** Position of a quest in the authored order; unknown ids sort last. */
function questOrderIndex(questId) {
  return QUEST_INDEX.get(questId) ?? Number.MAX_SAFE_INTEGER
}

function sortQuestIds(questIds) {
  return [...questIds].sort((a, b) => questOrderIndex(a) - questOrderIndex(b))
}

/** Givers speaking for a faction, in authored order. */
function listFactionGiverIds(factionId) {
  return GIVER_IDS.filter((id) => GIVERS[id].faction === factionId)
}

/** Every quest a faction counts, in authored order. */
function listFactionQuestIds(factionId) {
  return listFactionGiverIds(factionId).flatMap((id) => GIVERS[id].quests)
}

/** Completed quest ids from a player's progress rows. */
function completedSet(progressRows) {
  const set = new Set()
  for (const row of progressRows ?? []) if (row.completed) set.add(row.questId)
  return set
}

/**
 * Standing with one faction: quests done out of quests it has. `complete` is
 * the trophy moment in the journal and, for a guild, its title. A placeholder
 * faction (no givers yet) is never complete.
 */
function factionStanding(factionId, progressRows) {
  const faction = getFaction(factionId)
  if (!faction) return null
  const done = completedSet(progressRows)
  const questIds = listFactionQuestIds(factionId)
  const completed = questIds.filter((id) => done.has(id)).length
  const total = questIds.length
  const complete = total > 0 && completed === total
  return {
    factionId,
    name: faction.name,
    kind: faction.kind,
    colorToken: faction.colorToken ?? null,
    done: completed,
    total,
    complete,
    title: complete ? faction.title ?? null : null,
  }
}

/** Standing with every live faction, in world order. */
function allStandings(progressRows) {
  return listLiveFactions().map((f) => factionStanding(f.id, progressRows))
}

/** The giver whose quests carve names into the Grand Quest Pillar. */
const PILLAR_GIVER_ID = 'guardian_angel'

/**
 * The names carved into the Pillar, in the order they are earned: one per
 * grand quest (its `grantsTitle`, painted in `titleColorToken`), then the
 * fifth, dark name a placeholder faction reserves (Star City's "Eternal
 * Mage"), which has no quest yet and so cannot be earned.
 *
 * @returns {{ questId: string | null, title: string, colorToken: string | null, waitsFor: string | null }[]}
 */
function listPillarNames() {
  const names = listGiverQuestIds(PILLAR_GIVER_ID)
    .filter((id) => QUESTS[id]?.grantsTitle)
    .map((id) => ({ questId: id, title: QUESTS[id].grantsTitle, colorToken: QUESTS[id].titleColorToken ?? null, waitsFor: null }))
  for (const faction of FACTIONS) {
    if (faction.placeholder && faction.title) {
      names.push({ questId: null, title: faction.title, colorToken: faction.colorToken ?? null, waitsFor: faction.name })
    }
  }
  return names
}

/**
 * The Pillar's name for a player: the last grand quest they have turned in.
 * One growing name — each step replaces the one before, so a player is never
 * both Savior of the Grassy Field and Savior of the Lowlands. Null until the
 * first is earned.
 */
function pillarTitle(progressRows) {
  const done = completedSet(progressRows)
  let title = null
  for (const name of listPillarNames()) {
    if (name.questId && done.has(name.questId)) title = name.title
  }
  return title
}

/**
 * The titles a player may wear: the Pillar's current name first, then one per
 * guild at max standing. This is what the server checks a chosen `User.title`
 * against, and what the Char page offers.
 */
function earnedTitles(progressRows) {
  const guild = allStandings(progressRows)
    .filter((s) => s.complete && s.title)
    .map((s) => s.title)
  const pillar = pillarTitle(progressRows)
  return pillar ? [pillar, ...guild] : guild
}

/** A quest is open once every quest in its `after` list is complete. */
function isQuestOpen(questId, done) {
  const def = QUESTS[questId]
  if (!def) return false
  return (def.after ?? []).every((prev) => done.has(prev))
}

/**
 * Whether the player has heard of a giver yet. Only a hint — talking to a
 * giver never checks this; standing in their room is enough. `ctx` carries
 * what reveals can depend on: completed quests, met givers, discovered fast
 * travel regions, and the User row's boolean flags.
 *
 * @param {object} giver
 * @param {{ done: Set<string>, met: Set<string>, discoveredTeleports?: string[], flags?: Record<string, unknown> }} ctx
 */
function isGiverRevealed(giver, ctx) {
  const rule = giver?.revealedBy
  if (!rule) return false
  switch (rule.type) {
    case 'always':
      return true
    case 'questCompleted':
      return ctx.done.has(rule.questId)
    case 'giverMet':
      return ctx.met.has(rule.giverId)
    case 'regionDiscovered':
      return (ctx.discoveredTeleports ?? []).includes(rule.regionId)
    case 'flag':
      return !!ctx.flags?.[rule.flag]
    default:
      return false
  }
}

module.exports = {
  QUESTS,
  GIVERS,
  FACTIONS,
  GIVER_IDS,
  QUEST_ORDER,
  getQuestDef,
  getGiver,
  giverForQuest,
  giverIdForQuest,
  listGiverQuestIds,
  questOrderIndex,
  sortQuestIds,
  listFactionGiverIds,
  listFactionQuestIds,
  completedSet,
  factionStanding,
  allStandings,
  earnedTitles,
  PILLAR_GIVER_ID,
  listPillarNames,
  pillarTitle,
  isQuestOpen,
  isGiverRevealed,
}
