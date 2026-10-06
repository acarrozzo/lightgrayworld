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
  skills: 'Skills',
  spells: 'Spells',
  'kill-list': 'Kill List',
  'battle-log': 'Battle Log',
  party: 'Party',
  dm: 'DM',
  map: 'Map',
  world: 'World Map',
  travel: 'Travel',
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

/**
 * The item a result message is talking about, if it names one the player is
 * carrying: "You pick up a shovel." with a Shovel in the bag. Returns where
 * the name sits in the message so that word can be the link.
 *
 * Whole words only, longest name first, so "Key" is not found inside
 * "monkey" and "Iron Ring" wins over "Ring". Names under three letters are
 * skipped: too likely to be an ordinary word.
 */
export function findMentionedItem(
  message: string | null | undefined,
  items: ReadonlyArray<{ id: string; name: string }>,
): { itemId: string; start: number; end: number } | null {
  if (!message) return null
  const lower = message.toLowerCase()
  const candidates = items.filter((item) => item.name.trim().length >= 3).sort((a, b) => b.name.length - a.name.length)
  const isWordChar = (char: string | undefined) => !!char && /[a-z0-9]/i.test(char)
  for (const item of candidates) {
    const name = item.name.trim().toLowerCase()
    let from = 0
    while (from <= lower.length - name.length) {
      const start = lower.indexOf(name, from)
      if (start === -1) break
      const end = start + name.length
      // A trailing "s" still counts as the same word: "3 redberries" is too
      // far, but "shovels" is fine.
      const after = lower[end] === 's' && !isWordChar(lower[end + 1]) ? end + 1 : end
      if (!isWordChar(lower[start - 1]) && !isWordChar(lower[after])) return { itemId: item.id, start, end: after }
      from = start + 1
    }
  }
  return null
}
