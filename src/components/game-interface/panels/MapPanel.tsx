'use client'

import { X } from 'lucide-react'
import MapContent from '@/components/MapContent'
import { type MapConfigEntry } from '../constants'
import { resolveMapView } from '../utils'

interface MapPanelProps {
  currentMapId: string
  currentRoomId?: string
  availableMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  onClose: () => void
  onOpenTeleport: () => void
}

export default function MapPanel({
  currentMapId,
  currentRoomId,
  availableMaps,
  onMapChange,
  onClose,
  onOpenTeleport,
}: MapPanelProps) {
  const mapView = resolveMapView(currentMapId, availableMaps, currentRoomId)

  return (
    <div className="flex flex-col w-full h-full">
      <div className="relative flex-1 min-h-0">
        <button
          onClick={onClose}
          className="absolute top-2 right-3 z-30 p-2 text-fg-secondary hover:text-fg-bright transition-colors duration-200 rounded-lg hover:bg-surface-raised/50"
          title="Close"
          aria-label="Close"
        >
          <X size={20} />
        </button>
        <MapContent
          mapSrc={mapView.src}
          mapTitle={mapView.title}
          availableMaps={mapView.options}
          currentMapId={currentMapId}
          onMapChange={onMapChange}
          marker={mapView.marker}
        />
      </div>
      <div className="flex-shrink-0 grow-0 h-14 border-t border-line-subtle/50 px-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onOpenTeleport}
          className="rounded border border-resource-mp/40 bg-transparent px-4 py-1.5 text-sm font-medium text-resource-mp/80 transition-colors hover:border-resource-mp/60 hover:bg-resource-mp/20 hover:text-resource-mp focus:outline-none focus-visible:ring-2 focus-visible:ring-resource-mp focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
        >
          Teleport
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-surface-hover px-4 py-1.5 text-sm font-medium text-fg-bright transition-colors hover:bg-surface-selected focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
        >
          Close Map
        </button>
      </div>
    </div>
  )
}

