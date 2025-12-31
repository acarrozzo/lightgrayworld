'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface InventorySellButtonProps {
  item: {
    id: string
    template: {
      name: string
      description?: string
      canSell?: boolean
      value: number
    }
    quantity: number
  }
  onSell: (quantity: number) => void
  disabled?: boolean
}

export default function InventorySellButton({
  item,
  onSell,
  disabled = false,
}: InventorySellButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  const handleMainButtonClick = () => {
    if (isDisabled) return
    onSell(1)
    setIsOpen(false)
  }

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (disabled) return
    setIsOpen(!isOpen)
  }

  const handleSellHalf = () => {
    if (isDisabled || item.quantity <= 1) return
    const halfQuantity = Math.ceil(item.quantity / 2)
    onSell(halfQuantity)
    setIsOpen(false)
  }

  const handleSellAll = () => {
    if (isDisabled || item.quantity <= 1) return
    onSell(item.quantity)
    setIsOpen(false)
  }

  const showQuantityOptions = item.quantity > 1
  const cannotSell = item.template.canSell === false
  const isDisabled = disabled || cannotSell

  // Calculate sell values (10% of item value)
  const sellValuePerItem = Math.floor(item.template.value * 0.1)
  const sellValue1 = sellValuePerItem
  const sellValueHalf = Math.floor(sellValuePerItem * Math.ceil(item.quantity / 2))
  const sellValueAll = Math.floor(sellValuePerItem * item.quantity)

  return (
    <div className="relative inline-block" ref={buttonRef}>
      <div className="flex items-stretch">
        {/* Main button - only show if item can be sold */}
        {!cannotSell && (
          <button
            onClick={handleMainButtonClick}
            disabled={disabled}
            className="px-2 py-1 text-xs bg-green-600/70 hover:bg-green-600 rounded-l-md text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            Sell
          </button>
        )}
        
        {/* Dropdown toggle button */}
        <button
          onClick={handleDropdownToggle}
          disabled={disabled}
          className={`px-1.5 py-1 bg-green-600/70 hover:bg-green-600 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            cannotSell ? 'rounded-md' : 'rounded-r-md border-l border-green-500/30'
          }`}
          aria-label="More options"
        >
          <ChevronDown size={12} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-gray-800 rounded-md shadow-lg border border-gray-700 overflow-hidden"
        >
          <div className="py-1">
            {/* Sell options - only show if item can be sold */}
            {!cannotSell && (
              <>
                <button
                  onClick={handleMainButtonClick}
                  disabled={disabled}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                >
                  <span>Sell 1</span>
                  <span className="text-green-400 text-xs ml-2">{sellValue1}g</span>
                </button>
                
                {showQuantityOptions && (
                  <>
                    <button
                      onClick={handleSellHalf}
                      disabled={disabled}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                    >
                      <span>Sell half</span>
                      <span className="text-green-400 text-xs ml-2">{sellValueHalf}g</span>
                    </button>
                    <button
                      onClick={handleSellAll}
                      disabled={disabled}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between"
                    >
                      <span>Sell all</span>
                      <span className="text-green-400 text-xs ml-2">{sellValueAll}g</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

