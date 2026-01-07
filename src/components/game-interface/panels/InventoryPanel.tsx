'use client'

import { X } from 'lucide-react'
import InventoryDisplay from '@/components/InventoryDisplay'
import type { InventoryItem } from '@/lib/game-state'

type FilterTab = 'all' | 'main' | 'off' | 'head' | 'body' | 'hands' | 'feet' | 'consumables' | 'misc'

interface InventoryPanelProps {
  inventory: InventoryItem[]
  onAction: (action: string | { type: string; data?: any }) => void
  initialFilter?: FilterTab
  newItemIds: Set<string>
  onClearNewItem: (itemId: string) => void
  onClose: () => void
}

export default function InventoryPanel({
  inventory,
  onAction,
  initialFilter,
  newItemIds,
  onClearNewItem,
  onClose,
}: InventoryPanelProps) {
  return (
    <div className="relative w-full h-full">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
        title="Close"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <InventoryDisplay
        inventory={inventory}
        onAction={onAction}
        initialFilter={initialFilter}
        newItemIds={newItemIds}
        onClearNewItem={onClearNewItem}
      />
    </div>
  )
}

