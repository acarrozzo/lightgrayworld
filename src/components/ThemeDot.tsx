'use client'

import { themeSwatch } from '@/lib/theme/swatch'
import type { Theme } from '@/lib/theme/types'

interface ThemeDotProps {
  theme: Theme
  isSelected: boolean
  onSelect: (id: string) => void
  /** Called with the theme under the pointer or focus, for a name readout. */
  onHover?: (id: string) => void
  autoFocus?: boolean
}

/**
 * One theme as a radio dot.
 *
 * The visible dot is 18px, small enough for nine to sit in a single row. The
 * button around it is 28px, so it can be hit with a thumb. The old dot *was*
 * the button, at 16–18px, which is under the 24px minimum target size.
 */
export default function ThemeDot({ theme, isSelected, onSelect, onHover, autoFocus }: ThemeDotProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      aria-label={theme.name}
      title={theme.name}
      tabIndex={isSelected ? 0 : -1}
      autoFocus={autoFocus}
      onClick={() => onSelect(theme.id)}
      onMouseEnter={onHover ? () => onHover(theme.id) : undefined}
      onFocus={onHover ? () => onHover(theme.id) : undefined}
      className="group flex h-7 w-7 shrink-0 items-center justify-center rounded-full focus:outline-none"
    >
      <span
        aria-hidden="true"
        className={`
          block h-[18px] w-[18px] rounded-full border transition-all duration-150
          group-focus-visible:ring-2 group-focus-visible:ring-line-focus
          ${
            isSelected
              ? 'scale-110 border-accent ring-2 ring-accent/40'
              : 'border-line-strong opacity-70 group-hover:scale-110 group-hover:opacity-100'
          }
        `}
        style={{ background: themeSwatch(theme) }}
      />
    </button>
  )
}
