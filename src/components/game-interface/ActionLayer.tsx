'use client'

import { useMemo } from 'react'
import Icon from '@/components/Icon'
import type { BattleState, InventoryItem, Player } from '@/lib/game-state'
import type { FilterTab } from '@/lib/inventory-categories'
import { deckContextFromBattle, deckContextFromRoom, type targetFromRoomEnemy } from '@/lib/action-deck'
import ActionDeck from './ActionDeck'
import LayerShell, { LayerLink, useDeck } from './LayerShell'

type RoomEnemyLike = Parameters<typeof targetFromRoomEnemy>[0]

interface ActionLayerProps {
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
  /** Switches to the Inv tab. */
  onOpenInventory: (filter?: FilterTab, openItemId?: string) => void
}

/**
 * The Action layer: the original's bag box and spell box, one tap from the
 * compass, drawn as the battle deck's command block. With an enemy in the
 * room, Attack and the strikes open the fight; heals and buffs cast in place;
 * with nothing to hit the attack controls say so and the rest still works.
 * During a fight on desktop it is the deck's twin beside it. The bag link
 * switches to the Inv tab, so nothing here leaves the deck.
 */
export default function ActionLayer({
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
}: ActionLayerProps) {
  const { presentation } = useDeck()
  const context = useMemo(
    () => (battle.isInBattle ? deckContextFromBattle(battle, player, inventory) : deckContextFromRoom(roomEnemy, player, inventory)),
    [battle, player, inventory, roomEnemy]
  )
  return (
    <LayerShell
      title="Action"
      icon={<Icon name="hand" size={15} color="current" />}
      toneClass="text-action-attack"
      footer={
        <>
          {onOpenBook ? (
            <span className="flex min-w-0 items-center gap-3">
              <LayerLink onClick={() => onOpenBook('skills')}>Open skill book</LayerLink>
              <LayerLink onClick={() => onOpenBook('spells')}>Open spell book</LayerLink>
            </span>
          ) : (
            <span />
          )}
          <LayerLink onClick={() => onOpenInventory('consumables')}>Open inventory</LayerLink>
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
        listClassName={presentation === 'sheet' ? 'max-h-[42dvh]' : ''}
        idPrefix={presentation}
      />
    </LayerShell>
  )
}
