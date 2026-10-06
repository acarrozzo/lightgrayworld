/**
 * What of the interface a character has earned.
 *
 * The world starts small and opens outward, and so does the screen: a new
 * character has Explore and Char, and everything else arrives when the game
 * first gives it something to hold — the Inv tab with the first item, Quests
 * with the first job, World with the first map or teleport, the books with
 * the first skill point there is a teacher to spend it with. Each arrival is announced once.
 *
 * This is presentation, never permission. Nothing here gates an action: the
 * server still decides what a player may do, and every rule below is derived
 * from facts the server already sent. A place that has been unlocked stays
 * unlocked on that device even if the fact later goes away (the last potion
 * drunk), which is why the hook that uses this keeps a latch.
 */
import type { TabId } from './tab-rules'

export type UnlockId =
  | 'tab:inv'
  | 'tab:quests'
  | 'tab:world'
  | 'tab:players'
  | 'explore:action'
  | 'char:skills'
  | 'char:spells'
  | 'inv:consumables'
  | 'inv:crafting'
  | 'inv:misc'
  | 'quests:kill-list'
  | 'quests:battle-log'

/** The facts the rules read. All of them are things the client already holds. */
export interface UnlockFacts {
  level: number
  /** Everything carried, worn or not. */
  itemCount: number
  consumableCount: number
  craftingCount: number
  miscCount: number
  /** Quests ever given, and givers ever met. */
  questCount: number
  giversMet: number
  /** Any map sheet found, or any teleport hub stood in. */
  hasMapOrTeleport: boolean
  /** Another player is in the room, the player is in a party, or a DM is waiting. */
  othersSeen: boolean
  /** Skill Points in hand. A book is no use until there is something to spend in it. */
  sp: number
  /** A teacher has been met, so the book has a row that could be learned. */
  hasSkillTeacher: boolean
  hasSpellTeacher: boolean
  /** Something in that book has already been learned. */
  hasLearnedSkill: boolean
  hasLearnedSpell: boolean
  /** A spell or strike that can be used, so Action has more than Attack to offer. */
  hasAbility: boolean
  kills: number
  deaths: number
}

interface UnlockDef {
  id: UnlockId
  /** The tab this lives in: the tile that glows when it arrives. */
  tab: TabId
  /** The sub-tab to land on when the announcement is followed, if it is one. */
  sub?: string
  earned: (facts: UnlockFacts) => boolean
  /** The feed line. Omitted for an unlock that arrives with another and should not speak twice. */
  announce?: string
}

/**
 * A long-standing character who has never met another player still gets the
 * Players tab: Ranks lives there, and nobody should be locked out of it for
 * playing alone.
 */
const PLAYERS_BACKSTOP_LEVEL = 5

export const UNLOCKS: readonly UnlockDef[] = [
  {
    id: 'tab:inv',
    tab: 'inv',
    earned: (f) => f.itemCount > 0,
    announce: 'You are carrying something. The Inv tab is open: what you wear and what you hold.',
  },
  {
    id: 'tab:quests',
    tab: 'quests',
    earned: (f) => f.questCount > 0 || f.giversMet > 0,
    announce: 'Someone has work for you. The Quests tab is open.',
  },
  {
    id: 'tab:world',
    tab: 'world',
    // Dying wakes you in the Plane of Rebirth, which has no exits: teleport is
    // the only way out, so a death opens World whatever else has been found.
    earned: (f) => f.hasMapOrTeleport || f.deaths > 0,
    announce: 'You have found your bearings. The World tab is open: your maps and teleports.',
  },
  {
    id: 'tab:players',
    tab: 'players',
    earned: (f) => f.othersSeen || f.level >= PLAYERS_BACKSTOP_LEVEL,
    announce: 'You are not alone out here. The Players tab is open.',
  },
  {
    id: 'explore:action',
    tab: 'explore',
    // Something to use, or somewhere to teleport: the deck's Travel tab.
    earned: (f) => f.consumableCount > 0 || f.hasAbility || f.hasMapOrTeleport || f.deaths > 0,
    announce: 'The All actions button is open under the compass: what you can use, and where you can go, one tap away.',
  },
  {
    id: 'char:skills',
    tab: 'char',
    sub: 'skills',
    // A teacher and a point to spend with them — or a page already filled in.
    earned: (f) => f.hasLearnedSkill || (f.hasSkillTeacher && f.sp > 0),
    announce: 'You have a skill point and someone to teach you. Skills is open, under Char.',
  },
  {
    id: 'char:spells',
    tab: 'char',
    sub: 'spells',
    earned: (f) => f.hasLearnedSpell || (f.hasSpellTeacher && f.sp > 0),
    announce: 'You have a skill point and someone to teach you magic. Spells is open, under Char.',
  },
  {
    id: 'inv:consumables',
    tab: 'inv',
    sub: 'consumables',
    earned: (f) => f.consumableCount > 0,
    announce: 'Something to eat, drink or use. Items is open in your inventory.',
  },
  {
    id: 'inv:crafting',
    tab: 'inv',
    sub: 'crafting',
    earned: (f) => f.craftingCount > 0,
    announce: 'Raw material. Craft is open in your inventory.',
  },
  {
    id: 'inv:misc',
    tab: 'inv',
    sub: 'misc',
    earned: (f) => f.miscCount > 0,
    announce: 'Something that fits nowhere else. Misc is open in your inventory.',
  },
  {
    id: 'quests:kill-list',
    tab: 'quests',
    sub: 'kill-list',
    earned: (f) => f.kills > 0,
    announce: 'Your first kill. The Kill List and the Battle Log are open, under Quests.',
  },
  {
    id: 'quests:battle-log',
    tab: 'quests',
    sub: 'battle-log',
    earned: (f) => f.kills > 0 || f.deaths > 0,
  },
]

const BY_ID = new Map(UNLOCKS.map((def) => [def.id, def]))
export const unlockDef = (id: UnlockId): UnlockDef | undefined => BY_ID.get(id)

/** Every unlock the facts earn right now. */
export function earnedUnlocks(facts: UnlockFacts): UnlockId[] {
  return UNLOCKS.filter((def) => def.earned(facts)).map((def) => def.id)
}

/**
 * What is open, and what has just become so: everything ever latched plus
 * everything earned now. `arrived` is the part that was not latched before,
 * in registry order, so a tab is announced before the sub-tabs inside it.
 */
export function resolveUnlocks(latched: Iterable<UnlockId>, facts: UnlockFacts): { open: Set<UnlockId>; arrived: UnlockId[] } {
  const open = new Set<UnlockId>(latched)
  const arrived: UnlockId[] = []
  for (const id of earnedUnlocks(facts)) {
    if (!open.has(id)) {
      open.add(id)
      arrived.push(id)
    }
  }
  return { open, arrived }
}

/**
 * The lines to say for a batch of arrivals. A sub-tab that arrives together
 * with its own tab stays quiet: the tab's line has already said the place is
 * open, and three lines for one pickup is noise.
 */
export function announcementsFor(arrived: readonly UnlockId[]): UnlockDef[] {
  const tabsArriving = new Set(arrived.map((id) => unlockDef(id)).filter((def) => def && !def.sub).map((def) => def!.tab))
  return arrived
    .map((id) => unlockDef(id))
    .filter((def): def is UnlockDef => Boolean(def?.announce))
    .filter((def) => !(def.sub && tabsArriving.has(def.tab)))
}

/** Which tabs to leave out of the bar. */
export function hiddenTabs(open: ReadonlySet<UnlockId>): Set<TabId> {
  const hidden = new Set<TabId>()
  for (const tab of ['inv', 'quests', 'world', 'players'] as const) {
    if (!open.has(`tab:${tab}`)) hidden.add(tab)
  }
  return hidden
}

/** Which tabs hold something that has arrived and not been looked at. */
export function freshTabs(fresh: ReadonlySet<UnlockId>): Set<TabId> {
  const tabs = new Set<TabId>()
  for (const id of fresh) {
    const def = unlockDef(id)
    if (def) tabs.add(def.tab)
  }
  return tabs
}
