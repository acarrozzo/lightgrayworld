'use client'

import { useState, ReactNode, useEffect, useRef, useCallback } from 'react'
import Icon from './Icon'
import { ChevronDown } from 'lucide-react'

export interface TabConfig {
  id: string
  label: string
  icon?: string | ReactNode
  color?: string
  content: ReactNode | ((isActive: boolean) => ReactNode)
  badge?: boolean | number
}

interface TabContainerProps {
  tabs: TabConfig[]
  defaultTab?: string | null
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
}

export default function TabContainer({
  tabs,
  defaultTab,
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
}: TabContainerProps) {
  const [activeTab, setActiveTab] = useState<string | null>(defaultTab ?? tabs[0]?.id ?? null)
  const [visibleTabs, setVisibleTabs] = useState<TabConfig[]>(tabs)
  const [dropdownTabs, setDropdownTabs] = useState<TabConfig[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleTabChange = (tabId: string) => {
    // Toggle behavior: if clicking the active tab, close it (set to null)
    const newActiveTab = activeTab === tabId ? null : tabId
    setActiveTab(newActiveTab)
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

    // Get available width for the tabs container
    const containerRect = container.getBoundingClientRect()
    const availableWidth = containerRect.width

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
    if (totalWidth <= availableWidth && tabWidths.length === tabs.length) {
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
      
      // Check if this tab would fit
      const wouldFit = fittingWidth + tabWidth + gap + spaceForDropdown <= availableWidth
      
      if (wouldFit) {
        fittingTabs.push(tabs[i])
        fittingWidth += tabWidth + gap
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

  const getButtonColorClasses = (tab: TabConfig, isActive: boolean) => {
    const color = tab.color || 'blue'
    
    if (isActive) {
      switch (color) {
        case 'blue':
          return 'border-1 border-blue-500 hover:border-blue-400 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300'
        case 'green':
          return 'border-1 border-green-500 hover:border-green-400 bg-green-500/10 hover:bg-green-500/20 text-green-300'
        case 'purple':
          return 'border-1 border-purple-500 hover:border-purple-400 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300'
        case 'gold':
          return 'border-1 border-amber-500 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
        case 'red':
          return 'border-1 border-red-500 hover:border-red-400 bg-red-500/10 hover:bg-red-500/20 text-red-300'
        default:
          return 'border-1 border-indigo-500 hover:border-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300'
      }
    } else {
      return 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
    }
  }

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
      <div className={`flex gap-2 ${defaultHeaderPadding} bg-gray-900/95 backdrop-blur-sm flex-shrink-0 flex-wrap items-center ${headerClassName}`}>
        {/* Left side elements */}
        {leftElement && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {leftElement}
          </div>
        )}
        
        {/* Centered tabs */}
        <div ref={tabsContainerRef} className="flex-1 flex items-center justify-center gap-2 flex-nowrap">
          {/* Render visible tabs */}
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) {
                    tabRefs.current.set(tab.id, el)
                  } else {
                    tabRefs.current.delete(tab.id)
                  }
                }}
                onClick={() => handleTabChange(tab.id)}
                className={`${buttonPadding} h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow flex-shrink-0 ${getButtonColorClasses(tab, isActive)}`}
              >
                {tab.icon && (
                  typeof tab.icon === 'string' ? (
                    <Icon 
                      name={tab.icon} 
                      size={14} 
                      color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color)} 
                      className={tab.label ? "mr-1" : ""} 
                    />
                  ) : (
                    <span className={tab.label ? "mr-1" : ""}>{tab.icon}</span>
                  )
                )}
                {tab.label}
                {tab.badge && (
                  <span className={`absolute -top-1 -right-1 bg-red-500 rounded-full border border-gray-900 flex items-center justify-center ${
                    typeof tab.badge === 'number' 
                      ? 'min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white' 
                      : 'w-2 h-2'
                  }`}>
                    {typeof tab.badge === 'number' && tab.badge > 0 ? (tab.badge > 99 ? '99+' : tab.badge) : ''}
                  </span>
                )}
              </button>
            )
          })}
          
          {/* Dropdown button for overflow tabs */}
          {dropdownTabs.length > 0 && (
            <div className="relative flex-shrink-0" ref={dropdownRef}>
              <button
                ref={(el) => {
                  if (el) {
                    tabRefs.current.set('dropdown', el)
                  } else {
                    tabRefs.current.delete('dropdown')
                  }
                }}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`${buttonPadding} h-8 text-sm font-medium transition-all duration-200 flex items-center justify-center relative rounded-lg shadow-sm hover:shadow ${
                  dropdownTabs.some(tab => activeTab === tab.id)
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
                              color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color)} 
                            />
                          ) : (
                            <span>{tab.icon}</span>
                          )
                        )}
                        <span className="flex-1 text-left">{tab.label || 'Settings'}</span>
                        {tab.badge && (
                          <span className={`bg-red-500 rounded-full border border-gray-900 flex items-center justify-center ${
                            typeof tab.badge === 'number' 
                              ? 'min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white' 
                              : 'w-2 h-2'
                          }`}>
                            {typeof tab.badge === 'number' && tab.badge > 0 ? (tab.badge > 99 ? '99+' : tab.badge) : ''}
                          </span>
                        )}
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
        <div className="absolute opacity-0 pointer-events-none" aria-hidden="true" style={{ visibility: 'hidden', position: 'absolute', top: '-9999px', left: '-9999px' }}>
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
                      color={isActive ? undefined : (tab.color === 'gold' ? 'yellow' : tab.color)} 
                      className={tab.label ? "mr-1" : ""} 
                    />
                  ) : (
                    <span className={tab.label ? "mr-1" : ""}>{tab.icon}</span>
                  )
                )}
                {tab.label}
              </button>
            )
          })}
        </div>
        
        {/* Right side elements */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
          {renderTabContent()}
        </div>
      )}
    </div>
  )
}

