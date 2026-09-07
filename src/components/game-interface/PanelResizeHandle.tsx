'use client'

import type { useResizablePanel } from './useResizablePanel'

type HandleProps = ReturnType<typeof useResizablePanel>['handleProps']

interface PanelResizeHandleProps {
  /** Which inner edge of the panel the handle sits on. */
  edge: 'left' | 'right'
  isDragging: boolean
  handleProps: HandleProps
}

/**
 * The grab strip on a resizable side panel's inner edge. It lies inside the
 * panel over its existing border line, 8px wide, and only shows itself as a
 * highlighted line while hovered, focused, or being dragged.
 */
export default function PanelResizeHandle({ edge, isDragging, handleProps }: PanelResizeHandleProps) {
  return (
    <div
      {...handleProps}
      className={`group absolute top-0 bottom-0 z-30 w-2 cursor-col-resize touch-none focus:outline-none ${
        edge === 'right' ? 'right-0' : 'left-0'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0 bottom-0 w-0.5 transition-colors duration-150 ${
          edge === 'right' ? 'right-0' : 'left-0'
        } ${
          isDragging
            ? 'bg-line-focus'
            : 'bg-transparent group-hover:bg-line-strong group-focus-visible:bg-line-focus'
        }`}
      />
    </div>
  )
}
