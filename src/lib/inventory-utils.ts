import { ItemType } from '@prisma/client'

/**
 * Item declaration order from seed.ts
 * This array represents the order items are declared in prisma/seed.ts
 * Items are indexed by their position in the itemTemplates array
 */
const SEED_ITEM_ORDER = [
  'flower',
  'redberry',
  'blueberry',
  'welcome-book',
  'shovel',
  'dagger',
  'red-potion',
  'blue-potion',
  'dirt',
  'sand',
  'stone',
  'wood',
  'hatchet',
  'pickaxe',
] as const

/**
 * Creates a Map of item slug to display order index
 * Items not in seed.ts get a high order value (appear at end)
 */
export function getItemDisplayOrder(): Map<string, number> {
  const orderMap = new Map<string, number>()
  
  SEED_ITEM_ORDER.forEach((slug, index) => {
    orderMap.set(slug, index)
  })
  
  return orderMap
}

/**
 * Get display name for ItemType enum
 */
export function getCategoryDisplayName(type: ItemType): string {
  switch (type) {
    case ItemType.WEAPON:
      return 'Weapons'
    case ItemType.CONSUMABLE:
      return 'Consumables'
    case ItemType.MISC:
      return 'Miscellaneous'
    default:
      return type
  }
}

/**
 * Category display order
 */
export const CATEGORY_ORDER: ItemType[] = [
  ItemType.WEAPON,
  ItemType.CONSUMABLE,
  ItemType.MISC,
]

/**
 * Get display order for an item slug
 * Returns the order index if found in seed.ts, otherwise returns a high number
 */
export function getItemOrderIndex(slug: string, orderMap: Map<string, number>): number {
  return orderMap.get(slug) ?? 999999
}

