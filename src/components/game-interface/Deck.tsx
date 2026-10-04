'use client'

import { useMemo, type ReactNode } from 'react'
import type { BattleState, InventoryItem, Player } from '@/lib/game-state'
import type { targetFromRoomEnemy } from '@/lib/action-deck'
import type { FilterTab, ItemFilterView } from '@/lib/inventory-categories'
import ActionLayer from './ActionLayer'
import InvLayer from './InvLayer'
import { DeckProvider, type DeckContextValue } from './LayerShell'
import WorldLayer, { type WorldTab } from './WorldLayer'
import type { MapConfigEntry } from './constants'
import { deckTabConfig, type DeckTab } from './deck-tabs'

type RoomEnemyLike = Parameters<typeof targetFromRoomEnemy>[0]

/**
 * Everything the deck's tabs draw from. GameInterface builds it once and
 * hands the same object to the Explore column, the full-screen layer and the
 * phone sheet, so the three never drift.
 */
export interface DeckContentProps {
  player: Player | null
  inventory: InventoryItem[]
  currentRoomId?: string
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

/** One deck tab's layer. Must be drawn inside a `DeckProvider`. */
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
    />
  )
}

/** The bar the tabs sit in, pinned across the top of the column and of a full-screen layer. */
export const DOCK_BAR = 'flex-shrink-0 border-b border-line-subtle/40 bg-surface-sunken/40 py-2'

// How much of the phone's page each layer takes. World and Inv are tabs, so
// they fill it like every other tab's page; Action is Explore's own utility
// and rises as a sheet over the room, only as tall as it needs.
const SHEET_SIZE: Record<DeckTab, string> = {
  world: 'h-full',
  inv: 'h-full',
  action: 'max-h-[88%] rounded-t-2xl border-t border-line-strong',
}

interface DeckProps {
  /** The Explore column docks a layer itself; this draws the two forms that float over the page. */
  presentation: 'overlay' | 'sheet'
  tab: DeckTab
  onClose: () => void
  onToggleFullscreen?: () => void
  /** overlay: the tab bar, pinned above the layer as it is above the column. */
  bar?: ReactNode
  content: DeckContentProps
}

/**
 * A deck layer away from the Explore column. Full screen on a wide display,
 * with the tab bar pinned above it. On a phone, a sheet that fills the page
 * area it is placed in (GameInterface puts it between the header and the
 * bottom bar, so the bar stays in reach while the sheet is up).
 */
export default function Deck({ presentation, tab, onClose, onToggleFullscreen, bar, content }: DeckProps) {
  const context = useMemo<DeckContextValue>(
    () => ({ presentation, onClose, onToggleFullscreen }),
    [presentation, onClose, onToggleFullscreen],
  )
  const label = deckTabConfig(tab).title

  if (presentation === 'overlay') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-surface-canvas/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={label}>
        {bar && <div className={DOCK_BAR}>{bar}</div>}
        <DeckProvider value={context}>
          <div className="flex min-h-0 flex-1 flex-col">
            <DeckContent tab={tab} {...content} />
          </div>
        </DeckProvider>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end" role="dialog" aria-label={label}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-surface-canvas/60 backdrop-blur-[2px]" />
      <div className={`relative flex min-h-0 flex-col shadow-2xl shadow-black/50 ${tab === 'action' ? 'bg-surface-overlay' : 'bg-surface-panel'} ${SHEET_SIZE[tab]}`}>
        {tab === 'action' && <div className="mx-auto mt-2 h-1 w-9 flex-shrink-0 rounded-full bg-line-strong" aria-hidden="true" />}
        <DeckProvider value={context}>
          <div className="flex min-h-0 flex-1 flex-col">
            <DeckContent tab={tab} {...content} />
          </div>
        </DeckProvider>
      </div>
    </div>
  )
}
