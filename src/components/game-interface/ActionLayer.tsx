'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import type { BattleState, InventoryItem, Player } from '@/lib/game-state'
import type { FilterTab } from '@/lib/inventory-categories'
import { deckContextFromBattle, deckContextFromRoom, weaponInHand, type targetFromRoomEnemy } from '@/lib/action-deck'
import { getCastableSpells } from '@/lib/spellbook'
import { startingActionTab, type ActionFocus, type ActionTab } from '@/lib/use-action-tab'
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
  /** The room rolls encounters, so Attack with nothing present hunts for one. */
  canHunt?: boolean
  /** Held while an action resolves. */
  isActing?: boolean
  onAttack: () => void
  onUseSkill: (skillId: string) => void
  onCastSpell: (spellId: string) => void
  onUseItem: (playerItemId: string, action: string) => void
  onOpenBook?: (tab: 'skills' | 'spells', highlightId?: string) => void
  /** Switches to the Inv tab. */
  onOpenInventory: (filter?: FilterTab, openItemId?: string) => void
  /** A link's request: open on this sub-tab, with this heading or row scrolled to and ringed. */
  focus?: ActionFocus | null
}

/**
 * The Actions tab: the original's bag box and spell box, one tile from
 * anywhere, drawn as the battle card's command block. Attack · Spells · Items
 * are its sub-tabs, in the header like every other tab's (the battle card
 * keeps its own filled switch under the vitals). With an enemy in the room,
 * Attack and the strikes open the fight; heals and buffs cast in place; with
 * nothing to hit they hunt in a room that rolls and say so anywhere else, and
 * the rest still works. During
 * a fight on desktop it is the deck's twin beside it. The bag link switches
 * to the Inv tab, so nothing here leaves the deck.
 */
export default function ActionLayer({
  player,
  inventory,
  battle,
  roomEnemy,
  canHunt = false,
  isActing = false,
  onAttack,
  onUseSkill,
  onCastSpell,
  onUseItem,
  onOpenBook,
  onOpenInventory,
  focus = null,
}: ActionLayerProps) {
  const { presentation } = useDeck()
  const context = useMemo(
    () => (battle.isInBattle ? deckContextFromBattle(battle, player, inventory) : deckContextFromRoom(roomEnemy, player, inventory, { canHunt })),
    [battle, player, inventory, roomEnemy, canHunt]
  )
  // Where the sub-tabs start is the deck's rule: a fight opens on Attack
  // (Spells for a caster), out of one the tab opens on Items — unless a link
  // sent the player here, which names its own. Only the fight starting or
  // ending resets it.
  const [tab, setTab] = useState<ActionTab>(() => focus?.tab ?? startingActionTab(battle.isInBattle, player, inventory))
  const lastInBattle = useRef(battle.isInBattle)
  useEffect(() => {
    if (lastInBattle.current === battle.isInBattle) return
    lastInBattle.current = battle.isInBattle
    setTab(startingActionTab(battle.isInBattle, player, inventory))
    setHighlight(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle.isInBattle])

  // What the link pointed at: ringed until the player switches sub-tabs by
  // hand, and scrolled into view one frame late, once its list has rendered.
  const [highlight, setHighlight] = useState<string | null>(focus?.anchor ?? null)
  useEffect(() => {
    if (!focus) return
    setTab(focus.tab)
    setHighlight(focus.anchor ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq])
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!highlight) return
    const frame = requestAnimationFrame(() => {
      listRef.current
        ?.querySelector(`[data-deck-anchor="${CSS.escape(highlight)}"]`)
        // A heading goes to the top, so the rows under it are in view; a row is centred.
        ?.scrollIntoView({ block: highlight.includes(':') ? 'center' : 'start', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [highlight, tab, focus?.seq])
  const switchTab = (next: ActionTab) => {
    setHighlight(null)
    setTab(next)
  }
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
      onChange={switchTab}
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
        onTabChange={switchTab}
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
        listRef={listRef}
        idPrefix={presentation}
        highlight={highlight}
      />
    </LayerShell>
  )
}
