'use client'

import { useMemo } from 'react'
import { Swords } from 'lucide-react'
import type { BattleState, InventoryItem, Player } from '@/lib/game-state'
import type { FilterTab } from '@/lib/inventory-categories'
import { deckContextFromBattle, deckContextFromRoom, type targetFromRoomEnemy } from '@/lib/action-deck'
import ActionDeck from './ActionDeck'
import LayerShell, { LayerLink } from './LayerShell'

type RoomEnemyLike = Parameters<typeof targetFromRoomEnemy>[0]

interface ActionLayerProps {
  variant: 'docked' | 'sheet'
  player: Player
  inventory: InventoryItem[]
  /** A running fight makes this the deck's twin; otherwise the room's enemy is the target. */
  battle: BattleState
  roomEnemy: RoomEnemyLike
  /** Held while an action resolves. */
  isActing?: boolean
  onAttack: () => void
  onUseSkill: (skillId: string) => void
  onCastSpell: (spellId: string) => void
  onUseItem: (playerItemId: string, action: string) => void
  onOpenBook?: (tab: 'skills' | 'spells', highlightId?: string) => void
  onOpenInventory: (filter?: FilterTab, openItemId?: string) => void
  onClose: () => void
}

/**
 * The Action layer: the original's bag box and spell box, one tap from the
 * compass, drawn as the battle deck's command block. With an enemy in the
 * room, Attack and the strikes open the fight; heals and buffs cast in place;
 * with nothing to hit the attack controls say so and the rest still works.
 * During a fight on desktop it is the deck's twin beside it.
 */
export default function ActionLayer({
  variant,
  player,
  inventory,
  battle,
  roomEnemy,
  isActing = false,
  onAttack,
  onUseSkill,
  onCastSpell,
  onUseItem,
  onOpenBook,
  onOpenInventory,
  onClose,
}: ActionLayerProps) {
  const context = useMemo(
    () => (battle.isInBattle ? deckContextFromBattle(battle, player, inventory) : deckContextFromRoom(roomEnemy, player, inventory)),
    [battle, player, inventory, roomEnemy]
  )
  return (
    <LayerShell
      title="Action"
      icon={Swords}
      toneClass="text-action-attack"
      variant={variant}
      onClose={onClose}
      footer={
        <>
          {onOpenBook ? <LayerLink onClick={() => onOpenBook('spells')}>Open the book</LayerLink> : <span />}
          <LayerLink onClick={() => onOpenInventory('consumables')}>Open full bag</LayerLink>
        </>
      }
    >
      <ActionDeck
        player={player}
        inventory={inventory}
        context={context}
        mpMax={player.mpMax ?? 0}
        isActing={isActing}
        onAttack={onAttack}
        onUseSkill={onUseSkill}
        onCastSpell={onCastSpell}
        onUseItem={onUseItem}
        onOpenBook={battle.isInBattle ? undefined : onOpenBook}
        onOpenItem={battle.isInBattle ? undefined : (playerItemId) => onOpenInventory('consumables', playerItemId)}
        listClassName={variant === 'sheet' ? 'max-h-[42dvh]' : ''}
        idPrefix={variant === 'sheet' ? 'sheet' : 'layer'}
      />
    </LayerShell>
  )
}
