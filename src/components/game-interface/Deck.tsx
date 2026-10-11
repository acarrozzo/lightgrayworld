'use client'

import { useMemo } from 'react'
import type { BattleState, InventoryItem, Player } from '@/lib/game-state'
import type { targetFromRoomEnemy } from '@/lib/action-deck'
import type { FilterTab, ItemFilterView } from '@/lib/inventory-categories'
import ActionLayer from './ActionLayer'
import InvLayer from './InvLayer'
import { DeckProvider, type DeckContextValue } from './LayerShell'
import WorldLayer, { type WorldTab } from './WorldLayer'
import type { MapConfigEntry } from './constants'
import type { DeckTab } from './deck-tabs'
import type { UnlockId } from '@/lib/unlocks'

type RoomEnemyLike = Parameters<typeof targetFromRoomEnemy>[0]

/**
 * Everything the World, Inv and Action layers draw from. GameInterface builds
 * it once and hands the same object to wherever one is drawn (the left column,
 * a phone page, the phone's Action sheet), so they never drift.
 */
export interface DeckContentProps {
  player: Player | null
  inventory: InventoryItem[]
  currentRoomId?: string
  /* What of the interface this character has earned, and what of it has just arrived. */
  openUnlocks: ReadonlySet<UnlockId>
  freshUnlocks: ReadonlySet<UnlockId>
  onSeenUnlocks: (ids: UnlockId[]) => void
  /* World */
  worldTab: WorldTab
  onWorldTabChange: (tab: WorldTab) => void
  currentMapId: string
  availableMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  onTeleport: (roomId: string) => void
  teleportBlockedReason?: string | null
  /* Inv */
  invView: ItemFilterView
  onInvViewChange: (view: ItemFilterView) => void
  invOpenId?: string | null
  newItemIds: Set<string>
  onClearNewItem: (itemId: string) => void
  onOpenCrafting?: () => void
  onAction: (action: string | { type: string; data?: any }) => void
  isLoggedIn: boolean
  /* Action. Each control is the same action the battle deck or the room card sends. */
  battle: BattleState
  roomEnemy: RoomEnemyLike
  isActing?: boolean
  onAttack: () => void
  onUseSkill: (skillId: string) => void
  onCastSpell: (spellId: string) => void
  onUseItem: (playerItemId: string, action: string) => void
  onOpenBook?: (tab: 'skills' | 'spells', highlightId?: string) => void
  /** Switch to the Inv tab, optionally filtered and with one item open. */
  onOpenInventory: (filter?: FilterTab, openItemId?: string) => void
}

/** The World, Inv or Action layer. Must be drawn inside a `DeckProvider`. */
export function DeckContent({ tab, ...props }: DeckContentProps & { tab: DeckTab }) {
  if (tab === 'world') {
    return (
      <WorldLayer
        tab={props.worldTab}
        onTabChange={props.onWorldTabChange}
        player={props.player}
        currentRoomId={props.currentRoomId}
        currentMapId={props.currentMapId}
        foundMaps={props.availableMaps}
        onMapChange={props.onMapChange}
        onTeleport={props.onTeleport}
        teleportBlockedReason={props.teleportBlockedReason}
      />
    )
  }
  if (!props.player) return null
  if (tab === 'inv') {
    return (
      <InvLayer
        inventory={props.inventory}
        player={props.player}
        disabled={props.isActing || !props.isLoggedIn}
        onAction={props.onAction}
        view={props.invView}
        onViewChange={props.onInvViewChange}
        initialOpenId={props.invOpenId}
        newItemIds={props.newItemIds}
        onClearNewItem={props.onClearNewItem}
        onOpenCrafting={props.onOpenCrafting}
        openUnlocks={props.openUnlocks}
        freshUnlocks={props.freshUnlocks}
        onSeenUnlocks={props.onSeenUnlocks}
      />
    )
  }
  return (
    <ActionLayer
      player={props.player}
      inventory={props.inventory}
      battle={props.battle}
      roomEnemy={props.roomEnemy}
      isActing={props.isActing}
      onAttack={props.onAttack}
      onUseSkill={props.onUseSkill}
      onCastSpell={props.onCastSpell}
      onUseItem={props.onUseItem}
      onOpenBook={props.onOpenBook}
      onOpenInventory={props.onOpenInventory}
      travel={
        props.openUnlocks.has('tab:world')
          ? { currentRoomId: props.currentRoomId, onTeleport: props.onTeleport, teleportBlockedReason: props.teleportBlockedReason ?? null }
          : undefined
      }
    />
  )
}

/** The bar the tabs sit in, pinned across the top of the left column. No fill of its own: it takes the panel's. */
export const DOCK_BAR = 'flex-shrink-0 border-b border-line-subtle/40 py-2'

interface ActionSheetProps {
  onClose: () => void
  content: DeckContentProps
}

/**
 * Action on a phone: a page over the room, the whole height of the area it
 * is placed in (GameInterface puts it between the header and the bottom bar,
 * so the bar stays in reach while it is up), as every tab's page is. It was
 * a half-height sheet; the lists need the room.
 */
export function ActionSheet({ onClose, content }: ActionSheetProps) {
  const context = useMemo<DeckContextValue>(() => ({ presentation: 'sheet', onClose }), [onClose])
  return (
    <div className="absolute inset-0 z-40 flex min-h-0 flex-col bg-surface-panel" role="dialog" aria-label="Action — attack, strikes, spells and items">
      <DeckProvider value={context}>
        <div className="flex min-h-0 flex-1 flex-col">
          <DeckContent tab="action" {...content} />
        </div>
      </DeckProvider>
    </div>
  )
}
