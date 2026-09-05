'use client'

import { useEffect, useMemo, useRef, useState, type WheelEvent, type PointerEvent } from 'react'
import Icon from '@/components/Icon'
import { Flame, Hammer, Search, Skull, Coins, Users, Zap, Lock, Eye, X } from 'lucide-react'

// ---------------------------------------------------------------------------
// Serializable shapes built by the server component (page.tsx).
// ---------------------------------------------------------------------------
export type MapId =
  | 'overworld'
  | 'cabin_basement'
  | 'scorpion_pit'
  | 'bat_cave'
  | 'forest'
  | 'forest_underground'
  | 'red_town'
  | 'red_town_sewers'
  | 'rocky_flats'
  | 'rocky_flats_underground'
  | 'neverending_mine'
  | 'blue_ocean'
  | 'under_the_ocean'
  | 'dark_forest'
  | 'dark_forest_upper'
export type ExitInfo = {
  direction: string
  to: string
  gated?: boolean
  gateMessage?: string
  silent?: boolean
  hidden?: boolean
  lever?: boolean
  oneWay?: boolean
}
export type EnemySpawn = {
  slug: string
  name: string
  level?: number
  icon?: string | null
  weight?: number
  chancePct?: number
}
export type RoomActionInfo = {
  name: string
  kind: 'message' | 'effect' | 'modal' | 'custom'
  detail?: string
}
export type SecretInfo = { kind: 'reveal' | 'lever' | 'gate'; text: string }
export type RoomNode = {
  roomId: string
  map: MapId
  name: string
  subtitle?: string
  description: string
  dangerLevel: number
  isSafe: boolean
  hasFire: boolean
  hasCraftingTable: boolean
  /** The station's name ("Cooking Fire", "Forge") when the room has one. */
  craftingStation?: string | null
  hasSearch: boolean
  icon?: string | null
  iconColor?: string | null
  nameColor?: string | null
  exits: ExitInfo[]
  enemies: { mode: 'static' | 'probabilistic'; spawnChancePct?: number; enemies: EnemySpawn[] } | null
  items: { slug: string; name: string; icon: string; quantity: number; autoRespawn: boolean }[]
  npcs: { name: string; icon?: string; type?: string; questCount?: number }[]
  actions: RoomActionInfo[]
  secrets: SecretInfo[]
}
export type RoomEdge = {
  from: string
  to: string
  direction: string
  gated?: boolean
  hidden?: boolean
  lever?: boolean
  vertical?: boolean
}

// ---------------------------------------------------------------------------
// Layout constants — rooms are placed on a square grid; one cell per step in a
// compass direction (N = up, NE = up-right, …). up/down don't move on the grid.
// ---------------------------------------------------------------------------
const CELL = 170
const CARD_W = 120
const CARD_H = 120
const PAD = CELL // empty border around the laid-out grid

const OFFSETS: Record<string, { dc: number; dr: number }> = {
  north: { dc: 0, dr: -1 },
  northeast: { dc: 1, dr: -1 },
  east: { dc: 1, dr: 0 },
  southeast: { dc: 1, dr: 1 },
  south: { dc: 0, dr: 1 },
  southwest: { dc: -1, dr: 1 },
  west: { dc: -1, dr: 0 },
  northwest: { dc: -1, dr: -1 },
}
const OPPOSITE: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
  northeast: 'southwest',
  southwest: 'northeast',
  northwest: 'southeast',
  southeast: 'northwest',
}

// Danger reads as a heat scale; safe rooms are always emerald regardless of level.
function dangerColor(level: number, isSafe: boolean): string {
  if (isSafe) return 'var(--status-success)'
  // A heat ramp built from the theme's own roles, coolest to hottest, so the
  // atlas reads the same way in every palette.
  const scale = [
    'var(--status-info)',
    'var(--terrain-grass)',
    'var(--status-warning)',
    'var(--action-attack)',
    'var(--combat-damage)',
    'var(--status-error)',
    'var(--combat-defeat)',
  ]
  return scale[Math.min(Math.max(level, 0), scale.length - 1)]
}

type Cell = { col: number; row: number }
type Placed = { x: number; y: number } // pixel center

// Find the nearest unoccupied cell to (col,row) via an expanding ring search.
// Only used for rare non-Euclidean folds where two rooms imply the same cell;
// keeps the map readable without stacking rooms on top of each other.
function nearestFree(col: number, row: number, occupied: Set<string>): [number, number] {
  if (!occupied.has(`${col},${row}`)) return [col, row]
  for (let r = 1; r < 60; r++) {
    for (let dc = -r; dc <= r; dc++) {
      for (let dr = -r; dr <= r; dr++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== r) continue
        const k = `${col + dc},${row + dr}`
        if (!occupied.has(k)) return [col + dc, row + dr]
      }
    }
  }
  return [col, row]
}

// Lay out one map: BFS each connected component (via cardinal exits within the
// map), assign grid cells by direction offset, then pack components left→right.
function layoutMap(roomIds: Set<string>, nodeById: Map<string, RoomNode>): Map<string, Placed> {
  // Cardinal adjacency restricted to this map. A room can list the same target
  // under more than one direction (e.g. both W and NW). When that happens we pick
  // the direction whose opposite matches the target's back-link to us, so the two
  // rooms sit consistently (017 lists 003c as SE → place 017 NW of 003c, not W).
  const adj = new Map<string, { dir: string; to: string }[]>()
  for (const id of roomIds) {
    const node = nodeById.get(id)
    if (!node) continue
    const byTarget = new Map<string, string[]>()
    for (const e of node.exits) {
      if (!OFFSETS[e.direction]) continue // skip up/down for grid placement
      if (!roomIds.has(e.to)) continue
      if (!byTarget.has(e.to)) byTarget.set(e.to, [])
      byTarget.get(e.to)!.push(e.direction)
    }
    const list: { dir: string; to: string }[] = []
    for (const [to, dirsToTarget] of byTarget) {
      let chosen = dirsToTarget[0]
      const back = nodeById
        .get(to)
        ?.exits.find((x) => x.to === id && OFFSETS[x.direction])?.direction
      if (back) {
        const consistent = dirsToTarget.find((d) => OPPOSITE[d] === back)
        if (consistent) chosen = consistent
      }
      list.push({ dir: chosen, to })
    }
    adj.set(id, list)
  }

  const cells = new Map<string, Cell>()
  const placedCols = new Set<string>()
  const ordered = Array.from(roomIds).sort()
  let cursorCol = 0
  const result = new Map<string, Placed>()

  for (const start of ordered) {
    if (placedCols.has(start)) continue
    // BFS this component
    const comp: string[] = []
    const local = new Map<string, Cell>()
    const occupied = new Set<string>(['0,0'])
    local.set(start, { col: 0, row: 0 })
    const queue = [start]
    placedCols.add(start)
    comp.push(start)
    while (queue.length) {
      const cur = queue.shift()!
      const base = local.get(cur)!
      for (const { dir, to } of adj.get(cur) ?? []) {
        if (placedCols.has(to)) continue
        const off = OFFSETS[dir]
        const [col, row] = nearestFree(base.col + off.dc, base.row + off.dr, occupied)
        local.set(to, { col, row })
        occupied.add(`${col},${row}`)
        placedCols.add(to)
        comp.push(to)
        queue.push(to)
      }
    }
    // normalize this component to non-negative cells
    let minC = Infinity
    let minR = Infinity
    let maxC = -Infinity
    for (const c of local.values()) {
      minC = Math.min(minC, c.col)
      minR = Math.min(minR, c.row)
      maxC = Math.max(maxC, c.col)
    }
    for (const id of comp) {
      const c = local.get(id)!
      const col = c.col - minC + cursorCol
      const row = c.row - minR
      cells.set(id, { col, row })
      result.set(id, { x: PAD + col * CELL, y: PAD + row * CELL })
    }
    cursorCol += maxC - minC + 2 // gap of one empty column between components
  }
  return result
}

function bounds(positions: Map<string, Placed>) {
  let maxX = 0
  let maxY = 0
  for (const p of positions.values()) {
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { w: maxX + PAD, h: maxY + PAD }
}

const MAP_LABEL: Record<MapId, string> = {
  overworld: 'Grassy Field',
  cabin_basement: 'Cabin Basement',
  scorpion_pit: 'Scorpion Pit',
  bat_cave: 'Bat Cave',
  forest: 'Forest',
  forest_underground: 'Forest Underground',
  red_town: 'Red Town',
  red_town_sewers: 'Red Town Sewers',
  rocky_flats: 'Rocky Flats',
  rocky_flats_underground: 'Rocky Flats Underground',
  neverending_mine: 'Neverending Mine',
  blue_ocean: 'Blue Ocean',
  under_the_ocean: 'Under the Ocean',
  dark_forest: 'Dark Forest',
  dark_forest_upper: 'Dark Forest Upper Level',
}

// Tab order shown across the top of the atlas — roughly the order a player meets
// each region, with each region's underground directly after it.
const MAP_ORDER: MapId[] = [
  'overworld',
  'cabin_basement',
  'scorpion_pit',
  'bat_cave',
  'forest',
  'forest_underground',
  'red_town',
  'red_town_sewers',
  'rocky_flats',
  'rocky_flats_underground',
  'neverending_mine',
  'blue_ocean',
  'under_the_ocean',
  'dark_forest',
  'dark_forest_upper',
]

// Greedy word-wrap so a room's full name fits inside the card without ellipsis.
// maxChars is tuned to the card width (~120px) at the 11px label font.
function wrapName(name: string, maxChars = 16): string[] {
  const words = name.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (!line) line = w
    else if ((line + ' ' + w).length <= maxChars) line += ' ' + w
    else {
      lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

export default function RoomAtlas({ nodes, edges }: { nodes: RoomNode[]; edges: RoomEdge[] }) {
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.roomId, n])), [nodes])
  const mapOf = useMemo(() => {
    const m = new Map<string, MapId>()
    for (const n of nodes) m.set(n.roomId, n.map)
    return m
  }, [nodes])

  // Per-map layouts (pixel centers) computed once.
  const layouts = useMemo(() => {
    const byMap = Object.fromEntries(MAP_ORDER.map((id) => [id, new Set<string>()])) as Record<MapId, Set<string>>
    for (const n of nodes) byMap[n.map].add(n.roomId)
    return Object.fromEntries(
      MAP_ORDER.map((id) => [id, layoutMap(byMap[id], nodeById)])
    ) as Record<MapId, Map<string, Placed>>
  }, [nodes, nodeById])

  const [activeMap, setActiveMap] = useState<MapId>('overworld')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [filters, setFilters] = useState({ query: '', safe: 'all' as 'all' | 'safe' | 'danger', hasEnemies: false, gated: false })

  const layout = layouts[activeMap]
  const view0 = useMemo(() => {
    const b = bounds(layout)
    return { x: 0, y: 0, w: Math.max(b.w, CELL * 4), h: Math.max(b.h, CELL * 3) }
  }, [layout])
  const [view, setView] = useState(view0)
  // Reset the viewport whenever the active map changes.
  useEffect(() => setView(view0), [view0])

  const focusId = hoverId ?? selectedId
  const neighbours = useMemo(() => {
    if (!focusId || mapOf.get(focusId) !== activeMap) return null
    const set = new Set<string>([focusId])
    for (const e of edges) {
      if (e.from === focusId && mapOf.get(e.to) === activeMap) set.add(e.to)
      if (e.to === focusId && mapOf.get(e.from) === activeMap) set.add(e.from)
    }
    return set
  }, [focusId, edges, mapOf, activeMap])

  const matches = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    const set = new Set<string>()
    for (const n of nodes) {
      if (n.map !== activeMap) continue
      if (q && !(n.roomId.toLowerCase().includes(q) || n.name.toLowerCase().includes(q))) continue
      if (filters.safe === 'safe' && !n.isSafe) continue
      if (filters.safe === 'danger' && n.isSafe) continue
      if (filters.hasEnemies && !n.enemies) continue
      if (filters.gated && !n.exits.some((e) => e.gated)) continue
      set.add(n.roomId)
    }
    return set
  }, [nodes, filters, activeMap])
  const filtersActive = filters.query.trim() !== '' || filters.safe !== 'all' || filters.hasEnemies || filters.gated

  // Edges drawn on the active map: both endpoints on this map (cardinal lines,
  // plus up/down shown as vertical-styled connectors).
  const mapEdges = useMemo(() => {
    const map = new Map<string, RoomEdge & { count: number }>()
    for (const e of edges) {
      if (e.from === e.to) continue
      if (mapOf.get(e.from) !== activeMap || mapOf.get(e.to) !== activeMap) continue
      const key = [e.from, e.to].sort().join('|')
      const ex = map.get(key)
      if (ex) {
        ex.gated = ex.gated || e.gated
        ex.hidden = ex.hidden || e.hidden
        ex.lever = ex.lever || e.lever
        ex.vertical = ex.vertical || e.vertical
        ex.count += 1
      } else {
        map.set(key, { ...e, count: 1 })
      }
    }
    return Array.from(map.values())
  }, [edges, mapOf, activeMap])

  // Portals: per-room links whose target lives on the OTHER map.
  const portalsByRoom = useMemo(() => {
    const m = new Map<string, { direction: string; to: string; toMap: MapId }[]>()
    for (const n of nodes) {
      if (n.map !== activeMap) continue
      for (const e of n.exits) {
        const tm = mapOf.get(e.to)
        if (tm && tm !== activeMap) {
          if (!m.has(n.roomId)) m.set(n.roomId, [])
          m.get(n.roomId)!.push({ direction: e.direction, to: e.to, toMap: tm })
        }
      }
    }
    return m
  }, [nodes, mapOf, activeMap])

  function edgeStyle(e: RoomEdge): { stroke: string; dash?: string } {
    if (e.hidden) return { stroke: 'var(--mood-arcane)', dash: '5 5' }
    if (e.lever) return { stroke: 'var(--mood-treasure)', dash: '7 5' }
    if (e.gated) return { stroke: 'var(--status-error)' }
    if (e.vertical) return { stroke: 'var(--status-info)', dash: '3 6' }
    return { stroke: 'var(--line-strong)' }
  }

  function pick(id: string) {
    const tm = mapOf.get(id)
    if (tm && tm !== activeMap) setActiveMap(tm)
    setSelectedId(id)
  }

  function onWheel(ev: WheelEvent<SVGSVGElement>) {
    ev.preventDefault()
    const factor = ev.deltaY > 0 ? 1.12 : 1 / 1.12
    const rect = ev.currentTarget.getBoundingClientRect()
    const mx = view.x + ((ev.clientX - rect.left) / rect.width) * view.w
    const my = view.y + ((ev.clientY - rect.top) / rect.height) * view.h
    const nw = Math.min(view0.w * 3, Math.max(view0.w * 0.15, view.w * factor))
    const nh = nw * (view.h / view.w)
    setView({ x: mx - (mx - view.x) * (nw / view.w), y: my - (my - view.y) * (nh / view.h), w: nw, h: nh })
  }
  // Pan handling. We deliberately do NOT use setPointerCapture: capturing the
  // pointer on the <svg> would redirect the follow-up `click` event to the svg
  // itself, so the room cards' onClick would never fire. Instead we track how far
  // the pointer moved; `movedRef` lets the card/portal click handlers ignore a
  // click that was really the end of a drag.
  const dragRef = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)
  const movedRef = useRef(false)
  function onPointerDown(ev: PointerEvent<SVGSVGElement>) {
    dragRef.current = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y }
    movedRef.current = false
  }
  function onPointerMove(ev: PointerEvent<SVGSVGElement>) {
    const d = dragRef.current
    if (!d) return
    if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 4) movedRef.current = true
    const rect = ev.currentTarget.getBoundingClientRect()
    const dx = ((ev.clientX - d.x) / rect.width) * view.w
    const dy = ((ev.clientY - d.y) / rect.height) * view.h
    setView((v) => ({ ...v, x: d.vx - dx, y: d.vy - dy }))
  }
  function onPointerUp() {
    dragRef.current = null
  }

  const selected = selectedId ? nodeById.get(selectedId) ?? null : null

  return (
    <div className="flex flex-1 flex-col gap-3 lg:flex-row">
      {/* Map area */}
      <div className="flex min-h-[560px] flex-1 flex-col overflow-hidden rounded border border-line-subtle bg-surface-panel/30">
        {/* Map tabs */}
        <div className="flex items-center gap-1 border-b border-line-subtle bg-surface-panel/70 px-3 pt-2">
          {MAP_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMap(m)}
              className={
                'rounded-t border-x border-t px-3 py-1.5 text-sm font-semibold transition-colors ' +
                (activeMap === m
                  ? 'border-line-subtle fill-surface-raised'
                  : 'border-transparent text-fg-secondary hover:text-fg-bright')
              }
            >
              {MAP_LABEL[m]}
              <span className="ml-1.5 text-xs text-fg-muted">
                {nodes.filter((n) => n.map === m).length}
              </span>
            </button>
          ))}
        </div>

        <Toolbar
          filters={filters}
          setFilters={setFilters}
          onReset={() => setView(view0)}
          count={matches.size}
          total={nodes.filter((n) => n.map === activeMap).length}
        />

        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          className="h-full w-full flex-1 cursor-grab touch-none select-none active:cursor-grabbing"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* Edges */}
          <g>
            {mapEdges.map((e, i) => {
              const a = layout.get(e.from)
              const b = layout.get(e.to)
              if (!a || !b) return null
              const style = edgeStyle(e)
              const incident = neighbours ? e.from === focusId || e.to === focusId : true
              const dimmed = !!focusId && neighbours != null && !incident
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={style.stroke}
                  strokeWidth={incident && focusId ? 3 : 1.8}
                  strokeDasharray={style.dash}
                  opacity={dimmed ? 0.1 : incident && focusId ? 0.95 : 0.55}
                />
              )
            })}
          </g>

          {/* Room cards */}
          <g>
            {nodes
              .filter((n) => n.map === activeMap)
              .map((n) => {
                const p = layout.get(n.roomId)
                if (!p) return null
                const isSelected = n.roomId === selectedId
                const isNeighbour = neighbours?.has(n.roomId) ?? true
                const dimByFocus = !!focusId && neighbours != null && !isNeighbour
                const dimByFilter = filtersActive && !matches.has(n.roomId)
                const dim = dimByFocus || dimByFilter
                const color = dangerColor(n.dangerLevel, n.isSafe)
                const portals = portalsByRoom.get(n.roomId)
                return (
                  <g
                    key={n.roomId}
                    transform={`translate(${p.x - CARD_W / 2},${p.y - CARD_H / 2})`}
                    className="cursor-pointer"
                    opacity={dim ? 0.2 : 1}
                    onPointerEnter={() => setHoverId(n.roomId)}
                    onPointerLeave={() => setHoverId(null)}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      if (movedRef.current) return // ignore drag-pans
                      setSelectedId(n.roomId)
                    }}
                  >
                    <rect
                      width={CARD_W}
                      height={CARD_H}
                      rx={8}
                      fill="var(--surface-canvas)"
                      stroke={color}
                      strokeWidth={isSelected ? 3.5 : 1.8}
                    />
                    {/* danger stripe */}
                    <rect width={6} height={CARD_H} rx={3} fill={color} />
                    <text x={14} y={20} fontSize={12} fontWeight={700} fill="var(--fg-bright)">
                      #{n.roomId}
                    </text>
                    {/* danger level badge */}
                    <g transform={`translate(${CARD_W - 21},15)`}>
                      <title>{n.isSafe ? 'Safe zone' : `Danger level ${n.dangerLevel}`}</title>
                      <circle r={9} fill={color} />
                      <text textAnchor="middle" y={3.5} fontSize={11} fontWeight={700} fill="var(--surface-canvas)">
                        {n.isSafe ? '✓' : n.dangerLevel}
                      </text>
                    </g>
                    <text x={14} y={38} fontSize={11} fill="var(--fg-secondary)">
                      {wrapName(n.name).map((line, i) => (
                        <tspan key={i} x={14} dy={i === 0 ? 0 : 13}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                    {/* content glyphs */}
                    <g transform={`translate(14,${CARD_H - 9})`}>
                      {n.enemies && <circle r={3.5} cx={0} fill="var(--status-error)" />}
                      {n.npcs.length > 0 && <circle r={3.5} cx={12} fill="var(--status-info)" />}
                      {n.items.length > 0 && <circle r={3.5} cx={24} fill="var(--mood-treasure)" />}
                      {n.exits.some((e) => e.gated) && <circle r={3.5} cx={36} fill="var(--mood-arcane)" />}
                    </g>
                    {portals &&
                      (() => {
                        const portal = portals[0]
                        // Heading to the overworld is "up"; into any cave is "down".
                        const down = portal.direction === 'down' || portal.toMap !== 'overworld'
                        const label = MAP_LABEL[portal.toMap]
                        return (
                          <g
                            transform={`translate(${CARD_W / 2},${CARD_H + 13})`}
                            className="cursor-pointer"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              if (movedRef.current) return // ignore drag-pans
                              pick(portal.to)
                            }}
                          >
                            <title>{`${down ? 'Down' : 'Up'} to ${MAP_LABEL[portal.toMap]} — room ${portal.to}`}</title>
                            <rect x={-52} y={-11} width={104} height={22} rx={11} fill="var(--accent-muted)" stroke="var(--accent)" strokeWidth={1.5} />
                            <text x={0} y={4} fontSize={11} fontWeight={700} fill="var(--fg-bright)" textAnchor="middle">
                              {(down ? '▼ ' : '▲ ') + label}
                            </text>
                          </g>
                        )
                      })()}
                  </g>
                )
              })}
          </g>
        </svg>
        <Legend />
      </div>

      {/* Detail panel */}
      <div className="w-full shrink-0 overflow-y-auto rounded border border-line-subtle bg-surface-panel/40 lg:max-h-[80vh] lg:w-96">
        {selected ? (
          <RoomDetail
            room={selected}
            onPick={pick}
            hasNode={(id) => nodeById.has(id)}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="p-6 text-sm text-fg-secondary">
            <p className="font-medium text-fg-bright">Select a room</p>
            <p className="mt-2">
              Rooms are positioned by their compass exits. Click any room to see its full breakdown:
              enemies &amp; spawn logic, loot, NPCs &amp; quests, room actions, gates, and secrets.
            </p>
            <p className="mt-3 text-xs text-fg-muted">
              Drag to pan · scroll to zoom · hover to trace connections · the{' '}
              <span className="font-semibold text-accent-hover">▼ Underground</span> /{' '}
              <span className="font-semibold text-accent-hover">▲ Surface</span> pill jumps between maps.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toolbar / Legend
// ---------------------------------------------------------------------------
type Filters = { query: string; safe: 'all' | 'safe' | 'danger'; hasEnemies: boolean; gated: boolean }
function Toolbar({
  filters,
  setFilters,
  onReset,
  count,
  total,
}: {
  filters: Filters
  setFilters: (f: Filters) => void
  onReset: () => void
  count: number
  total: number
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-surface-panel/60 px-3 py-2 text-xs">
      <input
        value={filters.query}
        onChange={(e) => setFilters({ ...filters, query: e.target.value })}
        placeholder="Search id or name…"
        className="w-40 rounded border border-line-subtle fill-surface-raised px-2 py-1 placeholder-fg-muted focus:border-accent focus:outline-none"
      />
      <select
        value={filters.safe}
        onChange={(e) => setFilters({ ...filters, safe: e.target.value as Filters['safe'] })}
        className="rounded border border-line-subtle fill-surface-raised px-2 py-1 focus:border-accent focus:outline-none"
      >
        <option value="all">All rooms</option>
        <option value="safe">Safe only</option>
        <option value="danger">Dangerous only</option>
      </select>
      <ToggleChip active={filters.hasEnemies} onClick={() => setFilters({ ...filters, hasEnemies: !filters.hasEnemies })}>
        Has enemies
      </ToggleChip>
      <ToggleChip active={filters.gated} onClick={() => setFilters({ ...filters, gated: !filters.gated })}>
        Gated
      </ToggleChip>
      <span className="ml-auto text-fg-muted">
        {count}/{total} shown
      </span>
      <button
        onClick={onReset}
        className="rounded border border-line-subtle fill-surface-raised px-2 py-1 font-semibold transition-colors hover:bg-surface-hover/80 hover:text-fg-bright"
      >
        Reset view
      </button>
    </div>
  )
}
function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded border px-2 py-1 font-semibold transition-colors ' +
        (active
          ? 'border-accent fill-accent'
          : 'border-line-subtle fill-surface-raised hover:bg-surface-hover/80')
      }
    >
      {children}
    </button>
  )
}
function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-subtle bg-surface-panel/60 px-3 py-2 text-[10px] text-fg-secondary">
      <span className="flex items-center gap-1">
        <Dot color="var(--status-success)" /> Safe
      </span>
      <span className="flex items-center gap-1">
        <Dot color="var(--mood-treasure)" /> Danger →
      </span>
      <span className="flex items-center gap-1">
        <Dot color="var(--status-error)" /> High danger
      </span>
      <span className="ml-2 flex items-center gap-1">
        <LineSwatch color="var(--status-error)" /> Gated
      </span>
      <span className="flex items-center gap-1">
        <LineSwatch color="var(--mood-arcane)" dash /> Hidden
      </span>
      <span className="flex items-center gap-1">
        <LineSwatch color="var(--mood-treasure)" dash /> Lever
      </span>
      <span className="flex items-center gap-1">
        <LineSwatch color="var(--status-info)" dash /> Up/Down
      </span>
      <span className="flex items-center gap-1">
        <span className="rounded bg-accent px-1 text-[9px] font-bold leading-none text-accent">▼▲</span> Map portal
      </span>
    </div>
  )
}
function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
}
function LineSwatch({ color, dash }: { color: string; dash?: boolean }) {
  return (
    <svg width="20" height="6">
      <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash ? '3 2' : undefined} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------
const DIR_LABEL: Record<string, string> = {
  north: 'N',
  northeast: 'NE',
  east: 'E',
  southeast: 'SE',
  south: 'S',
  southwest: 'SW',
  west: 'W',
  northwest: 'NW',
  up: 'Up',
  down: 'Down',
}
function RoomDetail({
  room,
  onPick,
  hasNode,
  onClose,
}: {
  room: RoomNode
  onPick: (id: string) => void
  hasNode: (id: string) => boolean
  onClose: () => void
}) {
  const color = dangerColor(room.dangerLevel, room.isSafe)
  return (
    <div>
      {/* Sticky close bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line-subtle bg-surface-panel/95 px-4 py-2 backdrop-blur">
        <span className="font-mono text-xs font-semibold text-fg-secondary">Room #{room.roomId}</span>
        <button
          onClick={onClose}
          aria-label="Close room details"
          className="flex items-center gap-1 rounded border border-line-subtle fill-surface-raised px-2 py-1 text-xs font-semibold transition-colors hover:bg-surface-hover/80 hover:text-fg-bright"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="space-y-5 p-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          {room.icon && <Icon name={room.icon} size={22} className={room.iconColor ? `text-${room.iconColor}` : ''} />}
          <h2 className="text-lg font-bold text-fg-bright">{room.name}</h2>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <Badge color="var(--surface-raised)" text={`#${room.roomId}`} />
          <span className="rounded px-1.5 py-0.5 font-semibold" style={{ backgroundColor: `${color}22`, color }}>
            {room.isSafe ? 'Safe' : `Danger ${room.dangerLevel}`}
          </span>
          {room.hasFire && <FeatureChip icon={Flame} label="Fire" />}
          {room.hasCraftingTable && <FeatureChip icon={Hammer} label={room.craftingStation ?? 'Crafting'} />}
          {room.hasSearch && <FeatureChip icon={Search} label="Searchable" />}
        </div>
        {room.subtitle && <p className="mt-2 text-xs italic text-fg-muted">{room.subtitle}</p>}
        <p className="mt-2 text-sm leading-relaxed text-fg-primary">{room.description}</p>
      </div>

      {/* Exits */}
      <Section icon={Zap} title={`Exits (${room.exits.length})`}>
        {room.exits.length === 0 ? (
          <Empty>No exits — a dead end.</Empty>
        ) : (
          <ul className="space-y-1">
            {room.exits.map((e) => (
              <li key={e.direction} className="flex items-center gap-2 text-sm">
                <span className="w-10 shrink-0 font-semibold text-fg-secondary">{DIR_LABEL[e.direction] ?? e.direction}</span>
                {hasNode(e.to) ? (
                  <button onClick={() => onPick(e.to)} className="font-mono text-accent-hover/80 hover:text-accent-hover hover:underline">
                    #{e.to}
                  </button>
                ) : (
                  <span className="font-mono text-fg-secondary">#{e.to}</span>
                )}
                <span className="flex items-center gap-1">
                  {e.hidden && <Tag color="var(--mood-arcane)" icon={Eye}>hidden</Tag>}
                  {e.lever && <Tag color="var(--mood-treasure)" icon={Zap}>lever</Tag>}
                  {e.gated && !e.hidden && !e.lever && <Tag color="var(--status-error)" icon={Lock}>gated</Tag>}
                  {e.oneWay && <Tag color="var(--fg-secondary)">one-way</Tag>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Enemies & spawn logic */}
      <Section icon={Skull} title="Enemies & Spawn Logic">
        {!room.enemies ? (
          <Empty>No enemies spawn here.</Empty>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-fg-secondary">
              {room.enemies.mode === 'static' ? (
                <span className="font-semibold text-status-error">Static</span>
              ) : (
                <>
                  <span className="font-semibold text-resource-gold">Probabilistic</span> —{' '}
                  {room.enemies.spawnChancePct}% spawn chance per turn action
                </>
              )}
            </p>
            <ul className="space-y-1">
              {room.enemies.enemies.map((en) => (
                <li key={en.slug} className="flex items-center gap-2 text-sm">
                  {en.icon && <Icon name={en.icon} size={18} />}
                  <span className="text-fg-bright">{en.name}</span>
                  {en.level != null && <span className="text-xs text-fg-muted">Lv {en.level}</span>}
                  {en.chancePct != null && <span className="ml-auto text-xs font-semibold text-resource-gold">{en.chancePct}%</span>}
                </li>
              ))}
            </ul>
            {room.enemies.mode === 'probabilistic' && room.enemies.enemies.length > 1 && (
              <p className="text-[10px] text-fg-muted">Percentages are weighted shares of a successful spawn.</p>
            )}
          </div>
        )}
      </Section>

      {/* NPCs */}
      <Section icon={Users} title={`NPCs (${room.npcs.length})`}>
        {room.npcs.length === 0 ? (
          <Empty>No NPCs here.</Empty>
        ) : (
          <ul className="space-y-1">
            {room.npcs.map((npc) => (
              <li key={npc.name} className="flex items-center gap-2 text-sm">
                {npc.icon && <Icon name={npc.icon} size={18} />}
                <span className="text-fg-bright">{npc.name}</span>
                {npc.type === 'quest-giver' && (
                  <span className="rounded bg-accent/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent-hover">
                    {npc.questCount} quest{npc.questCount === 1 ? '' : 's'}
                  </span>
                )}
                {npc.type && npc.type !== 'quest-giver' && <span className="text-xs text-fg-muted">{npc.type}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Loot */}
      <Section icon={Coins} title={`Loot (${room.items.length})`}>
        {room.items.length === 0 ? (
          <Empty>No ground items.</Empty>
        ) : (
          <ul className="space-y-1">
            {room.items.map((it) => (
              <li key={it.slug} className="flex items-center gap-2 text-sm">
                <Icon name={it.icon} size={18} />
                <span className="text-fg-bright">{it.name}</span>
                {it.quantity > 1 && <span className="text-xs text-fg-muted">×{it.quantity}</span>}
                {it.autoRespawn && <span className="ml-auto text-[10px] font-semibold uppercase text-status-success">respawns</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Actions */}
      <Section icon={Zap} title={`Room Actions (${room.actions.length})`}>
        {room.actions.length === 0 ? (
          <Empty>No room-specific actions.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {room.actions.map((a) => (
              <li key={a.name} className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-fg-bright">{a.name}</span>
                  <span className="rounded border border-line-subtle px-1 py-0.5 text-[9px] uppercase tracking-wide text-fg-secondary">{a.kind}</span>
                </div>
                {a.detail && <p className="mt-0.5 text-xs text-fg-muted">{a.detail}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Secrets / gates */}
      <Section icon={Lock} title="Gates & Secrets">
        {room.secrets.length === 0 ? (
          <Empty>Nothing hidden here.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {room.secrets.map((s, i) => (
              <li key={i} className="flex gap-2 text-xs">
                {s.kind === 'reveal' && <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stat-mag" />}
                {s.kind === 'lever' && <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-resource-gold" />}
                {s.kind === 'gate' && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-error" />}
                <span className="text-fg-secondary">{s.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      </div>
    </div>
  )
}

function Section({ icon: IconC, title, children }: { icon: typeof Zap; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 border-b border-line-subtle pb-1 text-xs font-bold uppercase tracking-wide text-fg-secondary">
        <IconC className="h-3.5 w-3.5" />
        {title}
      </h3>
      {children}
    </section>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs italic text-fg-disabled">{children}</p>
}
function Badge({ color, text }: { color: string; text: string }) {
  return (
    <span className="rounded px-1.5 py-0.5 font-mono font-semibold text-fg-primary" style={{ backgroundColor: color }}>
      {text}
    </span>
  )
}
function FeatureChip({ icon: IconC, label }: { icon: typeof Flame; label: string }) {
  return (
    <span className="flex items-center gap-1 rounded border border-line-subtle fill-surface-raised px-1.5 py-0.5">
      <IconC className="h-3 w-3" />
      {label}
    </span>
  )
}
function Tag({ color, icon: IconC, children }: { color: string; icon?: typeof Lock; children: React.ReactNode }) {
  return (
    <span
      className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {IconC && <IconC className="h-2.5 w-2.5" />}
      {children}
    </span>
  )
}
