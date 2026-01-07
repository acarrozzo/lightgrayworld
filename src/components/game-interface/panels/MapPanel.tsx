'use client'

import { X } from 'lucide-react'
import MapContent, { type MapOption } from '@/components/MapContent'
import { MAP_CONFIG, type MapConfigEntry } from '../constants'

interface MapPanelProps {
  currentMapId: string
  availableMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  onClose: () => void
}

export default function MapPanel({
  currentMapId,
  availableMaps,
  onMapChange,
  onClose,
}: MapPanelProps) {
  const selectedMap = MAP_CONFIG.find(m => m.id === currentMapId)
  
  // Convert MapConfigEntry[] to MapOption[] for MapContent
  const mapOptions: MapOption[] = availableMaps.map(map => ({
    id: map.id,
    src: map.src,
    title: map.title,
  }))

  return (
    <div className="relative w-full h-full">
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
  )
}

