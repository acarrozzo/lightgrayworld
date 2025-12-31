'use client'

import { useState } from 'react'
import Icon from './Icon'
import InventorySellButton from './InventorySellButton'
import type { InventoryItem } from '@/lib/game-state'

interface ShopItem {
  id: string
  slug: string
  name: string
  description: string
  value: number
  type: string
}

interface ShopModalProps {
  isOpen: boolean
  onClose: () => void
  shopItems: ShopItem[]
  playerCurrency: number
  playerInventory: InventoryItem[]
  onBuy: (itemSlug: string, quantity?: number) => Promise<void>
  onSell: (playerItemId: string, quantity: number) => Promise<void>
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
  const [isBuying, setIsBuying] = useState(false)
  const [isSelling, setIsSelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Filter inventory to only show sellable items
  const sellableInventory = playerInventory.filter(
    (item) => item.template.canSell !== false
  )

  const handleBuy = async (itemSlug: string) => {
    if (isBuying) return
    
    setIsBuying(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await onBuy(itemSlug, 1)
      setSuccessMessage('Purchase successful!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to purchase item')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsBuying(false)
    }
  }

  const handleSell = async (playerItemId: string, quantity: number) => {
    if (isSelling) return
    
    setIsSelling(true)
    setError(null)
    setSuccessMessage(null)

    try {
      await onSell(playerItemId, quantity)
      setSuccessMessage('Item sold successfully!')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to sell item')
      setTimeout(() => setError(null), 3000)
    } finally {
      setIsSelling(false)
    }
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

        {/* Error/Success Messages */}
        {(error || successMessage) && (
          <div className={`px-4 py-2 ${error ? 'bg-red-900/30 border-b border-red-800/50' : 'bg-green-900/30 border-b border-green-800/50'}`}>
            <p className={`text-sm ${error ? 'text-red-300' : 'text-green-300'}`}>
              {error || successMessage}
            </p>
          </div>
        )}

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
              {shopItems.length === 0 ? (
                <div className="text-gray-400 text-sm py-4">
                  No items available for purchase.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shopItems.map((item) => {
                    const canAfford = playerCurrency >= item.value
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col rounded bg-gray-800/40 p-3 border border-gray-700/30 gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium">
                            {item.name}
                          </div>
                          <div className="text-gray-400 text-xs mt-0.5 line-clamp-2">
                            {item.description}
                          </div>
                          <div className="text-amber-400 text-xs mt-2 font-medium">
                            {item.value}g
                          </div>
                        </div>
                        <button
                          onClick={() => handleBuy(item.slug)}
                          disabled={!canAfford || isBuying}
                          className={`w-full px-3 py-2 text-xs font-medium rounded transition-colors ${
                            canAfford
                              ? 'bg-green-600/70 hover:bg-green-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                              : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {isBuying ? '...' : 'Buy'}
                        </button>
                      </div>
                    )
                  })}
                </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sellableInventory.map((item) => {
                    const sellValue = Math.floor(item.template.value * 0.1)
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col rounded bg-gray-800/40 p-3 border border-gray-700/30 gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium">
                            {item.template.name}
                          </div>
                          {item.quantity > 1 && (
                            <div className="text-gray-400 text-xs mt-0.5">x{item.quantity}</div>
                          )}
                          <div className="text-green-400 text-xs mt-2 font-medium">
                            Sell value: {sellValue}g each
                          </div>
                        </div>
                        <div className="flex justify-center">
                          <InventorySellButton
                            item={item}
                            onSell={(quantity) => handleSell(item.id, quantity)}
                            disabled={isSelling}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
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
    </div>
  )
}

