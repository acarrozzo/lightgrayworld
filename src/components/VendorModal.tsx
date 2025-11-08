'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/game-state'
import Icon from './Icon'

interface VendorItem {
  itemId: string
  itemName: string
  price: number
  stockQuantity?: number | null
}

interface VendorCatalogResponse {
  vendorId: string
  vendorName?: string
  description?: string
  playerCurrency?: number
  items: VendorItem[]
}

interface VendorModalProps {
  isOpen: boolean
  vendorId: string | null
  vendorName?: string
  onClose: () => void
  getAuthHeaders: () => Record<string, string>
  onPurchaseSuccess?: (payload: { itemId: string; quantity: number; cost: number }) => void
}

export default function VendorModal({
  isOpen,
  vendorId,
  vendorName,
  onClose,
  getAuthHeaders,
  onPurchaseSuccess,
}: VendorModalProps) {
  const { player } = useGameStore()
  const [catalog, setCatalog] = useState<VendorCatalogResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !vendorId) {
      setCatalog(null)
      setQuantities({})
      setMessage(null)
      setError(null)
      return
    }

    let isCancelled = false

    const loadCatalog = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/game/vendor/${vendorId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to load vendor (status ${response.status})`)
        }

        const data = (await response.json()) as VendorCatalogResponse
        if (!isCancelled) {
          setCatalog(data)
          setQuantities(
            Object.fromEntries(data.items.map((item) => [item.itemId, 1] as const))
          )
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[VendorModal] Failed to load vendor catalog', err)
          setError('Failed to load vendor catalog. Please try again.')
        }
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }

    loadCatalog()

    return () => {
      isCancelled = true
    }
  }, [getAuthHeaders, isOpen, vendorId])

  const title = useMemo(() => {
    if (catalog?.vendorName) return catalog.vendorName
    if (vendorName) return vendorName
    return 'Vendor'
  }, [catalog?.vendorName, vendorName])

  const playerCurrency = catalog?.playerCurrency ?? null

  const handleQuantityChange = (itemId: string, value: number) => {
    setQuantities((prev) => ({
      ...prev,
      [itemId]: Math.max(1, Math.floor(value || 1)),
    }))
  }

  const handlePurchase = async (item: VendorItem) => {
    if (!vendorId) return
    const quantity = quantities[item.itemId] ?? 1
    setIsPurchasing(item.itemId)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(`/api/game/vendor/${vendorId}/buy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          itemId: item.itemId,
          quantity,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.message || `Purchase failed (status ${response.status})`)
      }

      const result = await response.json()

      setCatalog((prev) => {
        if (!prev) return prev
        const updatedItems = prev.items.map((catalogItem) => {
          if (catalogItem.itemId !== item.itemId) return catalogItem
          if (catalogItem.stockQuantity === null || catalogItem.stockQuantity === undefined) {
            return catalogItem
          }
          return {
            ...catalogItem,
            stockQuantity: Math.max(0, (catalogItem.stockQuantity ?? 0) - quantity),
          }
        })
        return {
          ...prev,
          playerCurrency:
            typeof result.currency === 'number' ? result.currency : prev.playerCurrency,
          items: updatedItems,
        }
      })

      setMessage(`Purchased ${quantity} × ${item.itemName} for ${item.price * quantity}g.`)
      onPurchaseSuccess?.({
        itemId: item.itemId,
        quantity,
        cost: item.price * quantity,
      })
    } catch (err) {
      console.error('[VendorModal] Purchase error', err)
      setError((err as Error).message || 'Purchase failed. Please try again.')
    } finally {
      setIsPurchasing(null)
    }
  }

  if (!isOpen || !vendorId) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="relative flex h-[90vh] w-[90vw] max-w-4xl flex-col overflow-hidden rounded-2xl border border-purple-500/40 bg-gray-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {catalog?.description && (
              <p className="text-sm text-gray-400">{catalog.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            aria-label="Close vendor"
          >
            <Icon name="x" size={24} />
          </button>
        </div>

        <div className="border-b border-gray-800 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-gray-300">
              {playerCurrency !== null ? (
                <span>
                  Your coins:{' '}
                  <span className="font-semibold text-yellow-300">{playerCurrency}</span>
                </span>
              ) : (
                <span>Welcome, {player?.username ?? 'traveler'}.</span>
              )}
            </div>
            {message && (
              <div className="rounded-full bg-emerald-600/20 px-4 py-1 text-sm text-emerald-300">
                {message}
              </div>
            )}
            {error && (
              <div className="rounded-full bg-red-600/20 px-4 py-1 text-sm text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              Loading wares...
            </div>
          ) : catalog && catalog.items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {catalog.items.map((item) => {
                const quantity = quantities[item.itemId] ?? 1
                const totalCost = item.price * quantity
                const outOfStock =
                  item.stockQuantity !== null &&
                  item.stockQuantity !== undefined &&
                  item.stockQuantity <= 0
                const exceedsStock =
                  item.stockQuantity !== null &&
                  item.stockQuantity !== undefined &&
                  quantity > item.stockQuantity
                const insufficientFunds =
                  playerCurrency !== null && totalCost > playerCurrency
                return (
                  <div
                    key={item.itemId}
                    className="flex flex-col justify-between rounded-xl border border-purple-500/20 bg-gray-800/60 p-4 shadow-lg transition-shadow hover:shadow-xl"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-white">{item.itemName}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-300">
                        <p>
                          Price:{' '}
                          <span className="font-medium text-yellow-200">{item.price}</span> each
                        </p>
                        {item.stockQuantity !== null && item.stockQuantity !== undefined && (
                          <p>
                            Stock:{' '}
                            <span
                              className={
                                item.stockQuantity > 0 ? 'text-green-300' : 'text-red-300'
                              }
                            >
                              {item.stockQuantity}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <label className="flex items-center justify-between text-sm text-gray-300">
                        <span>Quantity</span>
                        <input
                          type="number"
                          min={1}
                          value={quantity}
                          onChange={(event) =>
                            handleQuantityChange(item.itemId, Number(event.target.value))
                          }
                          className="w-24 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          disabled={outOfStock}
                        />
                      </label>

                      <div className="flex items-center justify-between text-sm text-gray-300">
                        <span>Total</span>
                        <span className="font-semibold text-yellow-300">{totalCost}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePurchase(item)}
                        disabled={
                          isPurchasing === item.itemId || outOfStock || exceedsStock || insufficientFunds
                        }
                        className="flex w-full items-center justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-purple-900/60"
                      >
                        {outOfStock
                          ? 'Sold Out'
                          : exceedsStock
                          ? 'Not enough stock'
                          : insufficientFunds
                          ? 'Not enough coins'
                          : isPurchasing === item.itemId
                          ? 'Processing...'
                          : `Buy for ${totalCost}`}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
              <Icon name="basicshop" size={48} className="mb-3 text-gray-600" />
              <p>This vendor has nothing available right now. Check back later!</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-800 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-gray-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

