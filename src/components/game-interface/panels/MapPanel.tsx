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
          className="absolute top-2 right-3 z-30 p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-lg hover:bg-gray-800/50"
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
      <div className="flex-shrink-0 grow-0 h-14 border-t border-gray-700/50 px-4 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={onOpenTeleport}
          className="rounded border border-blue-600/40 bg-transparent px-4 py-1.5 text-sm font-medium text-blue-400/80 transition-colors hover:border-blue-500/60 hover:bg-blue-900/20 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          Teleport
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-gray-700 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          Close Map
        </button>
      </div>
    </div>
  )
}

