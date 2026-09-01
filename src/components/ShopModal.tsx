'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'
import InventorySellButton from './InventorySellButton'
import ItemCardShell from './ItemCardShell'
import StatSortControl from './StatSortControl'
import ActionFlyout, { type ActionFlyoutResult } from './ActionFlyout'
import type { InventoryItem } from '@/lib/game-state'
import { getItemDisplayOrder } from '@/lib/inventory-utils'
import { getBuyPrice, getSellValue } from '@/lib/shop-pricing'
import {
  type FilterTab,
  type SortStat,
  getItemCategory,
  getCraftingKind,
  sortItems,
  INVENTORY_TABS,
  CATEGORY_DISPLAY_ORDER,
} from '@/lib/inventory-categories'
import { EquipSlot } from '@prisma/client'

interface ShopItem {
  id: string
  slug: string
  name: string
  description: string
  value: number
  type: string
  equipSlot?: EquipSlot | null
  weaponCategory?: InventoryItem['template']['weaponCategory']
  metadata?: InventoryItem['template']['metadata']
}

interface ShopModalProps {
  isOpen: boolean
  onClose: () => void
  /** The shop's own name, from the shop registry. Falls back to "Shop". */
  shopName?: string
  shopItems: ShopItem[]
  playerCurrency: number
  playerInventory: InventoryItem[]
  /** Resolves with the server's result message (used for the flyout + feed). */
  onBuy: (itemSlug: string, quantity?: number) => Promise<string>
  onSell: (playerItemId: string, quantity: number) => Promise<string>
}

/**
 * Adapt a shop's buy item into the same shape the inventory cards use, so the
 * buy and sell tabs can share ItemCardShell, the category grouping and sorting.
 */
function shopItemToCardItem(item: ShopItem): InventoryItem {
  return {
    id: item.id,
    quantity: 1,
    isEquipped: false,
    slot: null,
    template: {
      id: item.id,
      slug: item.slug,
      name: item.name,
      type: item.type,
      description: item.description,
      max: 99,
      value: item.value,
      equipSlot: item.equipSlot ?? null,
      weaponCategory: item.weaponCategory ?? null,
      metadata: item.metadata ?? null,
    },
  }
}

type CategoryView = {
  counts: Record<string, number>
  groups: Map<string, InventoryItem[]>
  visibleTabs: typeof INVENTORY_TABS
}

// Crafting items are shown in fixed subsections (materials first, then tools)
// rather than via filter chips, mirroring the inventory.
const CRAFTING_SUBSECTIONS: Array<{ kind: 'material' | 'tool'; label: string }> = [
  { kind: 'material', label: 'Materials' },
  { kind: 'tool', label: 'Tools' },
]

/** Group + sort a list of items into the inventory's category layout. */
function buildCategoryView(
  items: InventoryItem[],
  sort: SortStat,
  orderMap: Map<string, number>
): CategoryView {
  const counts: Record<string, number> = { all: items.length }
  const groups = new Map<string, InventoryItem[]>()
  for (const item of items) {
    const category = getItemCategory(item)
    counts[category] = (counts[category] || 0) + 1
    const list = groups.get(category) ?? []
    list.push(item)
    groups.set(category, list)
  }
  for (const [category, list] of groups) {
    groups.set(category, sortItems(list, sort, orderMap))
  }
  const visibleTabs = INVENTORY_TABS.filter(
    (tab) => tab.id === 'all' || (counts[tab.id] || 0) > 0
  )
  return { counts, groups, visibleTabs }
}

export default function ShopModal({
  isOpen,
  onClose,
  shopName,
  shopItems,
  playerCurrency,
  playerInventory,
  onBuy,
  onSell,
}: ShopModalProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [buyFilter, setBuyFilter] = useState<FilterTab>('all')
  const [buySort, setBuySort] = useState<SortStat>('none')
  const [sellFilter, setSellFilter] = useState<FilterTab>('all')
  const [sellSort, setSellSort] = useState<SortStat>('none')
  const [isBuying, setIsBuying] = useState(false)
  const [isSelling, setIsSelling] = useState(false)
  // Transient result popover anchored above the clicked buy/sell button. We
  // reuse the same ActionFlyout the room actions use; the frozen anchorRect
  // keeps it in place even when the card unmounts (e.g. selling the last unit).
  const [flyout, setFlyout] = useState<{
    result: ActionFlyoutResult
    rect: { top: number; left: number }
  } | null>(null)
  const flyoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dismissFlyout = () => {
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current)
    flyoutTimer.current = null
    setFlyout(null)
  }

  const showFlyout = (result: ActionFlyoutResult, anchor: DOMRect) => {
    if (flyoutTimer.current) clearTimeout(flyoutTimer.current)
    setFlyout({ result, rect: { top: anchor.top, left: anchor.left } })
    flyoutTimer.current = setTimeout(() => {
      setFlyout(null)
      flyoutTimer.current = null
    }, 5000)
  }

  useEffect(() => {
    return () => {
      if (flyoutTimer.current) clearTimeout(flyoutTimer.current)
    }
  }, [])

  const itemOrderMap = useMemo(() => getItemDisplayOrder(), [])

  // Buy catalog — adapt shop items, then group/sort like the inventory
  const buyItems = useMemo(() => shopItems.map(shopItemToCardItem), [shopItems])
  const buyView = useMemo(
    () => buildCategoryView(buyItems, buySort, itemOrderMap),
    [buyItems, buySort, itemOrderMap]
  )

  // Sell catalog — only sellable inventory, grouped/sorted the same way
  const sellableInventory = useMemo(
    () => playerInventory.filter((item) => item.template.canSell !== false),
    [playerInventory]
  )
  const sellView = useMemo(
    () => buildCategoryView(sellableInventory, sellSort, itemOrderMap),
    [sellableInventory, sellSort, itemOrderMap]
  )

  const handleBuy = async (itemSlug: string, anchor: DOMRect) => {
    if (isBuying) return

    setIsBuying(true)
    try {
      const message = await onBuy(itemSlug, 1)
      showFlyout({ outcome: 'success', message }, anchor)
    } catch (err: any) {
      showFlyout({ outcome: 'failure', message: err?.message || 'Failed to purchase item' }, anchor)
    } finally {
      setIsBuying(false)
    }
  }

  const handleSell = async (playerItemId: string, quantity: number, anchor: DOMRect) => {
    if (isSelling) return

    setIsSelling(true)
    try {
      const message = await onSell(playerItemId, quantity)
      showFlyout({ outcome: 'success', message }, anchor)
    } catch (err: any) {
      showFlyout({ outcome: 'failure', message: err?.message || 'Failed to sell item' }, anchor)
    } finally {
      setIsSelling(false)
    }
  }

  // Footer for a buy card: price + Buy button
  const renderBuyFooter = (item: InventoryItem) => {
    const buyPrice = getBuyPrice(item.template.value)
    const canAfford = playerCurrency >= buyPrice
    return (
      <div className="mt-1 space-y-1">
        <div className="text-[11px] text-fg-secondary/80">
          <span className="text-resource-gold font-medium">{buyPrice}g</span>
        </div>
        <button
          onClick={(e) => handleBuy(item.template.slug, e.currentTarget.getBoundingClientRect())}
          disabled={!canAfford || isBuying}
          className={`w-full flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
            canAfford
              ? 'fill-status-success disabled:opacity-50 disabled:cursor-not-allowed'
              : 'bg-surface-hover/50 text-fg-secondary cursor-not-allowed'
          }`}
        >
          Buy
        </button>
      </div>
    )
  }

  // Footer for a sell card: unit value + sell buttons
  const renderSellFooter = (item: InventoryItem) => {
    const sellValue = getSellValue(item.template.value)
    return (
      <div className="mt-1 space-y-1">
        <div className="text-[11px] text-fg-secondary/80">
          <span className="text-status-success font-medium">{sellValue}g</span> each
        </div>
        <InventorySellButton
          item={item}
          onSell={(quantity, anchor) => handleSell(item.id, quantity, anchor)}
          disabled={isSelling}
        />
      </div>
    )
  }

  // Shared catalog: filter tabs + stat sort + grouped/flat cards. Used by both
  // the buy and sell tabs; each supplies its own per-item footer.
  const renderCatalog = (opts: {
    view: CategoryView
    filter: FilterTab
    setFilter: (tab: FilterTab) => void
    sort: SortStat
    setSort: (sort: SortStat) => void
    renderFooter: (item: InventoryItem) => ReactNode
  }) => {
    const { view, filter, setFilter, sort, setSort, renderFooter } = opts
    const flatItems = view.groups.get(filter) || []
    return (
      <>
        {/* Filter tabs — same categories as the inventory */}
        <div className="flex gap-2 flex-wrap">
          {view.visibleTabs.map((tab) => {
            const isActive = filter === tab.id
            const count = view.counts[tab.id] || 0
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'fill-resource-mp border border-resource-mp/50'
                    : 'fill-surface-raised border border-line-subtle/50 hover:border-line-strong/50'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-normal ${isActive ? 'text-fg-bright/60' : 'text-fg-secondary/60'}`}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Stat sort — shared with the inventory; hidden for crafting items */}
        {filter !== 'crafting' && <StatSortControl value={sort} onChange={setSort} />}

        {filter === 'all' ? (
          // Grouped by category with headers, matching the inventory
          <div className="space-y-4">
            {CATEGORY_DISPLAY_ORDER.filter(
              (category) => (view.groups.get(category)?.length || 0) > 0
            ).map((category) => {
              const items = view.groups.get(category) || []
              const label = INVENTORY_TABS.find((t) => t.id === category)?.label || category
              return (
                <div key={category} className="space-y-2">
                  <h4 className="text-sm font-semibold text-fg-primary px-2">
                    {label.charAt(0).toUpperCase() + label.slice(1)} ({items.length})
                  </h4>
                  <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                    {items.map((item) => (
                      <ItemCardShell key={item.id} item={item} footer={renderFooter(item)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : filter === 'crafting' ? (
          // Crafting items grouped into Materials, then Tools subsections
          <div className="space-y-4">
            {CRAFTING_SUBSECTIONS.map(({ kind, label }) => {
              const sectionItems = flatItems.filter((item) => getCraftingKind(item) === kind)
              if (sectionItems.length === 0) return null
              return (
                <div key={kind} className="space-y-2">
                  <h4 className="text-sm font-semibold text-fg-primary px-2">
                    {label} ({sectionItems.length})
                  </h4>
                  <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                    {sectionItems.map((item) => (
                      <ItemCardShell key={item.id} item={item} footer={renderFooter(item)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Flat list for a specific category
          <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {flatItems.map((item) => (
              <ItemCardShell key={item.id} item={item} footer={renderFooter(item)} />
            ))}
          </div>
        )}
      </>
    )
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-surface-sunken/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[85vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-lg border border-line-subtle/50 bg-surface-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-line-subtle/50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-fg-bright">{shopName || 'Shop'}</h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-resource-gold/30 border border-resource-gold/50 rounded-md">
                <Icon name="coin" size={16} className="text-resource-gold" />
                <span className="text-resource-gold font-medium">{playerCurrency}g</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-fg-secondary transition-colors hover:text-fg-bright hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
              aria-label="Close shop"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-line-subtle/50">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'buy'
                ? 'fill-surface-raised border-b-2 border-status-success'
                : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-raised/30'
            }`}
          >
            BUY ({shopItems.length})
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sell'
                ? 'fill-surface-raised border-b-2 border-status-success'
                : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-raised/30'
            }`}
          >
            SELL ({sellableInventory.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          {activeTab === 'buy' ? (
            /* Buy Section */
            <div className="space-y-4">
              {buyItems.length === 0 ? (
                <div className="text-fg-secondary text-sm py-4">
                  No items available for purchase.
                </div>
              ) : (
                renderCatalog({
                  view: buyView,
                  filter: buyFilter,
                  setFilter: setBuyFilter,
                  sort: buySort,
                  setSort: setBuySort,
                  renderFooter: renderBuyFooter,
                })
              )}
            </div>
          ) : (
            /* Sell Section */
            <div className="space-y-4">
              {sellableInventory.length === 0 ? (
                <div className="text-fg-secondary text-sm py-4">
                  You have no items to sell.
                </div>
              ) : (
                renderCatalog({
                  view: sellView,
                  filter: sellFilter,
                  setFilter: setSellFilter,
                  sort: sellSort,
                  setSort: setSellSort,
                  renderFooter: renderSellFooter,
                })
              )}
            </div>
          )}
        </div>

        <div className="border-t border-line-subtle/50 px-4 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded fill-surface-hover px-4 py-1.5 text-sm font-medium transition-colors hover:bg-surface-selected focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
          >
            Close
          </button>
        </div>
      </div>

      {/* Result popover above the clicked buy/sell button — same component the
          room actions use, so the text matches the world feed entry. */}
      {flyout && (
        <ActionFlyout result={flyout.result} anchorRect={flyout.rect} onDismiss={dismissFlyout} />
      )}
    </div>
  )
}
