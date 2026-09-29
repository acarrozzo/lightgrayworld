'use client'

import { Shield } from 'lucide-react'
import { useMemo } from 'react'
import type { InventoryItem, Player } from '@/lib/game-state'
import { effectiveStats } from '@/lib/effective-stats'
import CoreStatsGrid from './CoreStatsGrid'
import type { FilterTab } from '@/lib/inventory-categories'
import AutoEquipRow from './AutoEquipRow'
import EquipmentGrid from './EquipmentGrid'
import LayerShell, { LayerLink } from './LayerShell'

interface GearLayerProps {
  variant: 'docked' | 'sheet'
  inventory: InventoryItem[]
  /** For the stat tiles above the MAX row: the numbers the gear adds up to. */
  player: Player
  /** Held while an action resolves, or when not logged in. */
  disabled?: boolean
  onAction?: (action: { type: string; data?: any }) => void
  onOpenInventory: (filter?: FilterTab, openItemId?: string) => void
  onClose: () => void
}

/**
 * The Gear layer: what you are wearing, one tap from the compass. The four
 * stats the gear adds up to, the MAX row under them as the original's quick
 * links kept it, then the eleven slots. A slot
 * opens the bag filtered to it; MAX is the existing auto-equip action. The
 * character panel draws the same grid.
 */
export default function GearLayer({ variant, inventory, player, disabled = false, onAction, onOpenInventory, onClose }: GearLayerProps) {
  const stats = useMemo(() => effectiveStats(player, inventory), [player, inventory])
  return (
    <LayerShell
      title="Gear"
      icon={Shield}
      toneClass="text-hue-green"
      variant={variant}
      onClose={onClose}
      footer={
        <>
          <span>Tap a slot to change it</span>
          <LayerLink onClick={() => onOpenInventory('main')}>Open inventory</LayerLink>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <CoreStatsGrid stats={stats} />
        <AutoEquipRow disabled={disabled || !onAction} onAction={onAction} />
        <EquipmentGrid inventory={inventory} onSwitchToInventory={(filter) => onOpenInventory(filter)} />
      </div>
    </LayerShell>
  )
}
