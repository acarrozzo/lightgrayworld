'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Crown, Globe, LocateFixed, Map as MapIcon, Minus, Plus, Sparkles, X } from 'lucide-react'
import {
  ATLAS_GRID,
  ATLAS_VIP,
  ART_SIZE,
  CELL_FRACTION,
  FIT,
  HERE_ZOOM,
  artPointAt,
  cellCentre,
  centreOn,
  clampCamera,
  foundLevels,
  getAtlasRegion,
  getAtlasSheet,
  isVipRegion,
  landingsOnSheet,
  levelOfSheet,
  neighbourIndex,
  openLandingAt,
  regionOfSheet,
  regionTile,
  roomAt,
  roomCell,
  sheetForRoom,
  stepZoom,
  tileCamera,
  tileIndexAt,
  worldPointFor,
  zoomCamera,
  type AtlasCamera,
  type AtlasDepth,
  type AtlasDirection,
  type AtlasLanding,
  type AtlasLevel,
  type TeleportContext,
} from '@/lib/world-atlas'

/**
 * What the World tab, the rail and the Teleport rows ask of the map. Each
 * carries a `seq` when sent, so asking twice for the same thing still lands.
 */
export type AtlasCommand =
  | { type: 'world'; level?: AtlasLevel }
  | { type: 'here' }
  /** Open a room's sheet, centred on it, its card open. */
  | { type: 'show'; roomId: string }
  | { type: 'sheet'; sheetId: string }
  | { type: 'region'; regionId: string }
  | { type: 'level'; level: AtlasLevel }
  /** On the sheet already open: centre a room and open its card. */
  | { type: 'focus'; roomId: string }

export interface AtlasView {
  depth: AtlasDepth
  sheetId: string
  level: AtlasLevel
}

interface WorldAtlasProps {
  command: (AtlasCommand & { seq: number }) | null
  onViewChange?: (view: AtlasView) => void
  currentRoomId?: string
  foundMapIds: string[]
  teleport: TeleportContext
  /** Rooms this character has stood in, with their names (lib/visited-rooms). */
  visitedNames: Record<string, string>
  playerMp: number
  /** Why no teleport can go right now (a fight, the party), or null. */
  blockedReason: string | null
  onTeleport: (roomId: string) => void
  /** The full-screen rail carries the levels itself; no second copy floats on the map. */
  hideLevels?: boolean
}

interface AtlasState {
  depth: AtlasDepth
  sheetId: string
  level: AtlasLevel
  cam: AtlasCamera
  /** How long the next camera change glides, in ms; 0 snaps (drags, pinches, hand-offs). */
  glide: number
  /** Sheet: the room whose card is open. */
  selected: string | null
  /** World: the landing pin whose card is open. */
  pin: { index: number; roomId: string; sheetId: string } | null
  vipOpen: boolean
  /** The arrow key that brought this sheet in, so it slides in from that side. */
  enter: { dir: AtlasDirection; n: number } | null
}

const TILE_MS = 380
const STEP_MS = 260
const EASE = 'cubic-bezier(.2,.7,.2,1)'
const GLASS = 'border border-line-strong/80 bg-surface-canvas/85 shadow-lg shadow-shadow backdrop-blur-sm'
const ICON_TAP =
  'grid place-items-center text-fg-secondary transition-colors hover:bg-surface-raised/70 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent'
/** A pin keeps its size as the art grows under it. */
const PIN_TRANSFORM = 'translate(-50%, -50%) scale(var(--atlas-inv, 1))'
const ARROW_DIRECTIONS: Record<string, AtlasDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return reduced
}

/**
 * The World tab's map: one surface from the whole world down to a single
 * room. Zoomed out it is the original's maps page — the nine regions' sheets
 * laid edge to edge, three by three, with a level control for what lies
 * beneath them (the original's "Swap level"). Tap a region, pinch, scroll or
 * press + and its square grows into its sheet; zoom back out past ×1, or tap
 * World in the crumb, and it shrinks back into the grid.
 *
 * On a sheet every room can be tapped for a card at the room: its number, its
 * name once you have stood in it ("?" before), and Teleport when it is an open
 * landing or the lair of a boss you have beaten. Open landings wear a ✦ pin
 * where you would arrive, beaten lairs a crown, you a gold dot — on the world
 * too, so a square offers its map and its teleport in one place.
 *
 * Nothing here decides a teleport: the card calls `onTeleport`, and the server
 * checks the landing, the MP and the party as it does for the Teleport rows.
 */
export default function WorldAtlas({
  command,
  onViewChange,
  currentRoomId,
  foundMapIds,
  teleport,
  visitedNames,
  playerMp,
  blockedReason,
  onTeleport,
  hideLevels = false,
}: WorldAtlasProps) {
  const hereSheet = currentRoomId ? sheetForRoom(currentRoomId) : null
  const hereLevel: AtlasLevel = hereSheet && !isVipRegion(regionOfSheet(hereSheet)) ? levelOfSheet(hereSheet) : 'surface'
  const reduced = usePrefersReducedMotion()

  const [s, setS] = useState<AtlasState>(() => ({
    depth: 'world',
    sheetId: hereSheet ?? 'grassy-field',
    level: hereLevel,
    cam: FIT,
    glide: 0,
    selected: null,
    pin: null,
    vipOpen: false,
    enter: null,
  }))
  const stateRef = useRef(s)
  stateRef.current = s

  const vpRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [note, setNote] = useState<string | null>(null)
  /** The pin under the pointer (or keyboard focus), for its hover label. `index` is its world square. */
  const [tip, setTip] = useState<{ roomId: string; sheetId: string; index: number | null } | null>(null)
  const timers = useRef<number[]>([])
  const busyRef = useRef(false)
  /** Set when the world has just been drawn at ×3 over a square and must glide out to ×1. */
  const settleRef = useRef(false)

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const flash = useCallback(
    (text: string) => {
      setNote(text)
      later(() => setNote((current) => (current === text ? null : current)), 2200)
    },
    [later],
  )

  useLayoutEffect(() => {
    const el = vpRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // A pin's label goes with the view it was on.
  useEffect(() => setTip(null), [s.depth, s.sheetId])

  // The world view tells its holder where it is, for the header and the rail.
  useEffect(() => {
    onViewChange?.({ depth: s.depth, sheetId: s.sheetId, level: s.level })
  }, [s.depth, s.sheetId, s.level, onViewChange])

  // On the world, a region's square shows the sheet you were last looking at
  // in it (so zooming out lands where you were), else the one you stand on.
  const preferFor = (regionId: string) => (regionOfSheet(s.sheetId) === regionId ? s.sheetId : hereSheet)

  // --- moving the camera ------------------------------------------------------

  const zoomIntoTile = useCallback(
    (index: number) => {
      if (busyRef.current) return
      const region = ATLAS_GRID[index]
      const prev = stateRef.current
      const prefer = regionOfSheet(prev.sheetId) === region.id ? prev.sheetId : hereSheet
      const tile = regionTile(region.id, prev.level, foundMapIds, prefer)
      if (tile.state !== 'open') {
        flash(`${region.name}: ${tile.state === 'none' ? 'nothing below' : 'not found yet'}`)
        return
      }
      const land = { depth: 'sheet' as const, sheetId: tile.sheetId, cam: FIT, glide: 0, selected: null, pin: null, vipOpen: false, enter: null }
      if (reduced) {
        setS((p) => ({ ...p, ...land }))
        return
      }
      // Grow the square to fill the stage, then swap it for its sheet at ×1 —
      // the same pixels, so the hand-off cannot be seen.
      busyRef.current = true
      setS((p) => ({ ...p, cam: tileCamera(index), glide: TILE_MS, pin: null, vipOpen: false }))
      later(() => {
        busyRef.current = false
        setS((p) => ({ ...p, ...land }))
      }, TILE_MS)
    },
    [foundMapIds, hereSheet, reduced, flash, later],
  )

  const zoomOutToWorld = useCallback(
    (level?: AtlasLevel) => {
      if (busyRef.current) return
      setS((p) => {
        const regionId = regionOfSheet(p.sheetId)
        const index = ATLAS_GRID.findIndex((r) => r.id === regionId)
        const nextLevel = level ?? (index < 0 ? p.level : levelOfSheet(p.sheetId))
        const base = { ...p, depth: 'world' as const, level: nextLevel, selected: null, pin: null, vipOpen: false, enter: null }
        if (index < 0 || reduced || p.depth === 'world' || nextLevel !== levelOfSheet(p.sheetId)) return { ...base, cam: FIT, glide: 0 }
        settleRef.current = true
        return { ...base, cam: tileCamera(index), glide: 0 }
      })
    },
    [reduced],
  )

  // Drawn at ×3 over the square just left; now glide out to the whole world.
  useLayoutEffect(() => {
    if (!settleRef.current) return
    settleRef.current = false
    void innerRef.current?.offsetWidth
    setS((p) => ({ ...p, cam: FIT, glide: TILE_MS }))
  }, [s.cam])

  const goHere = useCallback(() => {
    if (!currentRoomId || !hereSheet) return
    const cell = roomCell(hereSheet, currentRoomId, currentRoomId)
    const target = cell ? centreOn(cellCentre(cell), HERE_ZOOM) : FIT
    setS((p) => {
      const onIt = p.depth === 'sheet' && p.sheetId === hereSheet
      const atTarget = onIt && Math.abs(p.cam.z - target.z) < 0.01 && Math.abs(p.cam.px - target.px) < 0.01 && Math.abs(p.cam.py - target.py) < 0.01
      return {
        ...p,
        depth: 'sheet',
        sheetId: hereSheet,
        level: levelOfSheet(hereSheet),
        // Second press: the whole sheet.
        cam: atTarget ? FIT : target,
        glide: onIt && !reduced ? STEP_MS : 0,
        selected: null,
        pin: null,
        vipOpen: false,
        enter: null,
      }
    })
  }, [currentRoomId, hereSheet, reduced])

  const openSheet = useCallback(
    (sheetId: string, focusRoom?: string | null, select = false, from?: AtlasDirection) => {
      const cell = focusRoom ? roomCell(sheetId, focusRoom, focusRoom) : null
      setS((p) => ({
        ...p,
        depth: 'sheet',
        sheetId,
        level: levelOfSheet(sheetId),
        cam: cell ? centreOn(cellCentre(cell), HERE_ZOOM) : FIT,
        glide: 0,
        selected: select && cell ? focusRoom ?? null : null,
        pin: null,
        vipOpen: false,
        enter: from && !reduced ? { dir: from, n: (p.enter?.n ?? 0) + 1 } : null,
      }))
    },
    [reduced],
  )

  const apply = useCallback(
    (cmd: AtlasCommand) => {
      busyRef.current = false
      switch (cmd.type) {
        case 'world':
          setS((p) => ({ ...p, depth: 'world', level: cmd.level ?? hereLevel, cam: FIT, glide: 0, selected: null, pin: null, vipOpen: false, enter: null }))
          return
        case 'here':
          goHere()
          return
        case 'show':
          openSheet(sheetForRoom(cmd.roomId), cmd.roomId, true)
          return
        case 'sheet':
          openSheet(cmd.sheetId)
          return
        case 'region': {
          const levels = foundLevels(cmd.regionId, foundMapIds)
          if (levels.length === 0) return
          const p = stateRef.current
          const wantBelow = p.depth === 'sheet' ? levelOfSheet(p.sheetId) === 'below' : p.level === 'below'
          const pick = levels.find((id) => (levelOfSheet(id) === 'below') === wantBelow) ?? levels.find((id) => levelOfSheet(id) === 'surface') ?? levels[0]
          openSheet(pick, hereSheet === pick ? currentRoomId : null)
          return
        }
        case 'level':
          setS((p) => ({ ...p, depth: 'world', level: cmd.level, cam: FIT, glide: 0, selected: null, pin: null, vipOpen: false, enter: null }))
          return
        case 'focus': {
          const p = stateRef.current
          const cell = roomCell(p.sheetId, cmd.roomId, currentRoomId)
          if (!cell) return
          setS((q) => ({ ...q, cam: centreOn(cellCentre(cell), HERE_ZOOM), glide: reduced ? 0 : STEP_MS, selected: cmd.roomId, pin: null }))
          return
        }
      }
    },
    [currentRoomId, foundMapIds, goHere, hereLevel, hereSheet, openSheet, reduced],
  )

  const lastSeq = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (!command || command.seq === lastSeq.current) return
    lastSeq.current = command.seq
    apply(command)
  }, [command, apply])

  const zoomStep = useCallback(
    (dir: 1 | -1) => {
      const p = stateRef.current
      if (p.depth === 'world') {
        if (dir < 0) return
        // + on the world goes into your own square, else the middle one.
        const hereIndex = ATLAS_GRID.findIndex((r) => r.id === (hereSheet ? regionOfSheet(hereSheet) : null))
        zoomIntoTile(hereIndex >= 0 ? hereIndex : 4)
        return
      }
      if (dir < 0 && p.cam.z <= 1.001) {
        zoomOutToWorld()
        return
      }
      setS((q) => ({ ...q, cam: zoomCamera(q.cam, stepZoom(q.cam.z, dir)), glide: reduced ? 0 : STEP_MS }))
    },
    [hereSheet, reduced, zoomIntoTile, zoomOutToWorld],
  )

  // --- taps, drags, pinches, the wheel ------------------------------------------

  const S = Math.min(size.w, size.h)
  const stageLeft = (size.w - S) / 2
  const stageTop = (size.h - S) / 2

  /** A point of the art (0..1) under a screen point, through the current camera. */
  const artAt = (clientX: number, clientY: number) => {
    const box = innerRef.current?.getBoundingClientRect()
    return box ? artPointAt(clientX, clientY, box) : null
  }

  const tap = (clientX: number, clientY: number) => {
    const p = stateRef.current
    if (p.vipOpen || p.pin) {
      setS((q) => ({ ...q, vipOpen: false, pin: null }))
      return
    }
    const point = artAt(clientX, clientY)
    if (!point) return
    if (p.depth === 'world') {
      const index = tileIndexAt(point.x, point.y)
      if (index !== null) zoomIntoTile(index)
      return
    }
    // The dark space around a sheet is the world it sits in: tapping it zooms out.
    if (point.x < 0 || point.y < 0 || point.x > 1 || point.y > 1) {
      zoomOutToWorld()
      return
    }
    const room = roomAt(p.sheetId, point.x * ART_SIZE, point.y * ART_SIZE, currentRoomId)
    setS((q) => ({ ...q, selected: room && room !== q.selected ? room : null }))
  }

  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<
    | { kind: 'press'; x: number; y: number; cam: AtlasCamera; moved: boolean }
    | { kind: 'pinch'; d0: number; cam: AtlasCamera; mid0: { x: number; y: number }; focal: { x: number; y: number } | null; done: boolean }
    | null
  >(null)

  const distance = () => {
    const [a, b] = Array.from(pointers.current.values())
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const midpoint = () => {
    const [a, b] = Array.from(pointers.current.values())
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, [data-atlas-ui]')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Already captured or gone; the gesture still works without it.
    }
    if (pointers.current.size === 1) {
      gesture.current = { kind: 'press', x: e.clientX, y: e.clientY, cam: stateRef.current.cam, moved: false }
    } else if (pointers.current.size === 2) {
      const mid = midpoint()
      gesture.current = { kind: 'pinch', d0: distance(), cam: stateRef.current.cam, mid0: mid, focal: artAt(mid.x, mid.y), done: false }
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const p = stateRef.current
    if (!g || busyRef.current || S <= 0) return
    if (g.kind === 'press') {
      const dx = e.clientX - g.x
      const dy = e.clientY - g.y
      if (!g.moved && Math.hypot(dx, dy) > 6) g.moved = true
      if (g.moved && p.depth === 'sheet' && p.cam.z > 1) {
        setS((q) => ({ ...q, cam: clampCamera({ ...g.cam, px: g.cam.px + dx / S, py: g.cam.py + dy / S }), glide: 0 }))
      }
      return
    }
    if (g.kind === 'pinch' && pointers.current.size >= 2 && !g.done) {
      const ratio = distance() / g.d0
      if (p.depth === 'world') {
        if (ratio > 1.3 && g.focal) {
          g.done = true
          const index = tileIndexAt(g.focal.x, g.focal.y)
          if (index !== null) zoomIntoTile(index)
        }
        return
      }
      if (g.cam.z <= 1.001 && ratio < 0.75) {
        g.done = true
        zoomOutToWorld()
        return
      }
      const mid = midpoint()
      const zoomed = zoomCamera(g.cam, g.cam.z * ratio, g.focal ?? undefined)
      setS((q) => ({
        ...q,
        cam: clampCamera({ ...zoomed, px: zoomed.px + (mid.x - g.mid0.x) / S, py: zoomed.py + (mid.y - g.mid0.y) / S }),
        glide: 0,
      }))
    }
  }

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (g?.kind === 'press' && !g.moved && !cancelled) tap(e.clientX, e.clientY)
    // A pinch that loses a finger ends; the remaining finger does not start a drag mid-air.
    gesture.current = null
  }

  // The wheel (and a trackpad's pinch, which arrives as ctrl+wheel) zooms
  // about the pointer. On the world, rolling in enters the square under it;
  // on a sheet at ×1, rolling out returns to the world. A native listener so
  // it can stop the page from scrolling behind the map.
  const wheelPush = useRef({ amount: 1, at: 0 })
  useEffect(() => {
    const el = vpRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (busyRef.current) return
      const p = stateRef.current
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022))
      const push = wheelPush.current
      if (performance.now() - push.at > 260) push.amount = 1
      push.at = performance.now()
      const box = innerRef.current?.getBoundingClientRect()
      const point = box ? artPointAt(e.clientX, e.clientY, box) : null
      if (p.depth === 'world') {
        if (factor <= 1) return
        push.amount *= factor
        if (push.amount > 1.35 && point) {
          push.amount = 1
          const index = tileIndexAt(point.x, point.y)
          if (index !== null) zoomIntoTile(index)
        }
        return
      }
      if (p.cam.z <= 1.001 && factor < 1) {
        push.amount *= factor
        if (push.amount < 0.7) {
          push.amount = 1
          zoomOutToWorld()
        }
        return
      }
      setS((q) => ({ ...q, cam: zoomCamera(q.cam, q.cam.z * factor, point ?? undefined), glide: 0 }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomIntoTile, zoomOutToWorld])

  // The arrow keys walk the world's 3×3 from the sheet on screen: up from the
  // Grassy Field is the Mountains. You stay on your level — from the sewers,
  // left is the Rocky Flats' underground — and a region with nothing found
  // there says so. Typing in the command line or chat, and any control that
  // uses the arrows itself (the panel's resize handle), is left alone.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const dir = ARROW_DIRECTIONS[event.key]
      if (!dir || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return
      const p = stateRef.current
      if (p.depth !== 'sheet' || busyRef.current) return
      // The VIP rooms sit outside the grid; there is nowhere to walk from them.
      const index = ATLAS_GRID.findIndex((r) => r.id === regionOfSheet(p.sheetId))
      if (index < 0) return
      event.preventDefault()
      const next = neighbourIndex(index, dir)
      if (next === null) {
        flash('The edge of the world')
        return
      }
      const region = ATLAS_GRID[next]
      const tile = regionTile(region.id, levelOfSheet(p.sheetId), foundMapIds, hereSheet)
      if (tile.state !== 'open') {
        flash(`${region.name}: ${tile.state === 'none' ? 'nothing below' : 'not found yet'}`)
        return
      }
      openSheet(tile.sheetId, null, false, dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [foundMapIds, hereSheet, openSheet, flash])

  // Escape closes a card or menu before it closes anything of the tab's.
  const somethingOpen = !!(s.selected || s.pin || s.vipOpen)
  useEffect(() => {
    if (!somethingOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      setS((q) => ({ ...q, selected: null, pin: null, vipOpen: false }))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [somethingOpen])

  // --- drawing ----------------------------------------------------------------

  const { depth, sheetId, level, cam } = s
  const sheet = getAtlasSheet(sheetId)
  const regionId = regionOfSheet(sheetId)
  const region = regionId ? getAtlasRegion(regionId) : null
  const sheetLandings = useMemo(() => (depth === 'sheet' ? landingsOnSheet(sheetId, teleport) : []), [depth, sheetId, teleport])
  const hereCell = currentRoomId && hereSheet ? roomCell(hereSheet, currentRoomId, currentRoomId) : null
  const vipSheets = ATLAS_VIP.map((r) => r.id).filter((id) => foundMapIds.includes(id))

  /** Where a point of the art (0..1) sits in the map's own box, through the camera. */
  const toScreen = (fx: number, fy: number) => ({
    x: stageLeft + S / 2 + ((fx - 0.5) * cam.z + cam.px) * S,
    y: stageTop + S / 2 + ((fy - 0.5) * cam.z + cam.py) * S,
  })

  // The bands above and below the square map on a tall screen hold the
  // controls, off the art; on a wide one they float at its sides.
  const band = (size.h - S) / 2
  const levelsInBand = band >= 84
  const zoomInBand = band >= 50

  const innerStyle = {
    transform: `translate(${cam.px * S}px, ${cam.py * S}px) scale(${cam.z})`,
    '--atlas-inv': 1 / cam.z,
    transition: s.glide ? `transform ${s.glide}ms ${EASE}, --atlas-inv ${s.glide}ms ${EASE}` : 'none',
  } as CSSProperties

  const pinAt = (x: number, y: number): CSSProperties => ({ left: `${x * 100}%`, top: `${y * 100}%`, transform: PIN_TRANSFORM })

  const hereDot = (x: number, y: number) => (
    <span className="pointer-events-none absolute z-[3]" style={pinAt(x, y)} role="img" aria-label="You are here">
      <span className="absolute inset-0 -m-1.5 rounded-full bg-resource-gold/40 motion-safe:animate-ping" aria-hidden="true" />
      <span className="block h-3 w-3 rounded-full border-2 border-line-subtle bg-resource-gold" aria-hidden="true" />
    </span>
  )

  const landingPin = (landing: AtlasLanding, onSheet: string, x: number, y: number, onPress: () => void, index: number | null = null) => (
    <button
      key={landing.roomId}
      type="button"
      onClick={() => {
        setTip(null)
        onPress()
      }}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') setTip({ roomId: landing.roomId, sheetId: onSheet, index })
      }}
      onPointerLeave={() => setTip((t) => (t?.roomId === landing.roomId ? null : t))}
      onFocus={() => setTip({ roomId: landing.roomId, sheetId: onSheet, index })}
      onBlur={() => setTip((t) => (t?.roomId === landing.roomId ? null : t))}
      aria-label={landing.kind === 'boss' ? `${landing.name}'s lair, ${landing.cost} MP` : `${landing.name} landing, ${landing.cost} MP`}
      className={`absolute z-[2] grid place-items-center rounded-full shadow-md shadow-shadow ring-1 ring-fg-bright/30 transition-[filter] hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
        landing.kind === 'boss' ? 'fill-hue-purple' : 'fill-resource-mp'
      } ${index !== null ? 'h-[18px] w-[18px]' : 'h-[22px] w-[22px]'}`}
      style={pinAt(x, y)}
    >
      {landing.kind === 'boss' ? <Crown size={index !== null ? 10 : 12} aria-hidden="true" /> : <Sparkles size={index !== null ? 10 : 12} aria-hidden="true" />}
    </button>
  )

  const worldContent = () => {
    const tiles = ATLAS_GRID.map((r, index) => {
      const tile = regionTile(r.id, level, foundMapIds, preferFor(r.id))
      const box: CSSProperties = {
        left: `${((index % 3) * 100) / 3}%`,
        top: `${(Math.floor(index / 3) * 100) / 3}%`,
        width: '33.3334%',
        height: '33.3334%',
      }
      if (tile.state === 'open') {
        const art = getAtlasSheet(tile.sheetId)
        return <img key={r.id} src={art?.src} alt="" draggable={false} decoding="async" className="pointer-events-none absolute block select-none" style={box} />
      }
      return (
        <div key={r.id} className="pointer-events-none absolute grid place-items-center bg-surface-sunken px-1 text-center shadow-[inset_0_0_0_0.5px_var(--line-subtle)]" style={box}>
          <span className="leading-tight text-fg-disabled">
            {tile.state === 'locked' && <span className="block font-mono text-lg text-line-strong">?</span>}
            <span className="block text-[11px] font-semibold text-fg-muted">{r.name}</span>
            <span className="block text-[10px]">{tile.state === 'none' ? 'Nothing below' : 'Not found yet'}</span>
          </span>
        </div>
      )
    })
    // Landings on the art where you would arrive (bosses wait for the sheet),
    // and you, on whichever square holds the sheet under your feet.
    const pins: ReactNode[] = []
    ATLAS_GRID.forEach((r, index) => {
      const tile = regionTile(r.id, level, foundMapIds, preferFor(r.id))
      if (tile.state !== 'open') return
      for (const landing of landingsOnSheet(tile.sheetId, teleport)) {
        if (landing.kind !== 'landing') continue
        const cell = roomCell(tile.sheetId, landing.roomId)
        if (!cell) continue
        const c = cellCentre(cell)
        const at = worldPointFor(index, c.x, c.y)
        pins.push(
          landingPin(landing, tile.sheetId, at.x, at.y, () => setS((q) => ({ ...q, pin: { index, roomId: landing.roomId, sheetId: tile.sheetId }, vipOpen: false })), index),
        )
      }
      if (tile.sheetId === hereSheet && hereCell) {
        const c = cellCentre(hereCell)
        const at = worldPointFor(index, c.x, c.y)
        pins.push(<span key="here">{hereDot(at.x, at.y)}</span>)
      }
    })
    return (
      <>
        {tiles}
        {pins}
      </>
    )
  }

  const selectedCell = depth === 'sheet' && s.selected ? roomCell(sheetId, s.selected, currentRoomId) : null

  const sheetContent = () => (
    <>
      {sheet && <img src={sheet.src} alt={`${sheet.title} map`} draggable={false} decoding="async" className="pointer-events-none absolute inset-0 block h-full w-full select-none" />}
      {selectedCell && (
        <span
          className="pointer-events-none absolute z-[1]"
          style={{
            left: `${(selectedCell.x / ART_SIZE) * 100}%`,
            top: `${(selectedCell.y / ART_SIZE) * 100}%`,
            width: `${CELL_FRACTION * 100}%`,
            height: `${CELL_FRACTION * 100}%`,
            border: 'calc(2.5px * var(--atlas-inv, 1)) solid var(--hue-sky)',
            borderRadius: 'calc(6px * var(--atlas-inv, 1))',
            boxShadow: '0 0 0 calc(3px * var(--atlas-inv, 1)) color-mix(in srgb, var(--hue-sky) 30%, transparent)',
          }}
          aria-hidden="true"
        />
      )}
      {sheetLandings.map((landing) => {
        const cell = roomCell(sheetId, landing.roomId)
        if (!cell) return null
        const c = cellCentre(cell)
        return landingPin(landing, sheetId, c.x, c.y, () => setS((q) => ({ ...q, selected: q.selected === landing.roomId ? null : landing.roomId })))
      })}
      {hereSheet === sheetId && hereCell && hereDot(cellCentre(hereCell).x, cellCentre(hereCell).y)}
    </>
  )

  // --- the card at the room -----------------------------------------------------

  let card: ReactNode = null
  if (S > 0 && depth === 'sheet' && selectedCell && s.selected) {
    const c = cellCentre(selectedCell)
    const at = toScreen(c.x, c.y)
    const half = (CELL_FRACTION / 2) * S * cam.z
    card = (
      <AtlasCard
        key={s.selected}
        roomId={s.selected}
        title={sheet?.title ?? ''}
        anchor={{ x: at.x, top: at.y - half, bottom: at.y + half }}
        box={size}
        landing={openLandingAt(s.selected, teleport)}
        isHere={s.selected === currentRoomId}
        visitedName={visitedNames[s.selected]}
        playerMp={playerMp}
        blockedReason={blockedReason}
        onTeleport={onTeleport}
        onClose={() => setS((q) => ({ ...q, selected: null }))}
      />
    )
  } else if (S > 0 && depth === 'world' && s.pin) {
    const pin = s.pin
    const cell = roomCell(pin.sheetId, pin.roomId)
    if (cell) {
      const c = cellCentre(cell)
      const world = worldPointFor(pin.index, c.x, c.y)
      const at = toScreen(world.x, world.y)
      card = (
        <AtlasCard
          key={`pin-${pin.roomId}`}
          roomId={pin.roomId}
          title={getAtlasSheet(pin.sheetId)?.title ?? ''}
          anchor={{ x: at.x, top: at.y - 11, bottom: at.y + 11 }}
          box={size}
          landing={openLandingAt(pin.roomId, teleport)}
          isHere={pin.roomId === currentRoomId}
          visitedName={visitedNames[pin.roomId]}
          playerMp={playerMp}
          blockedReason={blockedReason}
          onTeleport={onTeleport}
          onOpenMap={() => openSheet(pin.sheetId, pin.roomId, true)}
          onClose={() => setS((q) => ({ ...q, pin: null }))}
        />
      )
    }
  }

  // --- the label over a pin --------------------------------------------------------

  let tipNode: ReactNode = null
  const tipCardOpen = !!tip && (depth === 'sheet' ? s.selected === tip.roomId : s.pin?.roomId === tip.roomId)
  if (tip && S > 0 && !tipCardOpen) {
    const landing = openLandingAt(tip.roomId, teleport)
    const cell = roomCell(tip.sheetId, tip.roomId)
    const tipSheet = getAtlasSheet(tip.sheetId)
    if (landing && cell && tipSheet) {
      const c = cellCentre(cell)
      const point = tip.index !== null ? worldPointFor(tip.index, c.x, c.y) : c
      const at = toScreen(point.x, point.y)
      const isHere = tip.roomId === currentRoomId
      tipNode = (
        <PinTip
          key={tip.roomId}
          anchor={{ x: at.x, y: at.y, r: tip.index !== null ? 9 : 11 }}
          box={size}
          landing={landing}
          place={`${getAtlasRegion(tipSheet.region)?.name ?? tipSheet.title}${tipSheet.level !== 'Surface' ? ` · ${tipSheet.level}` : ''}`}
          isHere={isHere}
          reason={isHere ? null : blockedReason ?? (playerMp < landing.cost ? 'Not enough MP' : null)}
        />
      )
    }
  }

  // --- the controls on the map ----------------------------------------------------

  const levelItems: Array<{ key: string; label: string; on: boolean; mine: boolean; go: () => void }> =
    depth === 'world'
      ? (['surface', 'below'] as const).map((lv) => ({
          key: lv,
          label: lv === 'surface' ? 'Surface' : 'Below',
          on: level === lv,
          mine: hereLevel === lv && !!hereSheet && !isVipRegion(regionOfSheet(hereSheet)),
          go: () => setS((q) => ({ ...q, level: lv, pin: null, vipOpen: false })),
        }))
      : regionId && !isVipRegion(regionId)
        ? foundLevels(regionId, foundMapIds).map((id) => ({
            key: id,
            label: getAtlasSheet(id)?.level ?? id,
            on: id === sheetId,
            mine: id === hereSheet,
            go: () => openSheet(id, id === hereSheet ? currentRoomId : null),
          }))
        : []
  const showLevels = !hideLevels && (depth === 'world' || levelItems.length > 1)

  return (
    <div
      ref={vpRef}
      className={`relative min-h-0 min-w-0 flex-1 touch-none select-none overflow-hidden bg-surface-canvas ${depth === 'sheet' ? 'cursor-zoom-out' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerEnd(e)}
      onPointerCancel={(e) => onPointerEnd(e, true)}
      aria-label={depth === 'world' ? 'Map of the world' : `Map of ${sheet?.title ?? 'this place'}`}
      role="application"
    >
      {S > 0 && (
        <div
          key={`${depth}:${sheetId}:${s.enter?.n ?? 0}`}
          className="absolute"
          style={{ left: stageLeft, top: stageTop, width: S, height: S, animation: depth === 'sheet' && s.enter ? `atlas-from-${s.enter.dir} 220ms ${EASE}` : undefined }}
        >
          <div ref={innerRef} className={`absolute inset-0 origin-center will-change-transform ${depth === 'sheet' && cam.z > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`} style={innerStyle}>
            {depth === 'world' ? worldContent() : sheetContent()}
          </div>
        </div>
      )}

      {/* Where you are in the world: World › Red Town › Sewers. */}
      <div data-atlas-ui className={`${GLASS} absolute left-2 top-2 z-[4] flex max-w-[calc(100%-1rem)] items-center gap-0.5 rounded-lg p-0.5 text-xs`}>
        {depth === 'world' ? (
          <>
            <span className="flex h-7 items-center gap-1.5 px-2 font-semibold text-fg-bright">
              <Globe size={13} aria-hidden="true" />
              World
            </span>
            <span className="text-fg-disabled" aria-hidden="true">·</span>
            <span className="px-1.5 text-fg-secondary">{level === 'below' ? 'Below' : 'Surface'}</span>
          </>
        ) : (
          <>
            <button type="button" onClick={() => zoomOutToWorld()} className="flex h-7 items-center gap-1.5 rounded-md px-2 text-hue-sky transition-colors hover:bg-surface-raised/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus" title="Zoom out to the world">
              <Globe size={13} aria-hidden="true" />
              World
            </button>
            <ChevronRight size={12} className="text-fg-disabled" aria-hidden="true" />
            <span className="truncate px-1 font-semibold text-fg-bright">{region?.name ?? sheet?.title}</span>
            {sheet && sheet.level !== 'Surface' && (
              <>
                <ChevronRight size={12} className="text-fg-disabled" aria-hidden="true" />
                <span className="whitespace-nowrap px-1 pr-2 text-fg-secondary">{sheet.level}</span>
              </>
            )}
          </>
        )}
      </div>

      {/* The level stack: Surface / Below on the world, the region's found sheets on a sheet. */}
      {showLevels && (
        <div
          data-atlas-ui
          role="group"
          aria-label="Level"
          className={`${GLASS} absolute left-2 z-[4] flex rounded-xl p-0.5 ${levelsInBand ? 'top-11 flex-row items-center' : 'top-1/2 -translate-y-1/2 flex-col'}`}
        >
          <span className="px-1.5 py-0.5 text-center font-mono text-[9px] uppercase tracking-widest text-fg-muted">Level</span>
          {levelItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.go}
              aria-pressed={item.on}
              className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[11px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                item.on ? 'bg-hue-sky/15 text-hue-sky ring-1 ring-hue-sky' : 'text-fg-secondary hover:bg-surface-raised/70'
              }`}
            >
              <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.mine ? 'bg-resource-gold' : item.on ? 'bg-hue-sky' : 'bg-line-strong'}`} />
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* VIP rooms are no region of the world; they sit behind a button. */}
      {depth === 'world' && vipSheets.length > 0 && (
        <div data-atlas-ui className="absolute right-2 top-2 z-[5]">
          <button
            type="button"
            onClick={() => setS((q) => ({ ...q, vipOpen: !q.vipOpen, pin: null }))}
            aria-expanded={s.vipOpen}
            className={`${GLASS} flex h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold uppercase tracking-wider text-resource-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus`}
          >
            VIP
            <ChevronDown size={12} aria-hidden="true" />
          </button>
          {s.vipOpen && (
            <div className="absolute right-0 top-full mt-1.5 flex min-w-[190px] flex-col gap-0.5 rounded-xl border border-line-strong bg-surface-panel p-1.5 shadow-xl shadow-shadow">
              {vipSheets.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openSheet(id, hereSheet === id ? currentRoomId : null)}
                  className="flex h-8 items-center gap-2 rounded-lg px-2 text-left text-xs text-fg-primary hover:bg-surface-raised/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
                >
                  <MapIcon size={13} className="text-fg-muted" aria-hidden="true" />
                  {getAtlasRegion(id)?.name ?? id}
                  {hereSheet === id && <span className="ml-auto text-[10px] text-resource-gold">you</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Here, and zoom. */}
      <div data-atlas-ui className={`absolute right-2 z-[4] flex gap-1.5 ${zoomInBand ? 'bottom-2 flex-row' : 'top-1/2 -translate-y-1/2 flex-col'}`}>
        <button type="button" onClick={goHere} disabled={!hereSheet} aria-label="Show where you are" title="Where you are (again: the whole sheet)" className={`${GLASS} grid h-9 w-9 place-items-center rounded-lg text-resource-gold transition-colors hover:bg-surface-raised/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-35`}>
          <LocateFixed size={17} aria-hidden="true" />
        </button>
        <div className={`${GLASS} flex overflow-hidden rounded-lg ${zoomInBand ? 'flex-row divide-x' : 'flex-col divide-y'} divide-line-strong/80`}>
          <button type="button" onClick={() => zoomStep(1)} disabled={depth === 'sheet' && cam.z >= 3.199} aria-label="Zoom in" className={`${ICON_TAP} h-9 w-9`}>
            <Plus size={16} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomStep(-1)} disabled={depth === 'world'} aria-label={depth === 'sheet' && cam.z <= 1.001 ? 'Zoom out to the world' : 'Zoom out'} className={`${ICON_TAP} h-9 w-9`}>
            <Minus size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {note && (
        <div role="status" className="pointer-events-none absolute bottom-3 left-1/2 z-[6] -translate-x-1/2 whitespace-nowrap rounded-lg border border-line-strong bg-surface-raised px-3 py-1.5 text-xs text-fg-primary shadow-lg shadow-shadow">
          {note}
        </div>
      )}

      {tipNode}
      {card}
    </div>
  )
}

/**
 * The label a teleport pin shows under the pointer or keyboard focus: where it
 * lands, which map it is on, and what it costs — or why it cannot go. Clicking
 * the pin still opens the full card.
 */
function PinTip({
  anchor,
  box,
  landing,
  place,
  isHere,
  reason,
}: {
  anchor: { x: number; y: number; r: number }
  box: { w: number; h: number }
  landing: AtlasLanding
  place: string
  isHere: boolean
  reason: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (el) setDims({ w: el.offsetWidth, h: el.offsetHeight })
  }, [landing.roomId, reason, isHere])

  const left = Math.max(8, Math.min(box.w - dims.w - 8, anchor.x - dims.w / 2))
  const above = anchor.y - anchor.r - 8 - dims.h
  const top = above >= 8 ? above : anchor.y + anchor.r + 8
  const boss = landing.kind === 'boss'

  return (
    <div
      ref={ref}
      role="tooltip"
      className="pointer-events-none absolute z-[6] flex flex-col gap-0.5 rounded-lg border border-line-strong bg-surface-panel px-2.5 py-1.5 shadow-lg shadow-shadow"
      style={{ left, top, visibility: dims.w ? 'visible' : 'hidden' }}
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-fg-primary">
        {boss ? <Crown size={12} className="text-hue-purple" aria-hidden="true" /> : <Sparkles size={12} className="text-resource-mp" aria-hidden="true" />}
        {landing.name}
        {boss && <span className="font-mono text-[10px] text-resource-gold">L{landing.level}</span>}
      </span>
      <span className="whitespace-nowrap text-[10.5px] text-fg-muted">
        {place}
        {boss ? ' · lair' : landing.guild ? ' · guild hall' : ''}
      </span>
      <span className={`whitespace-nowrap text-[10.5px] font-semibold ${isHere ? 'text-resource-gold' : reason ? 'text-fg-muted' : 'text-resource-mp'}`}>
        {isHere ? 'You are here' : reason ? `${reason} · ${landing.cost} MP` : `Teleport · ${landing.cost} MP`}
      </span>
    </div>
  )
}

interface AtlasCardProps {
  roomId: string
  /** The sheet's title, the line under the room's name. */
  title: string
  /** The room's cell (or pin) on screen, in the map box's own pixels. */
  anchor: { x: number; top: number; bottom: number }
  box: { w: number; h: number }
  landing: AtlasLanding | null
  isHere: boolean
  visitedName?: string
  playerMp: number
  blockedReason: string | null
  onTeleport: (roomId: string) => void
  /** World pins: open the landing's sheet. */
  onOpenMap?: () => void
  onClose: () => void
}

/**
 * The card at a room: above it when there is room, below it when not, kept
 * inside the map. A room you have not stood in is "?" — the art prints every
 * name, but the card only tells you what you have earned — except a landing
 * you can already teleport to, which the Teleport rows name anyway.
 */
function AtlasCard({ roomId, title, anchor, box, landing, isHere, visitedName, playerMp, blockedReason, onTeleport, onOpenMap, onClose }: AtlasCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setHeight(el.offsetHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const width = Math.min(264, box.w - 16)
  const left = Math.max(8, Math.min(box.w - width - 8, anchor.x - width / 2))
  const above = anchor.top - height - 8
  const top = Math.max(8, Math.min(box.h - height - 8, above >= 8 ? above : anchor.bottom + 8))

  const name = visitedName ?? (landing?.kind === 'landing' ? landing.name : null)
  const tooPoor = !!landing && playerMp < landing.cost
  const reason = !landing || isHere ? null : blockedReason ?? (tooPoor ? `You need ${landing.cost} MP. Rest first.` : null)

  return (
    <div
      ref={ref}
      data-atlas-ui
      role="dialog"
      aria-label={`Room ${roomId}`}
      className="absolute z-[7] flex flex-col gap-2 rounded-xl border border-line-strong bg-surface-panel py-2.5 pl-3 pr-2.5 shadow-xl shadow-shadow"
      style={{ left, top, width, visibility: height ? 'visible' : 'hidden' }}
    >
      <div className="flex items-start gap-2">
        <span className="mt-px shrink-0 rounded-md border border-line-strong px-1.5 font-mono text-[11px] leading-[18px] text-fg-muted">#{roomId}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight text-fg-bright">{name ?? '?'}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-fg-muted">{name ? title : 'Not explored yet'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-fg-secondary hover:bg-surface-raised/70 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10.5px]">
        {isHere && <span className="rounded-full border border-resource-gold/50 px-2 text-resource-gold">You are here</span>}
        {!isHere && <span className={`rounded-full border px-2 ${visitedName ? 'border-line-strong text-fg-secondary' : 'border-line-subtle text-fg-disabled'}`}>{visitedName ? 'Visited' : 'Not visited'}</span>}
        {landing?.kind === 'landing' && (
          <span className="rounded-full border border-resource-mp/60 px-2 text-resource-mp">✦ Landing{landing.guild ? ' · guild hall' : ''}</span>
        )}
        {landing?.kind === 'boss' && (
          <span className="rounded-full border border-hue-purple/60 px-2 text-hue-purple">
            ♛ {landing.name} · L{landing.level} · beaten
          </span>
        )}
      </div>
      {(landing && !isHere) || onOpenMap ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {landing && !isHere && (
            <button
              type="button"
              disabled={!!reason}
              onClick={() => onTeleport(roomId)}
              title={reason ?? `Teleport here · ${landing.cost} MP`}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-fg-bright/20 fill-resource-mp px-3 text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
            >
              <Sparkles size={13} aria-hidden="true" />
              Teleport here
              <span className="rounded-full bg-surface-canvas/30 px-1.5 text-[10px]">{landing.cost} MP</span>
            </button>
          )}
          {onOpenMap && (
            <button
              type="button"
              onClick={onOpenMap}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs text-fg-secondary transition-colors hover:bg-surface-raised/60 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
            >
              <MapIcon size={13} aria-hidden="true" />
              Open map
            </button>
          )}
        </div>
      ) : null}
      {reason && <p className="text-[10.5px] leading-snug text-fg-muted">{reason}</p>}
    </div>
  )
}
