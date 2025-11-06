'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import Icon from './Icon'

interface MapModalProps {
  isOpen: boolean
  onClose: () => void
  mapSrc: string
  mapTitle: string
}

export default function MapModal({ isOpen, onClose, mapSrc, mapTitle }: MapModalProps) {
  const [isZoomed, setIsZoomed] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const pointerIdRef = useRef<number | null>(null)
  const pointerDownPositionRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedRef = useRef(false)

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
    if (!isOpen) {
      resetView()
    }
  }, [isOpen, mapSrc])

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
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex max-h-[90vh] w-[90vw] max-w-5xl flex-col overflow-hidden rounded-2xl border border-purple-500/40 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 className="text-xl font-semibold text-white">{mapTitle}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleZoom}
              className="rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-200 transition-colors hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            >
              {isZoomed ? 'Reset View' : 'Zoom In'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-400 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              aria-label="Close map"
            >
              <Icon name="x" size={24} />
            </button>
          </div>
        </div>

        <div
          className={`flex-1 bg-gray-950/40 px-6 py-6 ${isZoomed ? 'overflow-hidden' : 'overflow-auto'}`}
        >
          <div className="flex min-h-[60vh] items-center justify-center">
            <div
              className={`${isZoomed ? 'cursor-grab' : ''}`}
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
                touchAction: isZoomed ? 'none' : 'auto',
                cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'default',
              }}
            >
              <img
                src={mapSrc}
                alt={mapTitle}
                className={`rounded-xl shadow-inner ${
                  isZoomed
                    ? 'max-h-none w-auto max-w-none'
                    : 'h-full max-h-[70vh] w-full max-w-full object-contain'
                }`}
                style={{
                  transform: isZoomed ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
                  transition: !isDragging ? 'transform 0.2s ease-out' : 'none',
                  userSelect: 'none',
                  pointerEvents: isZoomed ? 'none' : 'auto',
                }}
                draggable={false}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 px-6 py-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-purple-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

