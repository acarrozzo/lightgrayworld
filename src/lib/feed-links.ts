/**
 * Where a feed line can take you.
 *
 * Every place in the interface has an address now — a tab, a sub-tab inside
 * it, and in the inventory one item — so a line that mentions something can
 * point at it. The link is set by whoever writes the line and already knows
 * what it is about; nothing here reads the line's text.
 */
import type { TabId } from './tab-rules'

export interface FeedLink {
  tab: TabId
  /** A sub-tab of that tab: 'skills', 'spells', 'kill-list', 'battle-log', 'party', 'dm', 'map', a bag group. */
  sub?: string
  /** Inv only: the item to open and ring. */
  itemId?: string
}

const TAB_NAMES: Record<TabId, string> = {
  explore: 'Explore',
  char: 'Char',
  inv: 'Inv',
  world: 'World',
  quests: 'Quests',
  players: 'Players',
  feed: 'Feed',
  settings: 'Settings',
}

const SUB_NAMES: Record<string, string> = {
  skills: 'Skill book',
  spells: 'Spell book',
  'kill-list': 'Kill List',
  'battle-log': 'Battle Log',
  party: 'Party',
  dm: 'DM',
  map: 'Map',
  world: 'World Map',
  consumables: 'Items',
  crafting: 'Craft',
  misc: 'Misc',
}

/** "Inv", "Skill book", "Battle Log": the shortest name for where the link goes. */
export function feedLinkLabel(link: FeedLink): string {
  return (link.sub && SUB_NAMES[link.sub]) || TAB_NAMES[link.tab]
}

// One handler, registered by the game screen, which owns the tabs. The feed
// panel and the activity line are far from it in the tree and mounted twice
// (desktop panel, phone tab), so they call through here rather than each
// being handed a prop.
let handler: ((link: FeedLink) => void) | null = null

export function registerFeedLinkHandler(next: ((link: FeedLink) => void) | null) {
  handler = next
}

export function followFeedLink(link: FeedLink) {
  handler?.(link)
}
