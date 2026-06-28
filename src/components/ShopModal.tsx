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

type CraftingKindFilter = 'all' | 'tool' | 'material'

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
  shopItems,
  playerCurrency,
  playerInventory,
  onBuy,
  onSell,
}: ShopModalProps) {
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy')
  const [buyFilter, setBuyFilter] = useState<FilterTab>('all')
  const [buySort, setBuySort] = useState<SortStat>('none')
  const [buyCraftingKind, setBuyCraftingKind] = useState<CraftingKindFilter>('all')
  const [sellFilter, setSellFilter] = useState<FilterTab>('all')
  const [sellSort, setSellSort] = useState<SortStat>('none')
  const [sellCraftingKind, setSellCraftingKind] = useState<CraftingKindFilter>('all')
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
        <div className="text-[11px] text-gray-400/80">
          <span className="text-amber-400 font-medium">{buyPrice}g</span>
        </div>
        <button
          onClick={(e) => handleBuy(item.template.slug, e.currentTarget.getBoundingClientRect())}
          disabled={!canAfford || isBuying}
          className={`w-full flex items-center justify-center px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 shadow-sm hover:shadow-md ${
            canAfford
              ? 'bg-green-600/80 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
              : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
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
        <div className="text-[11px] text-gray-400/80">
          <span className="text-green-400 font-medium">{sellValue}g</span> each
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
    craftingKind: CraftingKindFilter
    setCraftingKind: (kind: CraftingKindFilter) => void
    renderFooter: (item: InventoryItem) => ReactNode
  }) => {
    const { view, filter, setFilter, sort, setSort, craftingKind, setCraftingKind, renderFooter } = opts
    // Apply the tool/material sub-filter to the flat crafting list.
    const flatItems = (view.groups.get(filter) || []).filter((item) => {
      if (filter !== 'crafting' || craftingKind === 'all') return true
      return getCraftingKind(item) === craftingKind
    })
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
                onClick={() => {
                  setFilter(tab.id)
                  if (tab.id !== 'crafting') setCraftingKind('all')
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-all duration-200 whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-500/70 hover:bg-blue-500 text-white border border-blue-400/50'
                    : 'bg-gray-800/50 hover:bg-gray-800/70 text-gray-300 border border-gray-700/50 hover:border-gray-600/50'
                }`}
              >
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={`text-[10px] font-normal ${isActive ? 'text-white/60' : 'text-gray-400/60'}`}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Stat sort — shared with the inventory */}
        <StatSortControl value={sort} onChange={setSort} />

        {/* Crafting sub-filters — mirror the inventory's tool/material chips */}
        {filter === 'crafting' && (
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'tool', 'material'] as CraftingKindFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setCraftingKind(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-all duration-200 ${
                  craftingKind === f
                    ? 'bg-violet-600/70 hover:bg-violet-600 text-white border border-violet-500/50'
                    : 'bg-gray-800/50 hover:bg-gray-800/70 text-gray-400 border border-gray-700/50 hover:border-gray-600/50'
                }`}
              >
                {f === 'all' ? 'All Types' : f === 'tool' ? 'Tools' : 'Materials'}
              </button>
            ))}
          </div>
        )}

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
                  <h4 className="text-sm font-semibold text-gray-300 px-2">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[85vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-lg border border-gray-700/50 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="border-b border-gray-700/50">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Shop</h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-900/30 border border-amber-800/50 rounded-md">
                <Icon name="coin" size={16} className="text-amber-400" />
                <span className="text-amber-300 font-medium">{playerCurrency}g</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 text-gray-400 transition-colors hover:text-white hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              aria-label="Close shop"
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700/50">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'buy'
                ? 'bg-gray-800/50 text-white border-b-2 border-green-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
            }`}
          >
            BUY ({shopItems.length})
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sell'
                ? 'bg-gray-800/50 text-white border-b-2 border-green-500'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
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
                <div className="text-gray-400 text-sm py-4">
                  No items available for purchase.
                </div>
              ) : (
                renderCatalog({
                  view: buyView,
                  filter: buyFilter,
                  setFilter: setBuyFilter,
                  sort: buySort,
                  setSort: setBuySort,
                  craftingKind: buyCraftingKind,
                  setCraftingKind: setBuyCraftingKind,
                  renderFooter: renderBuyFooter,
                })
              )}
            </div>
          ) : (
            /* Sell Section */
            <div className="space-y-4">
              {sellableInventory.length === 0 ? (
                <div className="text-gray-400 text-sm py-4">
                  You have no items to sell.
                </div>
              ) : (
                renderCatalog({
                  view: sellView,
                  filter: sellFilter,
                  setFilter: setSellFilter,
                  sort: sellSort,
                  setSort: setSellSort,
                  craftingKind: sellCraftingKind,
                  setCraftingKind: setSellCraftingKind,
                  renderFooter: renderSellFooter,
                })
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-700/50 px-4 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-gray-700 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
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
