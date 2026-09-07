/**
 * The shape of one search hit, shared by the index builder on the server and
 * the search box in the rail. Kept free of server imports so the client can
 * use it.
 */

export type SearchEntityType =
  | 'enemy'
  | 'item'
  | 'quest'
  | 'giver'
  | 'room'
  | 'skill'
  | 'spell'
  | 'recipe'
  | 'shop'

export type SearchEntry = {
  type: SearchEntityType
  /** The stable identity — slug, quest id, room id — which is also searchable. */
  id: string
  name: string
  /** One short line of context: an enemy's area and level, a room's number and region. */
  sub?: string
  /** Where the hit lives; an anchor on its page, so the row is scrolled to and flashed. */
  href: string
}

export const SEARCH_TYPE_LABEL: Record<SearchEntityType, string> = {
  enemy: 'Enemy',
  item: 'Item',
  quest: 'Quest',
  giver: 'Giver',
  room: 'Room',
  skill: 'Skill',
  spell: 'Spell',
  recipe: 'Recipe',
  shop: 'Shop',
}

/** Tie-break order when two hits match equally well. */
export const SEARCH_TYPE_ORDER: SearchEntityType[] = [
  'enemy', 'item', 'room', 'quest', 'giver', 'skill', 'spell', 'recipe', 'shop',
]
