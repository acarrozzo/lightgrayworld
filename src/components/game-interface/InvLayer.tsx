'use client'

import { useMemo } from 'react'
import Icon from '@/components/Icon'
import InventoryDisplay from '@/components/InventoryDisplay'
import type { InventoryItem, Player } from '@/lib/game-state'
import { createBooleanDeviceSetting } from '@/lib/device-setting'
import { effectiveStats } from '@/lib/effective-stats'
import { filterTabToView, getItemCategory, type FilterGroup, type FilterTab, type ItemFilterView } from '@/lib/inventory-categories'
import AutoEquipRow from './AutoEquipRow'
import CoreStatsGrid, { CoreStatsLine } from './CoreStatsGrid'
import EquipmentGrid from './EquipmentGrid'
import LayerShell, { HeaderTabs, ScrollEnd, useDeck } from './LayerShell'

/** The bag's four groups as the Inv tab's header sub-tabs. Equip is the main one. */
const GROUP_TABS: Array<{ id: FilterGroup; label: string }> = [
  { id: 'gear', label: 'Equip' },
  { id: 'consumables', label: 'Bag' },
  { id: 'crafting', label: 'Craft' },
  { id: 'misc', label: 'Misc' },
]

/** Whether the slots are drawn as the named grid instead of the icon strip. Per device. */
const useSlotNames = createBooleanDeviceSetting('lg:inv-slot-names')

interface InvLayerProps {
  inventory: InventoryItem[]
  /** For the stat line: the numbers the gear adds up to. */
  player: Player
  /** Held while an action resolves, or when not logged in. */
  disabled?: boolean
  onAction?: (action: string | { type: string; data?: any }) => void
  /**
   * The bag's filter. Owned by GameInterface so a link can open the tab on a
   * group or slot (the ledger's Weapons, the Action tab's bag link) and so it
   * survives the move between the column and full screen.
   */
  view: ItemFilterView
  onViewChange: (view: ItemFilterView) => void
  /** One item to open and scroll to on arrival. */
  initialOpenId?: string | null
  newItemIds: Set<string>
  onClearNewItem: (itemId: string) => void
  /** Present only while standing at a crafting table. */
  onOpenCrafting?: () => void
}

/**
 * The Inv tab: the inventory, what you are wearing and the stats it adds up
 * to, in one place. Three blocks that exist on their own — the stats, the
 * eleven slots with the MAX row, the bag — tied together by one rule: a slot
 * is a filter. The slots show what is worn and choose what the list shows;
 * each carries the count of what it would list, so the bag's own slot chips
 * are not repeated under them. The bag's toolbar is one line: search and
 * sort. The four groups are the header's sub-tabs:
 * Equip, Bag (consumables), Craft and Misc.
 *
 * In the column and the phone sheet the stats are a line and the slots an icon
 * strip (or the named grid, a per-device choice), so the list gets the height.
 * Full screen has the room for both at full size, side by side.
 */
export default function InvLayer({
  inventory,
  player,
  disabled = false,
  onAction,
  view,
  onViewChange: setView,
  initialOpenId = null,
  newItemIds,
  onClearNewItem,
  onOpenCrafting,
}: InvLayerProps) {
  const { presentation } = useDeck()
  const stats = useMemo(() => effectiveStats(player, inventory), [player, inventory])
  const [showNames, setShowNames] = useSlotNames()

  // What each slot would list, and whether any of it is new: drawn on the slots.
  const { slotCounts, slotNew } = useMemo(() => {
    const slotCounts: Record<string, number> = {}
    const slotNew: Record<string, number> = {}
    for (const item of inventory) {
      const category = getItemCategory(item)
      slotCounts[category] = (slotCounts[category] ?? 0) + 1
      if (newItemIds.has(item.id)) slotNew[category] = (slotNew[category] ?? 0) + 1
    }
    return { slotCounts, slotNew }
  }, [inventory, newItemIds])

  const selectedSlot = view.group === 'gear' && view.slot !== 'all' ? view.slot : null
  // Tapping the selected slot again goes back to every slot, as the bag's own chips did.
  const selectSlot = (slot: FilterTab) => setView(slot === selectedSlot ? { group: 'gear', slot: 'all' } : filterTabToView(slot))

  const maxRow = <AutoEquipRow disabled={disabled || !onAction} onAction={onAction} />
  const bag = (
    <InventoryDisplay
      inventory={inventory}
      onAction={onAction}
      newItemIds={newItemIds}
      onClearNewItem={onClearNewItem}
      showHeading={false}
      hideGroups
      hideSlots
      view={view}
      onViewChange={setView}
      initialOpenId={initialOpenId}
      onOpenCrafting={onOpenCrafting}
      className=""
    />
  )

  let body
  if (presentation === 'overlay') {
    body = (
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[420px] flex-shrink-0 flex-col gap-3 overflow-y-auto border-r border-line-subtle/40 p-4" aria-label="Stats and equipment">
          <CoreStatsGrid stats={stats} />
          {maxRow}
          <EquipmentGrid inventory={inventory} selected={selectedSlot} counts={slotCounts} newCounts={slotNew} onSelectSlot={selectSlot} />
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <div className="mx-auto max-w-[640px]">
            {bag}
            <ScrollEnd />
          </div>
        </div>
      </div>
    )
  } else {
    const loadout = (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <CoreStatsLine stats={stats} />
          <button
            type="button"
            onClick={() => setShowNames(!showNames)}
            aria-pressed={showNames}
            title={showNames ? 'Show the slots as a compact strip' : 'Show the slots with the names of what you are wearing'}
            className="ml-auto flex-shrink-0 rounded border border-line-subtle/50 px-2 py-0.5 text-[10px] font-medium text-fg-secondary transition-colors hover:border-line-strong/50 hover:bg-surface-raised/50 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {showNames ? 'Compact' : 'Names'}
          </button>
        </div>
        {maxRow}
        <EquipmentGrid inventory={inventory} density={showNames ? 'grid' : 'strip'} selected={selectedSlot} counts={slotCounts} newCounts={slotNew} onSelectSlot={selectSlot} />
      </div>
    )
    // The strip is short enough to stay put above the list; the named grid is
    // not, so it scrolls with it.
    body = showNames ? (
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
        {loadout}
        {bag}
        <ScrollEnd />
      </div>
    ) : (
      <>
        <div className="flex-shrink-0 border-b border-line-subtle/40 p-3">{loadout}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {bag}
          <ScrollEnd />
        </div>
      </>
    )
  }

  return (
    <LayerShell
      title="Inventory"
      icon={<Icon name="inv" size={15} color="current" />}
      toneClass="text-hue-green"
      lead={
        <HeaderTabs
          label="Equipment, Bag, Crafting or Misc"
          color="green"
          tabs={GROUP_TABS}
          active={view.group}
          home="gear"
          onChange={(group) => setView({ group, slot: 'all' })}
        />
      }
      flush
    >
      {body}
    </LayerShell>
  )
}
