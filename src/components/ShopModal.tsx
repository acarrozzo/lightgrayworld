'use client'

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Icon from './Icon'
import ActionFlyout, { type ActionFlyoutResult } from './ActionFlyout'
import ItemFilterBar from './ItemFilterBar'
import ItemRow, { EquippedDivider, GhostButton, ItemDrawer, NameTag } from './ItemRow'
import { useGearCompareSetting } from '@/lib/use-gear-compare'
import type { InventoryItem } from '@/lib/game-state'
import { getItemDisplayOrder } from '@/lib/inventory-utils'
import { getBuyPrice, getSellValue } from '@/lib/shop-pricing'
import {
  type ItemCategory,
  type ItemFilterView,
  type SortStat,
  FILTER_GROUPS,
  buildSections,
  compareToEquipped,
  countForGroup,
  getItemCategory,
  sortEquippedFirst,
  sortItems,
} from '@/lib/inventory-categories'
import { EquipSlot } from '@prisma/client'

interface ShopItem {
  id: string
  slug: string
  name: string
  description: string
  value: number
  type: string
  max?: number | null
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
 * Adapt a shop's stock entry into the shape the inventory rows use, so the buy
 * and sell tabs share ItemRow, the category grouping, sorting and the compare.
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
      max: item.max ?? 99,
      value: item.value,
      equipSlot: item.equipSlot ?? null,
      weaponCategory: item.weaponCategory ?? null,
      metadata: item.metadata ?? null,
    },
  }
}

type Catalog = {
  counts: Partial<Record<ItemCategory, number>>
  groups: Map<ItemCategory, InventoryItem[]>
  total: number
}

/** Group + sort a list of items into the inventory's category layout. */
function buildCatalog(items: InventoryItem[], sort: SortStat, orderMap: Map<string, number>): Catalog {
  const counts: Partial<Record<ItemCategory, number>> = {}
  const groups = new Map<ItemCategory, InventoryItem[]>()
  for (const item of items) {
    const category = getItemCategory(item)
    counts[category] = (counts[category] ?? 0) + 1
    const list = groups.get(category) ?? []
    list.push(item)
    groups.set(category, list)
  }
  for (const [category, list] of groups) {
    groups.set(category, sortEquippedFirst(sortItems(list, sort, orderMap, category)))
  }
  return { counts, groups, total: items.length }
}

const PRIMARY =
  'px-2.5 min-h-[30px] rounded-md text-xs font-semibold flex items-center whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md fill-status-success disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
const PRICE = 'font-mono text-[12.5px] font-semibold tabular-nums whitespace-nowrap min-w-[40px] text-right'
const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted px-0.5 mt-1'

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
  const [buyView, setBuyView] = useState<ItemFilterView>({ group: 'gear', slot: 'all' })
  const [buySort, setBuySort] = useState<SortStat>('none')
  const [sellView, setSellView] = useState<ItemFilterView>({ group: 'gear', slot: 'all' })
  const [sellSort, setSellSort] = useState<SortStat>('none')
  const [openId, setOpenId] = useState<string | null>(null)
  const [buyQty, setBuyQty] = useState(1)
  const [isBuying, setIsBuying] = useState(false)
  const [isSelling, setIsSelling] = useState(false)
  const [compareEnabled, setCompareEnabled] = useGearCompareSetting()
  // Transient result popover anchored above the clicked buy/sell button. We
  // reuse the same ActionFlyout the room actions use; the frozen anchorRect
  // keeps it in place even when the row unmounts (e.g. selling the last unit).
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

  useEffect(() => {
    setOpenId(null)
  }, [activeTab, isOpen])

  useEffect(() => {
    setBuyQty(1)
  }, [openId])

  const itemOrderMap = useMemo(() => getItemDisplayOrder(), [])

  // Buy catalog — adapt shop items, then group/sort like the inventory
  const buyItems = useMemo(() => shopItems.map(shopItemToCardItem), [shopItems])
  const buyCatalog = useMemo(() => buildCatalog(buyItems, buySort, itemOrderMap), [buyItems, buySort, itemOrderMap])

  // Sell catalog — everything sellable, equipped gear included (listed inert with the reason)
  const sellableInventory = useMemo(
    () => playerInventory.filter((item) => item.template.canSell !== false),
    [playerInventory]
  )
  const sellCatalog = useMemo(
    () => buildCatalog(sellableInventory, sellSort, itemOrderMap),
    [sellableInventory, sellSort, itemOrderMap]
  )

  // What the player already carries, by slug, for the "own 2" / "Wearing" tags
  const ownedBySlug = useMemo(() => {
    const owned = new Map<string, { quantity: number; equipped: boolean }>()
    for (const item of playerInventory) {
      const slug = item.template.slug
      const entry = owned.get(slug) ?? { quantity: 0, equipped: false }
      entry.quantity += item.quantity
      entry.equipped = entry.equipped || item.isEquipped
      owned.set(slug, entry)
    }
    return owned
  }, [playerInventory])

  const handleBuy = async (itemSlug: string, quantity: number, anchor: DOMRect) => {
    if (isBuying) return
    setIsBuying(true)
    try {
      const message = await onBuy(itemSlug, quantity)
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

  const toggleOpen = (id: string) => setOpenId((prev) => (prev === id ? null : id))

  /* ----------------------------------------------------------------------- */
  /* Buy rows                                                                 */
  /* ----------------------------------------------------------------------- */

  const renderBuyItem = (item: InventoryItem): ReactNode => {
    const unitPrice = getBuyPrice(item.template.value)
    const canAfford = playerCurrency >= unitPrice
    const owned = ownedBySlug.get(item.template.slug)
    const compare = compareEnabled ? compareToEquipped(item, playerInventory) : null
    const open = openId === item.id
    // Gear is bought one at a time; anything else can be bought in a batch.
    const stackable = !item.template.equipSlot
    const cap = item.template.max ?? 99
    const remaining = Math.max(0, cap - (owned?.quantity ?? 0))
    const maxQty = Math.max(1, Math.min(remaining, Math.floor(playerCurrency / Math.max(unitPrice, 1)), 99))
    const qty = Math.min(buyQty, maxQty)
    const total = unitPrice * qty

    const nameTag = owned ? (
      owned.equipped ? <NameTag tone="success">Wearing</NameTag> : <NameTag>own {owned.quantity}</NameTag>
    ) : null

    return (
      <div key={item.id} className="flex flex-col">
        <ItemRow
          item={item}
          open={open}
          onToggle={() => toggleOpen(item.id)}
          nameTag={nameTag}
          compare={compare}
          action={
            <>
              <span className={`${PRICE} ${canAfford ? 'text-resource-gold' : 'text-fg-disabled'}`}>{unitPrice}g</span>
              <button
                type="button"
                onClick={(event) => handleBuy(item.template.slug, 1, event.currentTarget.getBoundingClientRect())}
                disabled={!canAfford || isBuying}
                className={PRIMARY}
              >
                Buy
              </button>
            </>
          }
        />
        {open && (
          <ItemDrawer item={item} compare={compare}>
            {stackable && remaining > 0 && (
              <>
                <span className="inline-flex items-center rounded-md border border-line-strong overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setBuyQty(Math.max(1, qty - 1))}
                    disabled={qty <= 1}
                    aria-label="Fewer"
                    className="px-2.5 py-1 text-sm font-semibold text-fg-bright hover:bg-surface-raised/60 disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="min-w-[34px] text-center text-sm font-semibold text-fg-bright bg-surface-sunken tabular-nums py-1">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBuyQty(Math.min(maxQty, qty + 1))}
                    disabled={qty >= maxQty}
                    aria-label="More"
                    className="px-2.5 py-1 text-sm font-semibold text-fg-bright hover:bg-surface-raised/60 disabled:opacity-40"
                  >
                    +
                  </button>
                </span>
                <span className={`${PRICE} ${canAfford ? 'text-resource-gold' : 'text-fg-disabled'}`}>{total}g</span>
                <button
                  type="button"
                  onClick={(event) => handleBuy(item.template.slug, qty, event.currentTarget.getBoundingClientRect())}
                  disabled={!canAfford || isBuying}
                  className={`${PRIMARY} ml-auto`}
                >
                  Buy {qty}
                </button>
                {cap <= 999 && (
                  <span className="basis-full text-[11px] text-fg-muted italic">You can carry {remaining} more.</span>
                )}
              </>
            )}
            {stackable && remaining === 0 && (
              <span className="text-[11px] text-fg-muted italic">{'You can\'t carry any more of these.'}</span>
            )}
          </ItemDrawer>
        )}
      </div>
    )
  }

  /* ----------------------------------------------------------------------- */
  /* Sell rows                                                                */
  /* ----------------------------------------------------------------------- */

  const renderSellItem = (item: InventoryItem): ReactNode => {
    const unitValue = getSellValue(item.template.value)
    const equipped = item.isEquipped
    const open = openId === item.id
    const quantity = item.quantity
    const half = Math.ceil(quantity / 2)
    const options: Array<{ label: string; qty: number }> = []
    if (quantity > 1) {
      options.push({ label: '1', qty: 1 })
      if (half > 1 && half < quantity) options.push({ label: `Half · ${half}`, qty: half })
      if (quantity - 1 > 1 && quantity - 1 !== half) options.push({ label: `All but 1 · ${quantity - 1}`, qty: quantity - 1 })
      options.push({ label: `All · ${quantity}`, qty: quantity })
    }

    return (
      <div key={item.id} className="flex flex-col">
        <ItemRow
          item={item}
          open={open}
          onToggle={() => toggleOpen(item.id)}
          equipped={equipped}
          muted={equipped}
          subline={equipped ? <span className="text-[11px] text-fg-muted">Unequip to sell</span> : undefined}
          action={
            equipped ? (
              <span className={`${PRICE} text-fg-disabled`}>{unitValue}g</span>
            ) : (
              <>
                <span className={`${PRICE} text-resource-gold`}>{unitValue}g</span>
                <button
                  type="button"
                  onClick={(event) => handleSell(item.id, 1, event.currentTarget.getBoundingClientRect())}
                  disabled={isSelling}
                  className={PRIMARY}
                >
                  Sell
                </button>
              </>
            )
          }
        />
        {open && (
          <ItemDrawer
            item={item}
            equipped={equipped}
            meta={<span>{unitValue}g each</span>}
            hint={equipped ? 'Unequip it first to sell it.' : undefined}
          >
            {!equipped && options.length > 0 && (
              <>
                <span className="text-[11px] font-semibold text-status-success mr-0.5">Sell</span>
                {options.map((option) => (
                  <GhostButton
                    key={option.label}
                    tone="success"
                    disabled={isSelling}
                    onClick={() => {
                      const anchor = document.activeElement instanceof HTMLElement
                        ? document.activeElement.getBoundingClientRect()
                        : new DOMRect()
                      handleSell(item.id, option.qty, anchor)
                    }}
                  >
                    {option.label} · {unitValue * option.qty}g
                  </GhostButton>
                ))}
              </>
            )}
          </ItemDrawer>
        )}
      </div>
    )
  }

  /* ----------------------------------------------------------------------- */
  /* Shared catalog                                                           */
  /* ----------------------------------------------------------------------- */

  const renderCatalog = (opts: {
    catalog: Catalog
    view: ItemFilterView
    setView: (view: ItemFilterView) => void
    sort: SortStat
    setSort: (sort: SortStat) => void
    renderItem: (item: InventoryItem) => ReactNode
    emptyMessage: string
  }) => {
    const { catalog, setView, sort, setSort, renderItem, emptyMessage } = opts
    if (catalog.total === 0) {
      return <p className="text-sm text-fg-secondary py-4">{emptyMessage}</p>
    }
    // A shop only stocks a few groups; if the chosen one is empty here, show the first that is not.
    let view = opts.view
    if (countForGroup(catalog.counts, view.group) === 0) {
      const first = FILTER_GROUPS.find((group) => countForGroup(catalog.counts, group.id) > 0)
      if (first) view = { group: first.id, slot: 'all' }
    }
    const sections = buildSections(catalog.groups, view)
    const showSort = view.group !== 'crafting'
    return (
      <>
        <ItemFilterBar
          counts={catalog.counts}
          view={view}
          onChange={setView}
          hideEmpty
          sort={showSort ? sort : undefined}
          onSortChange={showSort ? setSort : undefined}
          compareEnabled={compareEnabled}
          onCompareChange={setCompareEnabled}
        />
        {sections.length === 0 ? (
          <p className="text-sm text-fg-secondary">Nothing in this group.</p>
        ) : (
          sections.map((section) => (
            <div key={section.key} className="flex flex-col gap-1.5">
              {section.title && (
                <h4 className={SECTION_TITLE}>
                  {section.title} · {section.items.length}
                </h4>
              )}
              {section.items.map((item, index) => (
                <Fragment key={item.id}>
                  {index > 0 && !item.isEquipped && section.items[index - 1].isEquipped && <EquippedDivider />}
                  {renderItem(item)}
                </Fragment>
              ))}
            </div>
          ))
        )}
      </>
    )
  }

  if (!isOpen) {
    return null
  }

  const tabClass = (tab: 'buy' | 'sell') =>
    `flex-1 px-4 py-2.5 text-xs font-semibold tracking-[0.06em] transition-colors ${
      activeTab === tab
        ? 'fill-surface-raised border-b-2 border-status-success'
        : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-raised/30'
    }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center lg:items-center lg:bg-surface-sunken/80 lg:backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full h-full flex-col overflow-hidden bg-surface-panel lg:h-[85vh] lg:w-[90vw] lg:max-w-2xl lg:rounded-lg lg:border lg:border-line-subtle/50 lg:shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={shopName || 'Shop'}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line-subtle/50">
          <h2 className="text-base font-semibold text-fg-bright truncate">{shopName || 'Shop'}</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md border border-resource-gold/50 bg-resource-gold/20 text-resource-gold text-sm font-semibold tabular-nums">
              {playerCurrency}g
            </span>
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

        <div className="flex border-b border-line-subtle/50">
          <button type="button" onClick={() => setActiveTab('buy')} className={tabClass('buy')}>
            BUY · {shopItems.length}
          </button>
          <button type="button" onClick={() => setActiveTab('sell')} className={tabClass('sell')}>
            SELL · {sellableInventory.length}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 flex flex-col gap-3">
          {activeTab === 'buy'
            ? renderCatalog({
                catalog: buyCatalog,
                view: buyView,
                setView: setBuyView,
                sort: buySort,
                setSort: setBuySort,
                renderItem: renderBuyItem,
                emptyMessage: 'No items available for purchase.',
              })
            : renderCatalog({
                catalog: sellCatalog,
                view: sellView,
                setView: setSellView,
                sort: sellSort,
                setSort: setSellSort,
                renderItem: renderSellItem,
                emptyMessage: 'You have no items to sell.',
              })}
        </div>

        <div className="border-t border-line-subtle/50 px-4 py-2.5 text-right">
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
