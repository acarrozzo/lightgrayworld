'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '@/components/Icon'
import InventoryDisplay from '@/components/InventoryDisplay'
import NotificationBadge from '@/components/NotificationBadge'
import type { InventoryItem, Player } from '@/lib/game-state'
import { createBooleanDeviceSetting } from '@/lib/device-setting'
import { effectiveStats } from '@/lib/effective-stats'
import {
  compareToEquipped,
  countForGroup,
  filterTabToView,
  getItemCategory,
  getStatMods,
  isTwoHanded,
  type FilterGroup,
  type FilterTab,
  type ItemFilterView,
} from '@/lib/inventory-categories'
import type { UnlockId } from '@/lib/unlocks'
import AutoEquipRow from './AutoEquipRow'
import CoreStatsGrid, { CoreStatsLine, type StatPreview } from './CoreStatsGrid'
import EquipmentGrid from './EquipmentGrid'
import LayerShell, { HeaderTabs, ScrollEnd, useDeck } from './LayerShell'

/** Whether the slots are drawn as the named grid instead of the icon strip. Per device. */
const useSlotNames = createBooleanDeviceSetting('lg:inv-slot-names')

/**
 * How wide the tab must be before the loadout and the bag sit side by side.
 * The left column can be dragged this wide; a phone never is.
 */
export const INV_TWO_COLUMN_WIDTH = 700

/**
 * The bag's four groups as the Inv tab's header sub-tabs. Gear is the main
 * one and comes with the tab; each of the others arrives with the first thing
 * that belongs in it.
 */
const GROUP_TABS: Array<{ id: FilterGroup; label: string; unlock?: UnlockId }> = [
  { id: 'gear', label: 'Gear' },
  { id: 'consumables', label: 'Items', unlock: 'inv:consumables' },
  { id: 'crafting', label: 'Craft', unlock: 'inv:crafting' },
  { id: 'misc', label: 'Misc', unlock: 'inv:misc' },
]

const STAT_KEYS = ['str', 'dex', 'mag', 'def'] as const

/** How many equippable items a character must carry before the MAX row is offered. */
const MAX_ROW_MIN_GEAR = 5

/** Past this many equippable items the bag is long enough to want a search box. */
const SEARCH_MIN_GEAR = 20

interface InvLayerProps {
  inventory: InventoryItem[]
  /** For the stat line: the numbers the gear adds up to. */
  player: Player
  /** Held while an action resolves, or when not logged in. */
  disabled?: boolean
  onAction?: (action: string | { type: string; data?: any }) => void
  /**
   * The bag's filter. Owned by GameInterface so a link can open the tab on a
   * group or slot (the corner's weapon line, the Actions tab's bag link, a
   * feed line about an item).
   */
  view: ItemFilterView
  onViewChange: (view: ItemFilterView) => void
  /** One item to open and scroll to on arrival. */
  initialOpenId?: string | null
  newItemIds: Set<string>
  onClearNewItem: (itemId: string) => void
  /** Present only while standing at a crafting table. */
  onOpenCrafting?: () => void
  /** What of the interface this character has earned; a group not earned yet has no sub-tab. */
  openUnlocks: ReadonlySet<UnlockId>
  /** Sub-tabs that have just arrived and not been opened. */
  freshUnlocks: ReadonlySet<UnlockId>
  onSeenUnlocks: (ids: UnlockId[]) => void
}

/** The width of an element, kept current. 0 until measured. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.clientWidth)
    const observer = new ResizeObserver((entries) => setWidth(entries[0]?.contentRect.width ?? element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * The Inv tab: the inventory, what you are wearing and the stats it adds up
 * to, in one place. Three blocks that exist on their own — the stats, the
 * eleven slots with the MAX row, the bag — tied together by one rule: a slot
 * is a filter. The slots show what is worn and choose what the list shows;
 * each carries the count of what it would list, so the bag's own slot chips
 * are not repeated under them. The bag's toolbar is one line: search and
 * sort. The four groups are the header's sub-tabs: Gear, Items (things to eat,
 * drink and use), Craft and Misc.
 *
 * Opening an item previews it: the stats show what each total would become
 * with it on (or, for something worn, with it off), before anything is spent.
 *
 * Narrow, the stats are a line and the slots an icon strip (or the named
 * grid, a per-device choice), so the list gets the height. Drag the column
 * wide and both go to full size, side by side with the bag.
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
  openUnlocks,
  freshUnlocks,
  onSeenUnlocks,
}: InvLayerProps) {
  const { presentation } = useDeck()
  const [bodyRef, bodyWidth] = useWidth<HTMLDivElement>()
  const twoColumn = presentation === 'docked' && bodyWidth >= INV_TWO_COLUMN_WIDTH
  const stats = useMemo(() => effectiveStats(player, inventory), [player, inventory])
  const [showNames, setShowNames] = useSlotNames()
  const [openItem, setOpenItem] = useState<InventoryItem | null>(null)

  // What each slot and group would list, and whether any of it is new.
  const { counts, newCounts } = useMemo(() => {
    const counts: Record<string, number> = {}
    const newCounts: Record<string, number> = {}
    for (const item of inventory) {
      const category = getItemCategory(item)
      counts[category] = (counts[category] ?? 0) + 1
      if (newItemIds.has(item.id)) newCounts[category] = (newCounts[category] ?? 0) + 1
    }
    return { counts, newCounts }
  }, [inventory, newItemIds])

  // The stats as they would be with the open item put on — or, if it is worn,
  // taken off. Gear moves the gear column and can move the passive skills
  // that read what is in hand, so the whole formula is run again on the
  // loadout as it would be.
  const preview = useMemo<StatPreview | null>(() => {
    if (!openItem || !openItem.template.equipSlot) return null
    const mine = getStatMods(openItem)
    let losing: InventoryItem[]
    let sign: 1 | -1
    if (openItem.isEquipped) {
      losing = [openItem]
      sign = -1
    } else {
      const compare = compareToEquipped(openItem, inventory)
      if (!compare || compare.blockedBy) return null
      losing = compare.replaces
      sign = 1
    }
    const lost = new Set(losing.map((item) => item.id))
    const after = inventory.map((item) => {
      if (lost.has(item.id)) return { ...item, isEquipped: false }
      if (sign === 1 && item.id === openItem.id) return { ...item, isEquipped: true, slot: openItem.template.equipSlot }
      return item
    }) as InventoryItem[]
    const gear = { ...player } as Player
    for (const key of STAT_KEYS) {
      const gained = sign === 1 ? mine[key] ?? 0 : 0
      const dropped = losing.reduce((sum, item) => sum + (getStatMods(item)[key] ?? 0), 0)
      const modKey = `${key}Mod` as 'strMod' | 'dexMod' | 'magMod' | 'defMod'
      gear[modKey] = (player[modKey] ?? 0) + gained - dropped
    }
    const next = effectiveStats(gear, after)
    const result: StatPreview = {}
    let moved = false
    for (const key of STAT_KEYS) {
      if (next[key].total !== stats[key].total) {
        result[key] = next[key].total
        moved = true
      }
    }
    return moved ? result : null
  }, [openItem, inventory, player, stats])

  const previewNote = !openItem || !preview ? null : openItem.isEquipped ? `Without ${openItem.template.name}` : `With ${openItem.template.name}${isTwoHanded(openItem) ? ' (two hands)' : ''}`

  const selectedSlot = view.group === 'gear' && view.slot !== 'all' ? view.slot : null
  // Tapping the selected slot again goes back to every slot, as the bag's own chips did.
  const selectSlot = (slot: FilterTab) => setView(slot === selectedSlot ? { group: 'gear', slot: 'all' } : filterTabToView(slot))

  const groupTabs = GROUP_TABS.filter((tab) => !tab.unlock || openUnlocks.has(tab.unlock))
  const selectGroup = (group: FilterGroup) => {
    const tab = GROUP_TABS.find((entry) => entry.id === group)
    if (tab?.unlock) onSeenUnlocks([tab.unlock])
    setView({ group, slot: 'all' })
  }

  // "Put on my best" means nothing until there is a best to choose: the MAX
  // row waits for a fifth piece of gear.
  const gearCount = useMemo(() => inventory.filter((item) => item.template.equipSlot).length, [inventory])
  const maxRow = gearCount >= MAX_ROW_MIN_GEAR ? <AutoEquipRow disabled={disabled || !onAction} onAction={onAction} /> : null
  const bag = (
    <InventoryDisplay
      inventory={inventory}
      onAction={onAction}
      newItemIds={newItemIds}
      onClearNewItem={onClearNewItem}
      showHeading={false}
      hideGroups
      hideSlots
      hideSearch={gearCount <= SEARCH_MIN_GEAR}
      view={view}
      onViewChange={setView}
      initialOpenId={initialOpenId}
      onOpenItemChange={setOpenItem}
      onOpenCrafting={onOpenCrafting}
      className=""
    />
  )
  const previewLine = previewNote && <p className="truncate text-[10px] text-fg-muted">{previewNote}</p>

  // MAX and the slots are about what you wear: they belong to Gear. Items,
  // Craft and Misc keep the stat line and are otherwise just their list.
  const onGear = view.group === 'gear'

  let body
  if (!onGear) {
    body = (
      <>
        <div className="flex-shrink-0 border-b border-line-subtle/40 px-3 py-2">
          <CoreStatsLine stats={stats} preview={preview} />
          {previewLine}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {bag}
          <ScrollEnd />
        </div>
      </>
    )
  } else if (twoColumn) {
    body = (
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[48%] min-w-[340px] max-w-[520px] flex-shrink-0 flex-col gap-3 overflow-y-auto border-r border-line-subtle/40 p-3" aria-label="Stats and equipment">
          <div className="flex flex-col gap-1">
            <CoreStatsGrid stats={stats} preview={preview} />
            {previewLine}
          </div>
          {maxRow}
          <EquipmentGrid inventory={inventory} selected={selectedSlot} counts={counts} newCounts={newCounts} onSelectSlot={selectSlot} />
          <ScrollEnd />
        </aside>
        <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {bag}
          <ScrollEnd />
        </div>
      </div>
    )
  } else {
    const loadout = (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-start gap-2">
            <CoreStatsLine stats={stats} preview={preview} />
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
          {previewLine}
        </div>
        {maxRow}
        <EquipmentGrid
          inventory={inventory}
          density={showNames ? 'grid' : 'strip'}
          selected={selectedSlot}
          counts={counts}
          newCounts={newCounts}
          onSelectSlot={selectSlot}
        />
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
      // With only Gear earned there is nothing to switch between: the tab wears its name.
      lead={
        groupTabs.length > 1 ? (
          <HeaderTabs
            label="Gear, Items, Craft or Misc"
            color="green"
            active={view.group}
            home="gear"
            onChange={selectGroup}
            tabs={groupTabs.map((tab) => {
              const count = countForGroup(counts, tab.id)
              const hasNew = countForGroup(newCounts, tab.id) > 0 || (tab.unlock !== undefined && freshUnlocks.has(tab.unlock))
              return {
                id: tab.id,
                label: tab.label,
                extra: (
                  <>
                    {count > 0 && <span className="ml-1 text-[10px] font-normal tabular-nums opacity-70">{count}</span>}
                    <NotificationBadge value={hasNew} className="absolute -right-1 -top-1" />
                  </>
                ),
              }
            })}
          />
        ) : undefined
      }
      flush
    >
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col">
        {body}
      </div>
    </LayerShell>
  )
}
