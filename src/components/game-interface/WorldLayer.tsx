'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Globe, LocateFixed, Map as MapIcon, Maximize2, Minimize2, Sparkles, X } from 'lucide-react'
import { useGameStore, type Player } from '@/lib/game-state'
import { StatBar } from '@/components/GameHeader'
import { foundSheetIds, type TeleportContext } from '@/lib/world-atlas'
import LayerShell, { HeaderTabs, ICON_BUTTON, useDeck } from './LayerShell'
import TravelRows, { type BossTeleportTile } from './TravelRows'
import WorldAtlas, { type AtlasCommand, type AtlasView } from './WorldAtlas'
import AtlasRail from './AtlasRail'

const { defeatedBossTeleports } = require('@/lib/game-data/teleport-destinations') as {
  defeatedBossTeleports: (killedSlugs: string[]) => BossTeleportTile[]
}
const { memberGuildIds } = require('@/lib/game-data/factions') as {
  memberGuildIds: (rows: Array<{ questId: string; completed: boolean }>) => string[]
}

/** Map: the world you zoom, down to a room. Teleport: the original's teleport page, as rows. */
export type WorldTab = 'map' | 'teleport'

/**
 * How the World tab was opened: from the tab bar (or a feed link) it opens on
 * the whole world; from the compass's mini-map, on your own room. A new `seq`
 * re-applies it while the tab is already open.
 */
export interface WorldEntry {
  view: 'world' | 'here'
  seq: number
}

interface WorldLayerProps {
  tab: WorldTab
  onTabChange: (tab: WorldTab) => void
  player: Player | null
  currentRoomId?: string
  entry: WorldEntry
  fullScreen: boolean
  onFullScreenChange: (on: boolean) => void
  /** Rooms this character has stood in, by id, with their names (lib/visited-rooms). */
  visitedNames: Record<string, string>
  onTeleport: (roomId: string) => void
  teleportBlockedReason?: string | null
}

const FULL_ICON = 'grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-raised/60 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'

/** Wide enough, full screen, for the rail of places beside the map. */
function useWideScreen(minWidth: number): boolean {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${minWidth}px)`)
    const update = () => setWide(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [minWidth])
  return wide
}

/**
 * The World tab: Map and Teleport under one header, in the left column, on a
 * phone's page, or full screen over the whole window.
 *
 * Map is one surface you zoom (WorldAtlas): it opens on the whole world, the
 * original's nine sheets edge to edge; a region grows into its sheet and every
 * room on it can be tapped. Teleport is the original's teleport page as rows,
 * each open row with a button that shows its landing on the map.
 *
 * Full screen covers the window and keeps a slim HP/MP line, since teleports
 * cost MP. Where there is width it adds a rail of places beside the map — the
 * world in miniature, the region's levels, what on this sheet you can teleport
 * to. GameInterface owns whether it is full screen (Escape, the compass and a
 * fight all change it); this component only draws it.
 */
export default function WorldLayer({
  tab,
  onTabChange,
  player,
  currentRoomId,
  entry,
  fullScreen,
  onFullScreenChange,
  visitedNames,
  onTeleport,
  teleportBlockedReason = null,
}: WorldLayerProps) {
  const { presentation, onClose } = useDeck()
  const railFits = useWideScreen(900)
  // The game draws this tab twice — docked in the desktop column, as a page on
  // a phone — with the other copy hidden. Only the copy for this screen may
  // cover the window, or a phone would get two full screens stacked.
  const isDesktop = useWideScreen(1024)
  const isShownCopy = (presentation === 'docked') === isDesktop

  // What the map can show and where it can send you, from the same facts the
  // server checks: found-sheet flags, discovered landings, guild memberships
  // (the quest rows the journal reads) and the kill list (bumped by a win).
  const flags = player as unknown as Record<string, unknown> | null
  const flagKey = foundSheetIds(flags, currentRoomId).join(',')
  const foundMapIds = useMemo(() => (flagKey ? flagKey.split(',') : []), [flagKey])
  const discoveredTeleports = useMemo(() => player?.discoveredTeleports ?? [], [player?.discoveredTeleports])
  const quests = useGameStore((s) => s.quests)
  const memberships = useMemo(() => memberGuildIds(quests), [quests])
  const killList = useGameStore((s) => s.killList)
  const killedSlugs = useMemo(() => killList.filter((entry) => entry.kills > 0).map((entry) => entry.monster), [killList])
  const defeatedBosses = useMemo(() => defeatedBossTeleports(killedSlugs), [killedSlugs])
  const teleport: TeleportContext = useMemo(
    () => ({ discoveredTeleports, killedSlugs, memberships }),
    [discoveredTeleports, killedSlugs, memberships],
  )

  // Commands to the map, each with its own sequence number.
  const seq = useRef(0)
  const [command, setCommand] = useState<(AtlasCommand & { seq: number }) | null>(() => ({ type: entry.view, seq: 0 }))
  const send = useCallback((next: AtlasCommand) => {
    seq.current += 1
    setCommand({ ...next, seq: seq.current })
  }, [])
  const lastEntry = useRef(entry.seq)
  useEffect(() => {
    if (entry.seq === lastEntry.current) return
    lastEntry.current = entry.seq
    send({ type: entry.view })
  }, [entry, send])

  const [view, setView] = useState<AtlasView | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view

  // Going full screen or back draws the map afresh in its new frame; carry
  // the place it was showing across (the zoom starts over).
  const wasFull = useRef(fullScreen)
  useLayoutEffect(() => {
    if (wasFull.current === fullScreen) return
    wasFull.current = fullScreen
    const v = viewRef.current
    if (v) send(v.depth === 'world' ? { type: 'world', level: v.level } : { type: 'sheet', sheetId: v.sheetId })
  }, [fullScreen, send])

  // Map, pressed from anywhere — Teleport, a sheet, the world — is the whole world.
  const changeTab = (next: WorldTab) => {
    if (next === 'map') send({ type: 'world' })
    onTabChange(next)
  }
  const goHere = () => {
    send({ type: 'here' })
    if (tab !== 'map') onTabChange('map')
  }
  const showOnMap = (roomId: string) => {
    send({ type: 'show', roomId })
    onTabChange('map')
  }

  const tabs = (
    <HeaderTabs
      label="Map or Teleport"
      color="sky"
      active={tab}
      home="map"
      onChange={changeTab}
      tabs={[
        { id: 'map', label: 'Map', icon: <MapIcon size={14} aria-hidden="true" /> },
        { id: 'teleport', label: 'Teleport', icon: <Sparkles size={14} aria-hidden="true" /> },
      ]}
    />
  )

  const map = (rail: boolean) => (
    <WorldAtlas
      command={command}
      onViewChange={setView}
      currentRoomId={currentRoomId}
      foundMapIds={foundMapIds}
      teleport={teleport}
      visitedNames={visitedNames}
      playerMp={player?.mp ?? 0}
      blockedReason={teleportBlockedReason}
      onTeleport={onTeleport}
      hideLevels={rail}
    />
  )

  // The original's teleport page as rows: regions with their sub-hubs, the
  // bosses beaten, the VIP rooms. The list is its own scroller; `@container`
  // so the rows size their verbs by its width.
  const rows = (centred: boolean) => (
    <div className="@container min-h-0 flex-1 overflow-y-auto p-3">
      <div className={`flex flex-col gap-1.5 ${centred ? 'mx-auto max-w-[560px]' : ''}`}>
        <TravelRows
          currentRoomId={currentRoomId}
          discoveredTeleports={discoveredTeleports}
          memberships={memberships}
          blockedReason={teleportBlockedReason}
          bosses={defeatedBosses}
          playerMp={player?.mp ?? 0}
          onTeleport={onTeleport}
          onShowOnMap={showOnMap}
          foundMapIds={foundMapIds}
        />
      </div>
    </div>
  )

  if (fullScreen) {
    if (!isShownCopy) return null
    return (
      <WorldFullScreen
        tabs={tabs}
        player={player}
        onHere={goHere}
        onLeave={() => onFullScreenChange(false)}
        onClose={onClose}
      >
        {tab === 'teleport' ? (
          rows(true)
        ) : railFits ? (
          <div className="flex min-h-0 flex-1">
            {view && (
              <AtlasRail
                view={view}
                currentRoomId={currentRoomId}
                foundMapIds={foundMapIds}
                teleport={teleport}
                playerMp={player?.mp ?? 0}
                blockedReason={teleportBlockedReason}
                onCommand={send}
                onTeleport={onTeleport}
              />
            )}
            {map(true)}
          </div>
        ) : (
          map(false)
        )}
      </WorldFullScreen>
    )
  }

  const lead = (
    <>
      {tabs}
      <span className="ml-auto flex flex-shrink-0 items-center gap-0.5">
        <button type="button" onClick={goHere} aria-label="Show where you are" title="Show where you are" className={`${ICON_BUTTON} text-resource-gold`}>
          <LocateFixed size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onFullScreenChange(true)} aria-label="Full screen" title="Full screen" className={ICON_BUTTON}>
          <Maximize2 size={15} aria-hidden="true" />
        </button>
      </span>
    </>
  )

  return (
    <LayerShell title="World" icon={<Globe size={15} aria-hidden="true" />} toneClass="text-hue-sky" lead={lead} flush>
      {tab === 'teleport' ? rows(false) : <div className="flex min-h-0 flex-1 flex-col">{map(false)}</div>}
    </LayerShell>
  )
}

/**
 * The World tab over the whole window: its sub-tabs, a slim HP/MP line, Here,
 * back to the docked tab, close. On a phone the vitals take a second line.
 */
function WorldFullScreen({
  tabs,
  player,
  onHere,
  onLeave,
  onClose,
  children,
}: {
  tabs: ReactNode
  player: Player | null
  onHere: () => void
  onLeave: () => void
  onClose: () => void
  children: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Keyboard focus moves into the full screen and back to whatever opened it.
  useEffect(() => {
    if (!mounted) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    rootRef.current?.focus({ preventScroll: true })
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [mounted])

  if (!mounted) return null

  const vitals = player ? (
    <div className="flex items-center gap-2" aria-label="Vitals">
      <StatBar className="w-[104px]" pct={player.hpMax > 0 ? (player.hp / player.hpMax) * 100 : 0} fillClass="bg-gradient-to-r from-fill-resource-hp to-resource-hp" label="HP" value={`HP ${player.hp}/${player.hpMax}`} />
      <StatBar className="w-[104px]" pct={player.mpMax > 0 ? (player.mp / player.mpMax) * 100 : 0} fillClass="bg-gradient-to-r from-fill-resource-mp to-resource-mp" label="MP" value={`MP ${player.mp}/${player.mpMax}`} />
    </div>
  ) : null

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="World, full screen"
      className="fixed inset-0 z-40 flex flex-col bg-surface-canvas focus:outline-none"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line-subtle/60 bg-surface-panel py-1.5 pl-3 pr-2">
        <div className="flex min-w-0 items-center">{tabs}</div>
        <div className="order-last flex w-full justify-center sm:order-none sm:ml-auto sm:w-auto">{vitals}</div>
        <div className="ml-auto flex flex-shrink-0 items-center gap-0.5 sm:ml-0">
          <button type="button" onClick={onHere} aria-label="Show where you are" title="Show where you are" className={`${FULL_ICON} text-resource-gold`}>
            <LocateFixed size={17} aria-hidden="true" />
          </button>
          <button type="button" onClick={onLeave} aria-label="Leave full screen" title="Leave full screen (Esc)" className={FULL_ICON}>
            <Minimize2 size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className={FULL_ICON}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>,
    document.body,
  )
}
