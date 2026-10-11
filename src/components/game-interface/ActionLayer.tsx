'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import type { BattleState, InventoryItem, Player } from '@/lib/game-state'
import type { FilterTab } from '@/lib/inventory-categories'
import { deckContextFromBattle, deckContextFromRoom, weaponInHand, type targetFromRoomEnemy } from '@/lib/action-deck'
import { getCastableSpells } from '@/lib/spellbook'
import { startingActionTab, type ActionTab } from '@/lib/use-action-tab'
import { useConsumableDeck } from './AbilityRows'
import ActionDeck from './ActionDeck'
import LayerShell, { HeaderTabs, LayerLink, useDeck } from './LayerShell'

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
 * The Actions tab: the original's bag box and spell box, one tile from
 * anywhere, drawn as the battle card's command block. Attack · Spells · Items
 * are its sub-tabs, in the header like every other tab's (the battle card
 * keeps its own filled switch under the vitals). With an enemy in the room,
 * Attack and the strikes open the fight; heals and buffs cast in place; with
 * nothing to hit the attack controls say so and the rest still works. During
 * a fight on desktop it is the deck's twin beside it. The bag link switches
 * to the Inv tab, so nothing here leaves the deck.
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
  // Where the sub-tabs start is the deck's rule: a fight opens on Attack
  // (Spells for a caster), out of one the tab opens on Items. Only the fight
  // starting or ending resets it.
  const [tab, setTab] = useState<ActionTab>(() => startingActionTab(battle.isInBattle, player, inventory))
  useEffect(() => {
    setTab(startingActionTab(battle.isInBattle, player, inventory))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.isInBattle])
  const { iconName: weaponIconName } = weaponInHand(inventory)
  const spellCount = getCastableSpells(player).length
  const itemCount = useConsumableDeck(inventory).all.length
  const count = (n: number) => (n > 0 ? <span className="ml-1 text-[10px] font-normal tabular-nums opacity-70">{n}</span> : undefined)
  const lead = (
    <HeaderTabs
      label="Attack, Spells or Items"
      color="red"
      active={tab}
      home="attack"
      onChange={setTab}
      tabs={[
        { id: 'attack', label: 'Attack', icon: <Icon name={weaponIconName} size={14} color="current" /> },
        { id: 'spells', label: 'Spells', icon: <Icon name="magic" size={14} color="current" />, extra: count(spellCount) },
        { id: 'items', label: 'Items', icon: <Icon name="inv" size={14} color="current" />, extra: count(itemCount) },
      ]}
    />
  )
  return (
    <LayerShell
      title="Actions"
      icon={<Icon name="hand" size={15} color="current" />}
      toneClass="text-hue-red"
      lead={lead}
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
        tab={tab}
        onTabChange={setTab}
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
        // The layer's own body scrolls, on a phone page and in the column alike.
        listClassName=""
        idPrefix={presentation}
      />
    </LayerShell>
  )
}
