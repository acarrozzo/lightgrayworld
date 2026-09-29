'use client'

import { FlaskConical } from 'lucide-react'
import type { InventoryItem, Player } from '@/lib/game-state'
import type { FilterTab } from '@/lib/inventory-categories'
import { useConsumableDeck } from './AbilityRows'
import ConsumableDeck from './ConsumableDeck'
import LayerShell, { LayerLink } from './LayerShell'

interface BagLayerProps {
  variant: 'docked' | 'sheet'
  inventory: InventoryItem[]
  player: Player
  /** Held while an action resolves. */
  disabled?: boolean
  onUse: (playerItemId: string, action: string) => void
  onOpenInventory: (filter?: FilterTab, openItemId?: string) => void
  onClose: () => void
}

/**
 * The Bag layer: the original's bagbox, one tap from the compass. The same
 * ladders the battle deck shows, so a potion reads identically in and out of a
 * fight, with the full bag one link away. A use here is the same `use_item`
 * the Inv row sends; with a hostile in the room it provokes exactly as that
 * does, because the server decides that, not this surface.
 */
export default function BagLayer({ variant, inventory, player, disabled = false, onUse, onOpenInventory, onClose }: BagLayerProps) {
  const hpFull = (player.hp ?? 0) >= (player.hpMax ?? 0)
  const mpFull = (player.mp ?? 0) >= (player.mpMax ?? 0)
  const count = useConsumableDeck(inventory).all.length
  return (
    <LayerShell
      title="Bag"
      icon={FlaskConical}
      toneClass="text-resource-gold"
      variant={variant}
      onClose={onClose}
      footer={
        <>
          <span className="tabular-nums">{count === 0 ? 'Nothing to use' : `${count} to use`}</span>
          <LayerLink onClick={() => onOpenInventory('consumables')}>Open full bag</LayerLink>
        </>
      }
    >
      <ConsumableDeck
        inventory={inventory}
        hpFull={hpFull}
        mpFull={mpFull}
        disabled={disabled}
        onUse={onUse}
        onOpen={(playerItemId) => onOpenInventory('consumables', playerItemId)}
        emptyText="Nothing to drink or eat. Potions come from shops and chests."
      />
    </LayerShell>
  )
}
