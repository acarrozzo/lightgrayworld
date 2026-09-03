'use client'

import MapView from '../MapView'
import { type MapConfigEntry } from '../constants'

interface MapPanelProps {
  currentMapId: string
  currentRoomId?: string
  availableMaps: MapConfigEntry[]
  onMapChange: (mapId: string) => void
  onClose: () => void
  onOpenTeleport: () => void
}

/**
 * The full-screen map overlay: the same MapView the sidebar hosts. It closes
 * from the X in MapView's top-right corner; the footer jumps to Fast travel.
 */
export default function MapPanel({
  currentMapId,
  currentRoomId,
  availableMaps,
  onMapChange,
  onClose,
  onOpenTeleport,
}: MapPanelProps) {
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex-1 min-h-0">
        <MapView
          variant="fullscreen"
          currentRoomId={currentRoomId}
          currentMapId={currentMapId}
          foundMaps={availableMaps}
          onMapChange={onMapChange}
          onClose={onClose}
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
      </div>
    </div>
  )
}
