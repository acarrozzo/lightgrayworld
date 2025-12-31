export interface ItemAction {
  action: string
  label: string
  icon?: string
  className?: string
}

export const ITEM_ACTIONS: Record<string, ItemAction[]> = {
  'welcome-book': [
    { action: 'read book', label: 'Read Book', icon: 'book', className: 'bg-blue-600/70 hover:bg-blue-600' },
  ],
}

/**
 * Get available actions for a specific item
 */
export function getItemActions(itemSlug: string): ItemAction[] {
  return ITEM_ACTIONS[itemSlug] || []
}

/**
 * Check if an action is available for a specific item
 */
export function isActionAvailableForItem(itemSlug: string, action: string): boolean {
  const actions = getItemActions(itemSlug)
  return actions.some((a) => a.action.toLowerCase() === action.toLowerCase())
}

