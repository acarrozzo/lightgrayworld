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
  'flower': [
    { action: 'eat', label: 'Eat', icon: 'flower', className: 'bg-amber-400/70 hover:bg-amber-400' },
  ],
  'redberry': [
    { action: 'eat', label: 'Eat', icon: 'redberry', className: 'bg-red-500/70 hover:bg-red-500' },
  ],
  'blueberry': [
    { action: 'eat', label: 'Eat', icon: 'blueberry', className: 'bg-blue-500/70 hover:bg-blue-500' },
  ],
  'red-potion': [
    { action: 'drink', label: 'Drink', icon: 'red-potion', className: 'bg-red-600/70 hover:bg-red-600' },
  ],
  'blue-potion': [
    { action: 'drink', label: 'Drink', icon: 'blue-potion', className: 'bg-blue-600/70 hover:bg-blue-600' },
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

