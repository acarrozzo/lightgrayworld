'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Icon from './Icon'
import { ChevronDown } from 'lucide-react'

export interface MapOption {
  id: string
  src: string
  title: string
}

interface MapContentProps {
  mapSrc: string
  mapTitle: string
  availableMaps?: MapOption[]
  currentMapId?: string
  onMapChange?: (mapId: string) => void
}

export default function MapContent({ mapSrc, mapTitle, availableMaps, currentMapId, onMapChange }: MapContentProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const pointerDownPositionRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)
  
  // Overflow dropdown state and refs
  const [visibleButtons, setVisibleButtons] = useState<MapOption[]>(availableMaps || [])
  const [dropdownButtons, setDropdownButtons] = useState<MapOption[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const buttonsContainerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const resetView = () => {
    setIsZoomed(false)
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    dragStartRef.current = null
    pointerDownPositionRef.current = null
    hasMovedRef.current = false
    pointerIdRef.current = null
  }

  useEffect(() => {
    resetView()
  }, [mapSrc])

  // Initialize visible buttons when availableMaps changes
  useEffect(() => {
    if (availableMaps && availableMaps.length > 0) {
      setVisibleButtons(availableMaps)
      setDropdownButtons([])
    }
  }, [availableMaps])

  // Calculate which buttons should be visible vs in dropdown
  const calculateButtonLayout = useCallback(() => {
    if (!buttonsContainerRef.current || !availableMaps || availableMaps.length === 0) {
      setVisibleButtons(availableMaps || [])
      setDropdownButtons([])
      return
    }

    const container = buttonsContainerRef.current
    const gap = 8 // gap-2 = 0.5rem = 8px

    // Measure each button's width
    const buttonWidths: Array<{ map: MapOption; width: number }> = []
    let totalWidth = 0

    for (const map of availableMaps) {
      const button = buttonRefs.current.get(map.id)
      if (button) {
        const rect = button.getBoundingClientRect()
        let width = rect.width > 0 ? rect.width : button.offsetWidth || 0
        
        // If width is 0, try to measure by temporarily making it visible
        if (width === 0) {
          const originalDisplay = button.style.display
          const originalVisibility = button.style.visibility
          const originalPosition = button.style.position
          button.style.display = 'block'
          button.style.visibility = 'hidden'
          button.style.position = 'absolute'
          button.style.top = '-9999px'
          const measuredWidth = button.offsetWidth || button.getBoundingClientRect().width || 0
          button.style.display = originalDisplay
          button.style.visibility = originalVisibility
          button.style.position = originalPosition
          button.style.top = ''
          
          if (measuredWidth > 0) {
            width = measuredWidth
          }
        }
        
        if (width > 0) {
          buttonWidths.push({ map, width })
          totalWidth += width + gap
        }
      }
    }

    // Get available width for the buttons container
    const containerRect = container.getBoundingClientRect()
    const availableWidth = containerRect.width

    // If we couldn't measure any buttons, show all (fallback)
    if (buttonWidths.length === 0) {
      setVisibleButtons(availableMaps)
      setDropdownButtons([])
      return
    }

    // Calculate dropdown button width (measure it if available, otherwise estimate)
    let dropdownButtonWidth = 60 // Default estimate
    const dropdownButton = buttonRefs.current.get('dropdown')
    if (dropdownButton) {
      const dropdownRect = dropdownButton.getBoundingClientRect()
      dropdownButtonWidth = dropdownRect.width > 0 ? dropdownRect.width : dropdownButton.offsetWidth || 60
    }

    // If all buttons fit without needing dropdown, show them all
    if (totalWidth <= availableWidth && buttonWidths.length === availableMaps.length) {
      setVisibleButtons(availableMaps)
      setDropdownButtons([])
      return
    }

    // Dynamically determine how many buttons can fit
    let fittingButtons: MapOption[] = []
    let fittingWidth = 0

    // Iterate through buttons in order, fitting as many as possible
    for (let i = 0; i < availableMaps.length; i++) {
      const buttonWidth = buttonWidths.find(b => b.map.id === availableMaps[i].id)?.width || 0
      if (buttonWidth === 0) continue // Skip if we couldn't measure
      
      // Check if we need space for dropdown button (if there are more buttons after this one)
      const hasMoreButtons = i < availableMaps.length - 1
      const spaceForDropdown = hasMoreButtons ? dropdownButtonWidth + gap : 0
      
      // Check if this button would fit
      const wouldFit = fittingWidth + buttonWidth + gap + spaceForDropdown <= availableWidth
      
      if (wouldFit) {
        fittingButtons.push(availableMaps[i])
        fittingWidth += buttonWidth + gap
      } else {
        // This button doesn't fit, stop here
        break
      }
    }

    // Edge case: If no buttons fit at all, show at least the first button + dropdown
    if (fittingButtons.length === 0 && availableMaps.length > 0) {
      const firstButton = availableMaps[0]
      const firstButtonWidth = buttonWidths.find(b => b.map.id === firstButton.id)?.width || 80
      // Only show first button if there's room for it + dropdown button
      if (firstButtonWidth + gap + dropdownButtonWidth <= availableWidth) {
        fittingButtons = [firstButton]
        fittingWidth = firstButtonWidth
      } else {
        // Even first button doesn't fit - show it anyway (better than nothing)
        fittingButtons = [firstButton]
        fittingWidth = firstButtonWidth
      }
    }

    // Move remaining buttons to dropdown
    const remainingButtons = availableMaps.filter(map => !fittingButtons.includes(map))
    
    setVisibleButtons(fittingButtons)
    setDropdownButtons(remainingButtons)
  }, [availableMaps])

  // Set up resize observer to detect when buttons would overflow
  useEffect(() => {
    if (!buttonsContainerRef.current) return

    const handleResize = () => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        calculateButtonLayout()
      })
    }

    const resizeObserver = new ResizeObserver(handleResize)

    // Observe the buttons container
    resizeObserver.observe(buttonsContainerRef.current)

    // Also observe the parent container to catch width changes
    const parentContainer = buttonsContainerRef.current.parentElement
    if (parentContainer) {
      resizeObserver.observe(parentContainer)
    }

    // Also observe window resize
    window.addEventListener('resize', handleResize)

    // Initial calculation with a small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      handleResize()
    }, 100)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
    }
  }, [calculateButtonLayout])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRefs.current.get('dropdown')?.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isDropdownOpen])

  const handleToggleZoom = () => {
    if (isZoomed) {
      resetView()
      return
    }

    setIsZoomed(true)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerDownPositionRef.current = { x: event.clientX, y: event.clientY }
    hasMovedRef.current = false
    pointerIdRef.current = event.pointerId

    if (!isZoomed) {
      dragStartRef.current = null
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    event.preventDefault()
    const startX = event.clientX - dragOffset.x
    const startY = event.clientY - dragOffset.y
    dragStartRef.current = { x: startX, y: startY }

    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerDownPositionRef.current) {
      const deltaX = event.clientX - pointerDownPositionRef.current.x
      const deltaY = event.clientY - pointerDownPositionRef.current.y
      if (!hasMovedRef.current && Math.hypot(deltaX, deltaY) > 4) {
        hasMovedRef.current = true
      }
    }

    if (!isZoomed || !isDragging || !dragStartRef.current) {
      return
    }

    event.preventDefault()
    const newX = event.clientX - dragStartRef.current.x
    const newY = event.clientY - dragStartRef.current.y
    setDragOffset({ x: newX, y: newY })
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) {
      try {
        event.currentTarget.releasePointerCapture(pointerIdRef.current)
      } catch (error) {
        // Pointer might already be released; ignore
      }
    }

    const wasZoomed = isZoomed
    const moved = hasMovedRef.current

    if (wasZoomed) {
      setIsDragging(false)
      dragStartRef.current = null
    }

    pointerIdRef.current = null
    pointerDownPositionRef.current = null
    hasMovedRef.current = false

    if (!moved) {
      if (wasZoomed) {
        resetView()
      } else {
        setIsZoomed(true)
      }
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Map Selector Buttons */}
      {availableMaps && availableMaps.length > 1 && (
        <div className="flex gap-2 border-b border-gray-700/50 pl-4 pr-12 md:pr-4 py-2 flex-shrink-0 relative">
            <div ref={buttonsContainerRef} className="flex-1 flex items-center justify-center gap-2 flex-nowrap">
              {/* Render visible buttons */}
              {visibleButtons.map((map) => {
                const isActive = currentMapId === map.id
                return (
                  <button
                    key={map.id}
                    ref={(el) => {
                      if (el) {
                        buttonRefs.current.set(map.id, el)
                      } else {
                        buttonRefs.current.delete(map.id)
                      }
                    }}
                    type="button"
                    onClick={() => {
                      onMapChange?.(map.id)
                      setIsDropdownOpen(false)
                    }}
                    className={`px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow flex-shrink-0 ${
                      isActive
                        ? 'border-1 border-sky-500 hover:border-sky-400 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300'
                        : 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {map.title}
                  </button>
                )
              })}
              
              {/* Dropdown button for overflow buttons */}
              {dropdownButtons.length > 0 && (
                <div className="relative flex-shrink-0" ref={dropdownRef}>
                  <button
                    ref={(el) => {
                      if (el) {
                        buttonRefs.current.set('dropdown', el)
                      } else {
                        buttonRefs.current.delete('dropdown')
                      }
                    }}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className={`px-2.5 py-1.5 h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow ${
                      dropdownButtons.some(map => currentMapId === map.id)
                        ? 'border-1 border-gray-500 hover:border-gray-400 bg-gray-500/10 hover:bg-gray-500/20 text-gray-300'
                        : 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <ChevronDown 
                      size={14} 
                      className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  
                  {/* Dropdown menu */}
                  {isDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg shadow-xl z-50 min-w-[140px] py-1">
                      {dropdownButtons.map((map) => {
                        const isActive = currentMapId === map.id
                        return (
                          <button
                            key={map.id}
                            onClick={() => {
                              onMapChange?.(map.id)
                              setIsDropdownOpen(false)
                            }}
                            className={`w-full px-2.5 py-1.5 text-sm font-medium transition-all duration-200 flex items-center gap-2 rounded-lg first:rounded-t-lg last:rounded-b-lg ${
                              isActive
                                ? 'border-1 border-sky-500 hover:border-sky-400 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300'
                                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                            }`}
                          >
                            <span className="flex-1 text-left">{map.title}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Hidden buttons for measurement - outside flex container */}
            <div className="absolute opacity-0 pointer-events-none" aria-hidden="true" style={{ visibility: 'hidden', position: 'absolute', top: '-9999px', left: '-9999px' }}>
              {availableMaps.map((map) => {
                // Only render buttons that aren't currently visible (to avoid duplicate refs)
                if (visibleButtons.includes(map)) return null
                
                const isActive = currentMapId === map.id
                return (
                  <button
                    key={`measure-${map.id}`}
                    ref={(el) => {
                      if (el) {
                        buttonRefs.current.set(map.id, el)
                      } else {
                        buttonRefs.current.delete(map.id)
                      }
                    }}
                    className={`px-2.5 py-1.5 h-8 text-sm font-medium flex items-center justify-center relative rounded-lg ${
                      isActive
                        ? 'border-1 border-sky-500 hover:border-sky-400 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300'
                        : 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {map.title}
                  </button>
                )
              })}
            </div>
          </div>
        )}

      {/* Map Content */}
      <div
        className={`flex-1 bg-gray-950/40 px-4 py-4 ${isZoomed ? 'overflow-hidden' : 'overflow-auto'} min-h-0 relative`}
      >
        {/* Zoom Button - Absolutely positioned in top right */}
        <button
          type="button"
          onClick={handleToggleZoom}
          className="absolute top-4 right-4 z-10 rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 shadow-lg"
        >
          {isZoomed ? 'Reset View' : 'Zoom In'}
        </button>
        
        <div className="flex h-full items-center justify-center py-4">
          <div
            className={`${isZoomed ? 'cursor-grab' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerLeave={(event) => {
              if (isDragging || pointerIdRef.current !== null) {
                endDrag(event)
              }
            }}
            onPointerCancel={(event) => {
              if (isDragging || pointerIdRef.current !== null) {
                endDrag(event)
              }
            }}
            style={{
              touchAction: isZoomed ? 'none' : 'auto',
              cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
          >
            <img
              src={mapSrc}
              alt={mapTitle}
              className={`rounded-xl shadow-inner ${
                isZoomed
                  ? 'max-h-none w-auto max-w-none'
                  : 'w-full max-w-full object-contain'
              }`}
              style={{
                transform: isZoomed ? `scale(1.4) translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
                transition: !isDragging ? 'transform 0.2s ease-out' : 'none',
                userSelect: 'none',
                pointerEvents: isZoomed ? 'none' : 'auto',
                maxHeight: isZoomed ? 'none' : '100%',
              }}
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

