'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface MapContentProps {
  mapSrc: string
  mapTitle: string
  /** Player position as a 0..1 fraction of the map image, or null to hide it. */
  marker?: { x: number; y: number } | null
  /** A horizontal swipe across the unzoomed sheet: step to the previous or next map. */
  onSwipe?: (direction: 'prev' | 'next') => void
}

/**
 * One map sheet: the artwork, a zoom/pan surface, and the "you are here"
 * marker. Choosing *which* sheet is the world layer's job (the filmstrip and
 * the World grid); this component only draws the one it is given.
 */
export default function MapContent({ mapSrc, mapTitle, marker, onSwipe }: MapContentProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  // Rendered box + intrinsic size of the map image, so the marker can be placed
  // on the painted pixels rather than on the (possibly letterboxed) element box.
  const [imgMetrics, setImgMetrics] = useState<{ w: number; h: number; natW: number; natH: number } | null>(null)
  const pointerDownPositionRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)
  // Where the pointer ended up relative to where it went down, for the swipe.
  const lastDeltaRef = useRef({ x: 0, y: 0 })

  const resetView = () => {
    setIsZoomed(false)
    setDragOffset({ x: 0, y: 0 })
    setIsDragging(false)
    dragStartRef.current = null
    pointerDownPositionRef.current = null
    hasMovedRef.current = false
    pointerIdRef.current = null
  }

  useEffect(() => {
    resetView()
  }, [mapSrc])

  const measureImage = useCallback(() => {
    const el = imgRef.current
    if (!el) return
    setImgMetrics({ w: el.clientWidth, h: el.clientHeight, natW: el.naturalWidth, natH: el.naturalHeight })
  }, [])

  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    measureImage()
    const observer = new ResizeObserver(() => measureImage())
    observer.observe(el)
    return () => observer.disconnect()
  }, [measureImage, mapSrc, isZoomed])

  // Marker offset in element-box pixels, accounting for object-contain letterboxing.
  let markerOffset: { left: number; top: number } | null = null
  if (marker && imgMetrics && imgMetrics.natW > 0 && imgMetrics.natH > 0 && imgMetrics.w > 0 && imgMetrics.h > 0) {
    const scale = Math.min(imgMetrics.w / imgMetrics.natW, imgMetrics.h / imgMetrics.natH)
    const paintedW = imgMetrics.natW * scale
    const paintedH = imgMetrics.natH * scale
    markerOffset = {
      left: (imgMetrics.w - paintedW) / 2 + marker.x * paintedW,
      top: (imgMetrics.h - paintedH) / 2 + marker.y * paintedH,
    }
  }

  const handleToggleZoom = () => {
    if (isZoomed) {
      resetView()
      return
    }

    setIsZoomed(true)
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerDownPositionRef.current = { x: event.clientX, y: event.clientY }
    hasMovedRef.current = false
    pointerIdRef.current = event.pointerId

    if (!isZoomed) {
      dragStartRef.current = null
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    event.preventDefault()
    const startX = event.clientX - dragOffset.x
    const startY = event.clientY - dragOffset.y
    dragStartRef.current = { x: startX, y: startY }

    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerDownPositionRef.current) {
      const deltaX = event.clientX - pointerDownPositionRef.current.x
      const deltaY = event.clientY - pointerDownPositionRef.current.y
      if (!hasMovedRef.current && Math.hypot(deltaX, deltaY) > 4) {
        hasMovedRef.current = true
      }
      lastDeltaRef.current = { x: deltaX, y: deltaY }
    }

    if (!isZoomed || !isDragging || !dragStartRef.current) {
      return
    }

    event.preventDefault()
    const newX = event.clientX - dragStartRef.current.x
    const newY = event.clientY - dragStartRef.current.y
    setDragOffset({ x: newX, y: newY })
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) {
      try {
        event.currentTarget.releasePointerCapture(pointerIdRef.current)
      } catch (error) {
        // Pointer might already be released; ignore
      }
    }

    const wasZoomed = isZoomed
    const moved = hasMovedRef.current
    const delta = lastDeltaRef.current
    lastDeltaRef.current = { x: 0, y: 0 }

    if (wasZoomed) {
      setIsDragging(false)
      dragStartRef.current = null
    }

    pointerIdRef.current = null
    pointerDownPositionRef.current = null
    hasMovedRef.current = false

    if (!moved) {
      if (wasZoomed) {
        resetView()
      } else {
        setIsZoomed(true)
      }
      return
    }

    // A clear sideways drag on the unzoomed sheet steps to the neighbouring map.
    if (!wasZoomed && onSwipe && Math.abs(delta.x) > 60 && Math.abs(delta.x) > 2 * Math.abs(delta.y)) {
      onSwipe(delta.x < 0 ? 'next' : 'prev')
    }
  }

  return (
    <div
      className={`flex-1 bg-surface-canvas/40 px-4 py-4 ${isZoomed ? 'overflow-hidden' : 'overflow-auto'} min-h-0 relative`}
    >
      {/* Zoom Button - Absolutely positioned in top right */}
      <button
        type="button"
        onClick={handleToggleZoom}
        className="absolute top-4 right-4 z-10 rounded fill-surface-raised px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas shadow-lg"
      >
        {isZoomed ? 'Reset View' : 'Zoom In'}
      </button>

      <div className="flex h-full items-center justify-center py-4">
        <div
          className={`relative ${isZoomed ? 'cursor-grab' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerLeave={(event) => {
            if (isDragging || pointerIdRef.current !== null) {
              endDrag(event)
            }
          }}
          onPointerCancel={(event) => {
            if (isDragging || pointerIdRef.current !== null) {
              endDrag(event)
            }
          }}
          style={{
            // Unzoomed, vertical scrolling stays the browser's; sideways is the swipe.
            touchAction: isZoomed ? 'none' : 'pan-y',
            cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'default',
            // Zoom/pan lives on the wrapper so the marker travels with the art.
            transform: isZoomed ? `scale(1.4) translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
            transition: !isDragging ? 'transform 0.2s ease-out' : 'none',
          }}
        >
          <img
            ref={imgRef}
            src={mapSrc}
            alt={mapTitle}
            onLoad={measureImage}
            className={`block rounded-xl shadow-inner ${
              isZoomed
                ? 'max-h-none w-auto max-w-none'
                : 'w-full max-w-full object-contain'
            }`}
            style={{
              userSelect: 'none',
              pointerEvents: isZoomed ? 'none' : 'auto',
              maxHeight: isZoomed ? 'none' : '100%',
            }}
            draggable={false}
          />
          {markerOffset && (
            <div
              className="pointer-events-none absolute z-10"
              style={{ left: markerOffset.left, top: markerOffset.top, transform: 'translate(-50%, -50%)' }}
              role="img"
              aria-label="You are here"
            >
              <span className="absolute inset-0 -m-2 rounded-full bg-resource-gold/40 animate-ping" aria-hidden="true" />
              <span className="block h-3 w-3 rounded-full border-2 border-line-subtle bg-resource-gold shadow-[0_0_0_2px_color-mix(in_srgb,var(--resource-gold)_50%,transparent)]" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
