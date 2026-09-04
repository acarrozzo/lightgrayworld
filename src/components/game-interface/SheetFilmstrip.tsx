'use client'

import { useEffect, useRef } from 'react'
import { Globe, X } from 'lucide-react'
import type { MapConfigEntry } from './constants'
import { getRoomMapMarker } from './room-map-positions'

const { getWorldRegion, getMapIdForRoom } = require('@/lib/game-data/world-map')

/**
 * The region colour under each thumbnail. Literal so Tailwind's scanner sees
 * them; keyed by region id, which is also the `world.*` token suffix.
 */
const REGION_UNDERLINE: Record<string, string> = {
  'grassy-field': 'border-world-grassy-field',
  forest: 'border-world-forest',
  'red-town': 'border-world-red-town',
  'rocky-flats': 'border-world-rocky-flats',
  ocean: 'border-world-ocean',
  lobby: 'border-world-lobby',
  'room-zero': 'border-world-room-zero',
  'solar-office': 'border-world-solar-office',
}

const ITEM_CLASSES =
  'flex w-[58px] flex-shrink-0 flex-col items-center gap-1 rounded-md py-0.5 text-center transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'
const THUMB_CLASSES = 'relative block h-[52px] w-[52px] overflow-hidden rounded-md border-b-[3px] bg-surface-raised shadow-sm shadow-shadow'
const SELECTED_RING = 'ring-2 ring-hue-sky ring-offset-2 ring-offset-surface-panel'

interface SheetFilmstripProps {
  /** Every sheet the player has found, in world order. */
  sheets: MapConfigEntry[]
  currentMapId: string
  currentRoomId?: string
  onSelect: (mapId: string) => void
  /** When given, the world grid sits as the first entry of the strip. */
  onSelectWorld?: () => void
  worldSelected?: boolean
  /** When given, a close button is pinned to the strip's right end — the bottom corner on a phone. */
  onClose?: () => void
}

/**
 * The bar along the bottom of the Map tab: the world grid first, then every
 * map you have found, grouped by region with the region's colour and your own
 * sheet marked with the gold dot, and a close button pinned at the right where
 * a thumb reaches it. One tap to any map.
 */
export default function SheetFilmstrip({
  sheets,
  currentMapId,
  currentRoomId,
  onSelect,
  onSelectWorld,
  worldSelected = false,
  onClose,
}: SheetFilmstripProps) {
  const currentRef = useRef<HTMLButtonElement>(null)
  const hereMapId: string | null = currentRoomId ? getMapIdForRoom(currentRoomId) : null
  const hereMarker = currentRoomId ? getRoomMapMarker(currentRoomId) : null

  // Keep the sheet on screen visible in the strip as you step through them.
  useEffect(() => {
    if (!worldSelected) currentRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [currentMapId, worldSelected])

  const items: React.ReactNode[] = []

  if (onSelectWorld) {
    items.push(
      <button
        key="world"
        type="button"
        role="tab"
        aria-selected={worldSelected}
        title="Map of the world"
        onClick={onSelectWorld}
        className={`${ITEM_CLASSES} ${worldSelected ? 'text-fg-bright' : 'text-fg-secondary opacity-70 hover:opacity-100'}`}
      >
        <span className={`${THUMB_CLASSES} flex items-center justify-center border-hue-sky/70 ${worldSelected ? SELECTED_RING : ''}`}>
          <Globe size={24} aria-hidden="true" className="text-hue-sky" />
        </span>
        <span className="block w-full text-[9px] leading-tight">
          <span className="block truncate font-semibold">World</span>
          <span className="block truncate">Regions</span>
        </span>
      </button>,
      <span key="gap-world" aria-hidden="true" className="mb-5 mt-1.5 w-px flex-shrink-0 bg-line-strong/50" />,
    )
  }

  let previousRegion: string | null = null
  for (const sheet of sheets) {
    if (previousRegion && previousRegion !== sheet.region) {
      items.push(<span key={`gap-${sheet.id}`} aria-hidden="true" className="mb-5 mt-1.5 w-px flex-shrink-0 bg-line-strong/50" />)
    }
    previousRegion = sheet.region
    const isCurrent = !worldSelected && sheet.id === currentMapId
    const isHere = sheet.id === hereMapId
    const regionName: string = getWorldRegion(sheet.region)?.name ?? sheet.title
    const underline = REGION_UNDERLINE[sheet.region] ?? 'border-line-strong'
    items.push(
      <button
        key={sheet.id}
        ref={sheet.id === currentMapId ? currentRef : undefined}
        type="button"
        role="tab"
        aria-selected={isCurrent}
        title={sheet.title}
        onClick={() => onSelect(sheet.id)}
        className={`${ITEM_CLASSES} ${isCurrent ? 'text-fg-bright' : 'text-fg-secondary opacity-70 hover:opacity-100'}`}
      >
        <span className={`${THUMB_CLASSES} ${underline} ${isCurrent ? SELECTED_RING : ''}`}>
          <img src={sheet.src} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" />
          {isHere && hereMarker && (
            <span
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line-subtle bg-resource-gold shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--resource-gold)_50%,transparent)]"
              style={{ left: `${hereMarker.x * 100}%`, top: `${hereMarker.y * 100}%` }}
              aria-hidden="true"
            />
          )}
        </span>
        <span className="block w-full text-[9px] leading-tight">
          <span className="block truncate font-semibold">{regionName}</span>
          <span className="block truncate">{sheet.level}</span>
        </span>
      </button>,
    )
  }

  return (
    <div className="flex flex-shrink-0 items-stretch border-t border-line-subtle/40">
      <div role="tablist" aria-label="Maps you have found" className="flex min-w-0 flex-1 gap-2 overflow-x-auto px-2.5 pb-2 pt-2">
        {items}
      </div>
      {onClose && (
        <div className="flex flex-shrink-0 items-center border-l border-line-subtle/40 px-1.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong/70 text-fg-secondary transition-colors hover:bg-surface-raised/50 hover:text-fg-bright focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
