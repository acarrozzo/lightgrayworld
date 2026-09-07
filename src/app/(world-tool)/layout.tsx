/**
 * The frame every World Tool page sits in: the left rail, and the one scroll
 * container beside it.
 *
 * `globals.css` gives the game shell `html, body { height: 100%; overflow:
 * hidden }`, so nothing scrolls unless a layout says it does. This used to be
 * a three-line file copied into each route, which meant a new page silently
 * clipped at the fold until someone noticed the missing copy. The route group
 * exists so a World Tool page cannot forget — and now so that no page has to
 * render its own navigation either.
 *
 * `(world-tool)` is a route group: it shapes the layout tree without appearing
 * in any URL, so these pages stay at `/enemies`, `/rooms`, `/room-desc` and so on.
 *
 * The rail's collapsed state is read from a cookie here so the first paint is
 * already the remembered width. `loading.tsx` beside this file is the
 * skeleton the content column shows between pages.
 */

import { cookies } from 'next/headers'
import WorldToolRail from '@/components/world-tool/WorldToolRail'
import { WORLD_TOOL_RAIL_COOKIE } from '@/lib/world-tool/pages'

export default async function WorldToolLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const initialCollapsed = jar.get(WORLD_TOOL_RAIL_COOKIE)?.value === '1'

  return (
    <div className="flex h-full flex-col fill-surface-canvas md:flex-row">
      <a
        href="#wt-content"
        className="sr-only z-[60] rounded-md border border-line-strong bg-surface-panel px-3 py-1.5 text-sm focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
      >
        Skip to content
      </a>
      <WorldToolRail initialCollapsed={initialCollapsed} />
      <div id="wt-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-auto outline-none">
        {children}
      </div>
    </div>
  )
}
