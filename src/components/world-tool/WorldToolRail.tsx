'use client'

/**
 * The World Tool's left rail: brand, search, and every page under its group.
 *
 * Replaces a single top strip that had grown to fourteen links and scrolled
 * sideways even on a wide desktop. A rail scales down instead of across —
 * more pages make it taller, never wider — and gives the tool's groups
 * (Compendium, World, Community, Workshop) somewhere to be seen.
 *
 * Three shapes from one element:
 *   - md and up, expanded: a 15rem column, icons with labels under headings.
 *   - md and up, collapsed: a 3.5rem icon column; labels become tooltips and
 *     the search box becomes a button that expands the rail to type in.
 *   - below md: a top bar with a menu button, and the rail slides in over the
 *     page as a drawer. The drawer is always the expanded shape.
 *
 * Lives in the route-group layout, so it survives navigation between pages —
 * which is also why the search index only has to be fetched once. With a
 * `loading.tsx` beside it, a click highlights here and shows the skeleton in
 * the content column while the next page's data is still on its way.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Menu, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react'
import {
  WORLD_TOOL_GROUPS,
  WORLD_TOOL_HOME,
  WORLD_TOOL_RAIL_COOKIE,
  isWorldToolPageActive,
} from '@/lib/world-tool/pages'
import { SearchInput, SearchResults, useWorldToolSearch } from './WorldToolSearch'

const LINK =
  'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors '
const LINK_ON = 'fill-accent'
const LINK_OFF = 'text-fg-secondary hover:bg-surface-hover/80 hover:text-fg-bright'
const ICON_BUTTON =
  'rounded-md border border-line-subtle p-1.5 text-fg-secondary transition-colors hover:border-line-strong hover:text-fg-bright'

export default function WorldToolRail({ initialCollapsed }: { initialCollapsed: boolean }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // The drawer is a way to get somewhere; once you are there it is in the way.
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const remember = useCallback((next: boolean) => {
    setCollapsed(next)
    document.cookie = `${WORLD_TOOL_RAIL_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`
  }, [])

  const focusSearch = () => requestAnimationFrame(() => searchRef.current?.focus())

  const search = useWorldToolSearch(query, {
    onPicked: useCallback(() => {
      setQuery('')
      setDrawerOpen(false)
    }, []),
    onEscape: useCallback(() => {
      if (query) setQuery('')
      else searchRef.current?.blur()
    }, [query]),
  })

  const isHome = pathname === WORLD_TOOL_HOME.href

  return (
    <>
      {/* Below md: a bar with the menu, in place of the rail. */}
      <header className="flex shrink-0 items-center gap-2 border-b border-line-subtle bg-surface-panel px-3 py-2 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="wt-rail"
          className={ICON_BUTTON}
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
        <Link
          href={WORLD_TOOL_HOME.href}
          className="truncate text-sm font-bold text-fg-bright/80 hover:text-fg-bright"
        >
          {WORLD_TOOL_HOME.label}
        </Link>
        <button
          type="button"
          onClick={() => {
            setDrawerOpen(true)
            focusSearch()
          }}
          aria-label="Search"
          className={`ml-auto ${ICON_BUTTON}`}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-surface-canvas/70 md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="wt-rail"
        aria-label="World Tool"
        className={
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line-subtle bg-surface-panel transition-transform duration-200 ' +
          'md:static md:z-auto md:h-full md:max-w-none md:shrink-0 md:translate-x-0 md:transition-[width] ' +
          (collapsed ? 'md:w-14 ' : 'md:w-60 ') +
          (drawerOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
        {/* Brand */}
        <div
          className={
            'flex items-center gap-2 border-b border-line-subtle px-3 py-3 ' +
            (collapsed ? 'md:justify-center md:px-0' : '')
          }
        >
          <Link
            href={WORLD_TOOL_HOME.href}
            aria-current={isHome ? 'page' : undefined}
            title="World Tool home"
            className={
              'flex min-w-0 items-center gap-2 text-sm font-bold ' +
              (isHome ? 'text-fg-bright' : 'text-fg-bright/80 hover:text-fg-bright')
            }
          >
            <Home className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className={'truncate ' + (collapsed ? 'md:sr-only' : '')}>{WORLD_TOOL_HOME.label}</span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className={`ml-auto md:hidden ${ICON_BUTTON}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Search: a box, or a button that opens the rail to reveal the box. */}
        <div className={'border-b border-line-subtle p-2 ' + (collapsed ? 'md:flex md:justify-center' : '')}>
          <div className={collapsed ? 'md:hidden' : ''}>
            <SearchInput value={query} onChange={setQuery} inputRef={searchRef} search={search} />
          </div>
          <button
            type="button"
            onClick={() => {
              remember(false)
              focusSearch()
            }}
            aria-label="Search"
            title="Search"
            className={(collapsed ? 'hidden md:flex ' : 'hidden ') + ICON_BUTTON}
          >
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Pages, or search hits in their place while there is a query. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {search.searching ? (
            <SearchResults query={query} search={search} />
          ) : (
            <nav aria-label="Pages" className="px-2 py-2">
              {WORLD_TOOL_GROUPS.map((group) => (
                <div key={group.id} className="mb-3">
                  <h2
                    className={
                      'px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-fg-muted ' +
                      (collapsed ? 'md:sr-only' : '')
                    }
                  >
                    {group.label}
                  </h2>
                  <div
                    className={'mx-2 mb-1.5 hidden border-t border-line-subtle ' + (collapsed ? 'md:block' : '')}
                    aria-hidden="true"
                  />
                  <ul>
                    {group.pages.map((page) => {
                      const active = isWorldToolPageActive(page, pathname)
                      const PageIcon = page.icon
                      return (
                        <li key={page.key}>
                          <Link
                            href={page.href}
                            aria-current={active ? 'page' : undefined}
                            title={collapsed ? page.label : undefined}
                            className={
                              LINK +
                              (collapsed ? 'md:justify-center md:px-0 ' : '') +
                              (active ? LINK_ON : LINK_OFF)
                            }
                          >
                            <PageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className={'truncate ' + (collapsed ? 'md:sr-only' : '')}>{page.label}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </div>

        {/* Collapse, md and up only: the drawer has no narrow shape. */}
        <div className="hidden border-t border-line-subtle p-2 md:block">
          <button
            type="button"
            onClick={() => remember(!collapsed)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand' : 'Collapse'}
            className={
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-surface-hover/80 hover:text-fg-bright ' +
              (collapsed ? 'justify-center px-0' : '')
            }
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
