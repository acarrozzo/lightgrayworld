'use client'

import { useState, ReactNode, useEffect, useRef, useCallback } from 'react'
import React from 'react'
import Icon from './Icon'
import NotificationBadge from './NotificationBadge'
import { ChevronDown } from 'lucide-react'
import { getTabIconColorClass, getTabButtonColorClasses } from '@/lib/tabColors'

export interface TabConfig {
  id: string
  label: string
  icon?: string | ReactNode
  color?: string
  content?: ReactNode | ((isActive: boolean) => ReactNode)
  badge?: boolean | number
}

interface TabContainerProps {
  tabs: TabConfig[]
  defaultTab?: string | null
  activeTab?: string | null
  onClose?: () => void
  onTabChange?: (tabId: string | null) => void
  closeButtonPlacement?: 'integrated' | 'separate'
  closeButtonBreakpoint?: 'lg' | 'xl'
  headerClassName?: string
  contentClassName?: string
  containerClassName?: string
  buttonPadding?: string
  leftElement?: ReactNode
  rightElement?: ReactNode
  wrap?: boolean
}

export default function TabContainer({
  tabs,
  defaultTab,
  activeTab: controlledActiveTab,
  onClose,
  onTabChange,
  closeButtonPlacement = 'separate',
  closeButtonBreakpoint = 'xl',
  headerClassName = '',
  contentClassName = '',
  containerClassName = '',
  buttonPadding = 'px-2.5 py-1.5',
  leftElement,
  rightElement,
  wrap = false,
}: TabContainerProps) {
  const [internalActiveTab, setInternalActiveTab] = useState<string | null>(defaultTab ?? tabs[0]?.id ?? null)
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab
  const [visibleTabs, setVisibleTabs] = useState<TabConfig[]>(tabs)
  const [dropdownTabs, setDropdownTabs] = useState<TabConfig[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const leftElementRef = useRef<HTMLDivElement>(null)
  const rightElementRef = useRef<HTMLDivElement>(null)

  const handleTabChange = (tabId: string) => {
    // Toggle behavior: if clicking the active tab, close it (set to null)
    const newActiveTab = activeTab === tabId ? null : tabId
    if (controlledActiveTab === undefined) {
      setInternalActiveTab(newActiveTab)
    }
    onTabChange?.(newActiveTab)
    // Close dropdown when a tab is selected
    setIsDropdownOpen(false)
  }

  // Sync initial tab state with parent on mount
  useEffect(() => {
    const initialTab = defaultTab ?? tabs[0]?.id ?? null
    onTabChange?.(initialTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Sync internal state when controlled activeTab changes
  useEffect(() => {
    if (controlledActiveTab !== undefined && controlledActiveTab !== internalActiveTab) {
      setInternalActiveTab(controlledActiveTab)
    }
  }, [controlledActiveTab, internalActiveTab])

  // Calculate which tabs should be visible vs in dropdown
  const calculateTabLayout = useCallback(() => {
    if (!tabsContainerRef.current) return

    const container = tabsContainerRef.current
    const gap = 8 // gap-2 = 0.5rem = 8px

    // Measure each tab's width (all tabs should be rendered, even if invisible)
    const tabWidths: Array<{ tab: TabConfig; width: number }> = []
    let totalWidth = 0

    for (const tab of tabs) {
      const button = tabRefs.current.get(tab.id)
      if (button) {
        // Get width even if element is hidden - use getBoundingClientRect or offsetWidth
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
          tabWidths.push({ tab, width })
          totalWidth += width + gap
        }
      }
    }

    // Subtract the last gap (we added gap after every tab, but last tab doesn't need one)
    if (tabWidths.length > 0) {
      totalWidth -= gap
    }

    // Account for bullet point separator after explore tab (if first tab is explore)
    if (tabs.length > 0 && tabs[0].id === 'explore') {
      const bulletWidth = 4  // w-1 = 0.25rem = 4px
      totalWidth += bulletWidth + gap  // bullet + gap = 12px total
    }

    // Get available width for the tabs container
    // Calculate by getting parent width and subtracting leftElement/rightElement widths
    let availableWidth = container.getBoundingClientRect().width
    
    // If we have a header ref, use it to get the parent container width
    // and subtract the widths of leftElement and rightElement containers
    if (headerRef.current) {
      const headerRect = headerRef.current.getBoundingClientRect()
      const headerWidth = headerRect.width
      
      let leftElementWidth = 0
      if (leftElementRef.current && leftElement) {
        const leftRect = leftElementRef.current.getBoundingClientRect()
        leftElementWidth = leftRect.width > 0 ? leftRect.width : leftElementRef.current.offsetWidth || 0
      }
      
      let rightElementWidth = 0
      if (rightElementRef.current) {
        const rightRect = rightElementRef.current.getBoundingClientRect()
        rightElementWidth = rightRect.width > 0 ? rightRect.width : rightElementRef.current.offsetWidth || 0
      }
      
      // Calculate available width: parent width - leftElement - rightElement - gaps
      // gap-2 = 8px, and there are gaps between leftElement, tabs, and rightElement
      // Only account for gaps if the elements actually have width
      const gapsBetweenElements = (leftElementWidth > 0 ? gap : 0) + (rightElementWidth > 0 ? gap : 0)
      availableWidth = headerWidth - leftElementWidth - rightElementWidth - gapsBetweenElements - 30
    }

    // If we couldn't measure any tabs, show all (fallback)
    if (tabWidths.length === 0) {
      setVisibleTabs(tabs)
      setDropdownTabs([])
      return
    }

    // Calculate dropdown button width (measure it if available, otherwise estimate)
    let dropdownButtonWidth = 60 // Default estimate
    const dropdownButton = tabRefs.current.get('dropdown')
    if (dropdownButton) {
      const dropdownRect = dropdownButton.getBoundingClientRect()
      dropdownButtonWidth = dropdownRect.width > 0 ? dropdownRect.width : dropdownButton.offsetWidth || 60
    }

    // If all tabs fit without needing dropdown, show them all
    // Use < with small buffer to account for rounding
    if (totalWidth < availableWidth - 2 && tabWidths.length === tabs.length) {
      setVisibleTabs(tabs)
      setDropdownTabs([])
      return
    }

    // Dynamically determine how many tabs can fit
    // Strategy: Fit as many tabs as possible, accounting for dropdown button if needed
    let fittingTabs: TabConfig[] = []
    let fittingWidth = 0

    // Iterate through tabs in order, fitting as many as possible
    for (let i = 0; i < tabs.length; i++) {
      const tabWidth = tabWidths.find(t => t.tab.id === tabs[i].id)?.width || 0
      if (tabWidth === 0) continue // Skip if we couldn't measure
      
      // Check if we need space for dropdown button (if there are more tabs after this one)
      const hasMoreTabs = i < tabs.length - 1
      const spaceForDropdown = hasMoreTabs ? dropdownButtonWidth + gap : 0
      
      // Account for bullet point if this is the first tab and it's explore
      const bulletSpace = (i === 0 && tabs[0].id === 'explore') ? 4 + gap : 0
      
      // Check if this tab would fit
      const wouldFit = fittingWidth + tabWidth + gap + spaceForDropdown + bulletSpace <= availableWidth
      
      if (wouldFit) {
        fittingTabs.push(tabs[i])
        fittingWidth += tabWidth + gap + bulletSpace
      } else {
        // This tab doesn't fit, stop here
        break
      }
    }

    // Edge case: If no tabs fit at all, show at least the first tab + dropdown
    // This ensures the UI is always usable, even at very narrow widths
    if (fittingTabs.length === 0 && tabs.length > 0) {
      const firstTab = tabs[0]
      const firstTabWidth = tabWidths.find(t => t.tab.id === firstTab.id)?.width || 80
      // Only show first tab if there's room for it + dropdown button
      if (firstTabWidth + gap + dropdownButtonWidth <= availableWidth) {
        fittingTabs = [firstTab]
        fittingWidth = firstTabWidth
      } else {
        // Even first tab doesn't fit - show it anyway (better than nothing)
        fittingTabs = [firstTab]
        fittingWidth = firstTabWidth
      }
    }

    // Move remaining tabs to dropdown
    const remainingTabs = tabs.filter(tab => !fittingTabs.includes(tab))
    
    setVisibleTabs(fittingTabs)
    setDropdownTabs(remainingTabs)
  }, [tabs])

  // Set up resize observer to detect when tabs would wrap
  useEffect(() => {
    if (!tabsContainerRef.current) return

    const handleResize = () => {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        calculateTabLayout()
      })
    }

    const resizeObserver = new ResizeObserver(handleResize)

    // Observe the tabs container
    resizeObserver.observe(tabsContainerRef.current)

    // Also observe the parent container (header) to catch width changes
    const parentContainer = tabsContainerRef.current.parentElement
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
  }, [calculateTabLayout])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !tabRefs.current.get('dropdown')?.contains(event.target as Node)
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

  const breakpointClass = closeButtonBreakpoint === 'lg' ? 'lg:hidden' : 'xl:hidden'

  const getIconColorClass = (tab: TabConfig, isActive: boolean): string =>
    getTabIconColorClass(tab.color, isActive)

  const getButtonColorClasses = (tab: TabConfig, isActive: boolean): string =>
    getTabButtonColorClasses(tab.color, isActive)

  const renderTabContent = () => {
    if (!activeTab) return null
    
    const activeTabConfig = tabs.find(tab => tab.id === activeTab)
    if (!activeTabConfig) return null

    const content = activeTabConfig.content
    if (typeof content === 'function') {
      return content(activeTab === activeTabConfig.id)
    }
    return content
  }

  // Determine if headerClassName overrides padding
  const hasPaddingOverride = headerClassName && /p[xy]?-[0-9]|p-0/.test(headerClassName)
  const defaultHeaderPadding = hasPaddingOverride ? 'pb-4' : 'p-4'

  return (
    <div className={`flex-1 flex flex-col min-h-0 ${containerClassName}`}>
      {/* Tab Navigation */}
      <div ref={headerRef} className={`relative z-10 hidden md:flex gap-2 ${defaultHeaderPadding} bg-gray-900/95 backdrop-blur-sm flex-shrink-0 flex-wrap justify-between items-center ${headerClassName}`}>
        {/* Left side elements */}
        {leftElement && (
          <div ref={leftElementRef} className="flex items-center gap-2 flex-shrink-0">
            {leftElement}
          </div>
        )}
        
        {/* Centered tabs */}
        <div ref={tabsContainerRef} className={`flex-1 flex items-center justify-left md:justify-center gap-2 px-0 ${wrap ? 'flex-wrap' : 'flex-nowrap lg:pr-[56px] xl:px-0'}`}>
          {/* max-w-[848px] lg:max-w-[904px] xl:max-w-[848px] */}

          {/* Render visible tabs */}
          {(wrap ? tabs : visibleTabs).map((tab, index) => {
            const isActive = activeTab === tab.id
            const isFirstExploreTab = !wrap && index === 0 && tab.id === 'explore'
            return (
              <React.Fragment key={tab.id}>
                <button
                  ref={(el) => {
                    if (el) {
                      tabRefs.current.set(tab.id, el)
                    } else {
                      tabRefs.current.delete(tab.id)
                    }
                  }}
                  onClick={() => handleTabChange(tab.id)}
                  className={wrap
                    ? `${buttonPadding} flex-1 basis-0 min-w-[56px] text-[11px] font-medium transition-all duration-200 flex flex-col items-center justify-center gap-1 relative rounded-lg shadow-sm hover:shadow ${getButtonColorClasses(tab, isActive)}`
                    : `${buttonPadding} h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow flex-shrink-0 ${getButtonColorClasses(tab, isActive)}`
                  }
                >
                  {tab.icon && (
                    typeof tab.icon === 'string' ? (
                      <Icon
                        name={tab.icon}
                        size={wrap ? 18 : 14}
                        color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color === 'sky' ? 'sky' : tab.color)}
                        className={!wrap && tab.label ? "mr-1" : ""}
                      />
                    ) : (
                      <span className={`${!wrap && tab.label ? "mr-1" : ""} ${getIconColorClass(tab, isActive)}`}>
                        {React.cloneElement(tab.icon as React.ReactElement<any>, {
                          size: wrap ? 18 : undefined,
                          className: `${getIconColorClass(tab, isActive)} ${((tab.icon as React.ReactElement<any>).props as any)?.className || ''}`.trim()
                        })}
                      </span>
                    )
                  )}
                  {wrap
                    ? <span className="leading-none">{tab.label || '\u00A0'}</span>
                    : tab.label && <span>{tab.label}</span>
                  }
                  <NotificationBadge value={tab.badge} className="absolute -top-1 -right-1" />
                </button>
                {isFirstExploreTab && (
                  <span className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0" aria-hidden="true" />
                )}
              </React.Fragment>
            )
          })}
          
          {/* Dropdown button for overflow tabs */}
          {!wrap && dropdownTabs.length > 0 && (
            <div className="relative flex-1" ref={dropdownRef}>
              <button
                ref={(el) => {
                  if (el) {
                    tabRefs.current.set('dropdown', el)
                  } else {
                    tabRefs.current.delete('dropdown')
                  }
                }}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full ${buttonPadding} h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow border-1 border-gray-600 hover:border-gray-500 ${
                  dropdownTabs.some(tab => activeTab === tab.id)
                    ? 'bg-gray-500/10 hover:bg-gray-500/20 text-gray-300'
                    : 'bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
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
                  {dropdownTabs.map((tab) => {
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`w-full ${buttonPadding} text-sm font-medium transition-all duration-200 flex items-center gap-2 rounded-lg first:rounded-t-lg last:rounded-b-lg ${
                          isActive
                            ? getButtonColorClasses(tab, true)
                            : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/30'
                        }`}
                      >
                        {tab.icon && (
                          typeof tab.icon === 'string' ? (
                            <Icon 
                              name={tab.icon} 
                              size={14} 
                              color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color === 'sky' ? 'sky' : tab.color)} 
                            />
                          ) : (
                            <span className={getIconColorClass(tab, isActive)}>
                              {React.cloneElement(tab.icon as React.ReactElement<any>, {
                                className: `${getIconColorClass(tab, isActive)} ${((tab.icon as React.ReactElement<any>).props as any)?.className || ''}`.trim()
                              })}
                            </span>
                          )
                        )}
                        <span className="flex-1 text-left">{tab.label || 'Settings'}</span>
                        <NotificationBadge value={tab.badge} />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Hidden tabs for measurement - outside flex container */}
        {/* Render all tabs here for accurate measurement, regardless of visibility state */}
        {!wrap && <div className="absolute opacity-0 pointer-events-none" aria-hidden="true" style={{ visibility: 'hidden', position: 'absolute', top: '-9999px', left: '-9999px' }}>
          {tabs.map((tab) => {
            // Only render tabs that aren't currently visible (to avoid duplicate refs)
            if (visibleTabs.includes(tab)) return null
            
            const isActive = activeTab === tab.id
            return (
              <button
                key={`measure-${tab.id}`}
                ref={(el) => {
                  if (el) {
                    tabRefs.current.set(tab.id, el)
                  } else {
                    tabRefs.current.delete(tab.id)
                  }
                }}
                className={`${buttonPadding} h-8 text-sm font-medium flex items-center justify-center relative rounded-lg ${getButtonColorClasses(tab, isActive)}`}
              >
                {tab.icon && (
                  typeof tab.icon === 'string' ? (
                    <Icon 
                      name={tab.icon} 
                      size={14} 
                      color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color === 'sky' ? 'sky' : tab.color)} 
                      className={tab.label ? "mr-1" : ""} 
                    />
                  ) : (
                    <span className={`${tab.label ? "mr-1" : ""} ${getIconColorClass(tab, isActive)}`}>
                      {React.cloneElement(tab.icon as React.ReactElement<any>, {
                        className: `${getIconColorClass(tab, isActive)} ${((tab.icon as React.ReactElement<any>).props as any)?.className || ''}`.trim()
                      })}
                    </span>
                  )
                )}
                {tab.label}
              </button>
            )
          })}
        </div>}

        {/* Right side elements */}
        <div ref={rightElementRef} className="flex items-center gap-2 flex-shrink-0">
          {rightElement}
          {/* Close button - on same row as tabs */}
          {onClose && (
            <button
              onClick={onClose}
              className={`${closeButtonPlacement === 'separate' ? breakpointClass : ''} p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50`}
              title="Close"
            >
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab && (
        <div className={`flex-1 flex flex-col overflow-y-auto min-h-0 ${contentClassName}`}>
          <div className={`flex flex-col min-h-0 ${activeTab === 'map' || activeTab === 'explore' ? 'w-full h-full' : 'max-w-4xl mx-auto h-full w-full'}`}>
            {renderTabContent()}
          </div>
        </div>
      )}
    </div>
  )
}

