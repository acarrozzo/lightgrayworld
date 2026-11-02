'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Eye, EyeOff, Globe, Map as MapIcon, Maximize2, Sparkles } from 'lucide-react'
import { useGameStore, type Player } from '@/lib/game-state'
import { foundSheetIds, type TeleportContext } from '@/lib/world-atlas'
import { useWorldMapPref } from '@/lib/world-map-prefs'
import LayerShell, { HeaderTabs, ICON_BUTTON, useDeck } from './LayerShell'
import FullScreenFrame from './FullScreenFrame'
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

/** The bar a switch sits in: the docked header (taller on a phone) or the full-screen bar. */
type SwitchSize = 'docked' | 'full'

/**
 * One of the map's two switches: a small track whose knob carries the
 * switch's own glyph (the ✦ the lit landings wear, the eye for the controls),
 * so it says what it switches without a word, at every width. On, the track
 * fills in the switch's color and the knob turns bright with the glyph in
 * that color; off, track and knob go gray. The same switch the feed options
 * menu and Settings draw, with a passenger. Full screen and close beside it
 * stay plain icons: they do things, these two hold a state.
 */
function MapSwitch({
  on,
  onChange,
  size,
  tone,
  label,
  title,
  icon,
}: {
  on: boolean
  onChange: (next: boolean) => void
  size: SwitchSize
  tone: 'landings' | 'controls'
  label: string
  title: string
  icon: ReactNode
}) {
  const full = size === 'full'
  const trackOn = tone === 'landings' ? 'bg-resource-mp' : 'bg-hue-sky'
  const glyphOn = tone === 'landings' ? 'text-resource-mp' : 'text-hue-sky'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      onClick={() => onChange(!on)}
      className={`group grid shrink-0 place-items-center rounded-lg px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${full ? 'h-8' : 'h-7 max-lg:h-9'}`}
    >
      <span
        aria-hidden="true"
        className={`relative block rounded-full transition-colors duration-150 group-hover:brightness-110 ${full ? 'h-[19px] w-9' : 'h-[17px] w-8'} ${on ? trackOn : 'bg-line-strong'}`}
      >
        <span
          className={`absolute top-[2px] grid place-items-center rounded-full shadow-sm transition-[left,background-color,color] duration-150 motion-reduce:transition-none ${
            full ? 'h-[15px] w-[15px]' : 'h-[13px] w-[13px]'
          } ${on ? `${full ? 'left-[19px]' : 'left-[17px]'} bg-fg-bright ${glyphOn}` : 'left-[2px] bg-fg-secondary text-surface-canvas'}`}
        >
          {icon}
        </span>
      </span>
    </button>
  )
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
  const [showPins, setShowPins] = useWorldMapPref('pins')
  const [showControls, setShowControls] = useWorldMapPref('controls')

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
      showPins={showPins}
      showControls={showControls}
    />
  )

  // The map's two switches, in the header beside full screen: the teleport
  // landings, and the controls over the art. Only while the map is showing.
  const toggles = (size: SwitchSize) =>
    tab === 'map' ? (
      <>
        <MapSwitch
          on={showPins}
          onChange={setShowPins}
          size={size}
          tone="landings"
          label="Teleport landings"
          title={showPins ? 'Hide the teleport landings' : 'Show the teleport landings'}
          icon={<Sparkles size={size === 'full' ? 10 : 9} aria-hidden="true" />}
        />
        <MapSwitch
          on={showControls}
          onChange={setShowControls}
          size={size}
          tone="controls"
          label="Map controls"
          title={showControls ? 'Hide the controls over the map' : 'Show the controls over the map'}
          icon={showControls ? <Eye size={size === 'full' ? 10 : 9} aria-hidden="true" /> : <EyeOff size={size === 'full' ? 10 : 9} aria-hidden="true" />}
        />
      </>
    ) : null

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
      <FullScreenFrame
        label="World, full screen"
        tabs={tabs}
        player={player}
        toggles={toggles('full')}
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
      </FullScreenFrame>
    )
  }

  const lead = (
    <>
      {tabs}
      <span className="ml-auto flex flex-shrink-0 items-center gap-0.5">
        {toggles('docked')}
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
