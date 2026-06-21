'use client'

import { X } from 'lucide-react'
import MapContent, { type MapOption } from '@/components/MapContent'
import { MAP_CONFIG, type MapConfigEntry } from '../constants'

interface MapPanelProps {
  currentMapId: string
  availableMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  onClose: () => void
  onOpenTeleport: () => void
}

export default function MapPanel({
  currentMapId,
  availableMaps,
  onMapChange,
  onClose,
  onOpenTeleport,
}: MapPanelProps) {
  const selectedMap = MAP_CONFIG.find(m => m.id === currentMapId)
  
  // Convert MapConfigEntry[] to MapOption[] for MapContent
  const mapOptions: MapOption[] = availableMaps.map(map => ({
    id: map.id,
    src: map.src,
    title: map.title,
  }))

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
          mapSrc={selectedMap?.src || ''}
          mapTitle={selectedMap?.title || 'Map'}
          availableMaps={mapOptions}
          currentMapId={currentMapId}
          onMapChange={onMapChange}
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

