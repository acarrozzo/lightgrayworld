'use client'

import React, { useCallback, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from 'react'
import { ChevronDown, SendHorizontal } from 'lucide-react'
import { MESSAGE_MAX_LENGTH } from '@/lib/sanitization'
import { CHANNEL_STYLES, MODES, MODE_META, nextMode, parseSlashPrefix, type InputMode } from './feedChannels'
import { useDismissable } from './useDismissable'

type Props = {
  mode: InputMode
  onModeChange: (mode: InputMode) => void
  value: string
  onValueChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>, mode: InputMode) => void
  disabled?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
}

/**
 * The feed's one-row composer. The current mode is the glyph at the input's
 * left edge, in its channel colour; tapping it opens the mode menu above.
 * Typing `/r `, `/w `, `/p ` or `/a ` switches while typing, and Tab cycles.
 * Send is the arrow at the right edge.
 */
export default function FeedComposer({ mode, onModeChange, value, onValueChange, onSubmit, disabled, inputRef }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useDismissable(menuOpen, closeMenu, frameRef)

  const meta = MODE_META[mode]
  const Icon = meta.icon
  const isChat = mode !== 'action'
  const charCount = value.length
  const isOverLimit = isChat && charCount > MESSAGE_MAX_LENGTH
  const trimmed = value.trim()
  const canSend = !disabled && trimmed.length > 0 && !isOverLimit

  const focusInput = () => inputRef?.current?.focus()

  const pick = (next: InputMode) => {
    onModeChange(next)
    setMenuOpen(false)
    focusInput()
  }

  const handleChange = (raw: string) => {
    const slash = parseSlashPrefix(raw)
    if (slash) {
      onModeChange(slash.mode)
      onValueChange(slash.rest)
      return
    }
    onValueChange(raw)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      onModeChange(nextMode(mode))
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    // A bare `/r` and Enter switches without sending.
    const slash = parseSlashPrefix(trimmed, true)
    if (slash && slash.rest.trim() === '') {
      event.preventDefault()
      onModeChange(slash.mode)
      onValueChange('')
      return
    }
    onSubmit(event, mode)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 w-full">
      <div
        ref={frameRef}
        className={`relative flex items-stretch w-full fill-surface-panel border rounded focus-within:ring-1 transition-colors duration-200 ${
          isOverLimit
            ? 'border-status-error/60 focus-within:border-status-error/80 focus-within:ring-status-error/40'
            : 'border-line-subtle/60 focus-within:border-accent/60 focus-within:ring-line-focus/40'
        }`}
      >
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`${meta.label}. Change where you speak`}
          title={`${meta.label} · change`}
          className={`flex items-center gap-0.5 px-2 border-r border-line-subtle/60 rounded-l hover:bg-surface-raised/40 transition-colors ${CHANNEL_STYLES[mode].glyph}`}
        >
          <Icon size={14} aria-hidden="true" />
          <ChevronDown size={11} className="opacity-60" aria-hidden="true" />
        </button>

        <input
          id="worldFeedComposer"
          ref={inputRef ?? undefined}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={meta.placeholder}
          disabled={Boolean(disabled)}
          className="flex-1 min-w-0 px-3 py-2 bg-transparent font-mono text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-fg-muted"
          autoComplete="off"
          aria-label={meta.label}
        />

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          title="Send"
          className="flex items-center px-3 border-l border-line-subtle/60 rounded-r text-accent hover:bg-surface-raised/40 disabled:text-fg-muted disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          <SendHorizontal size={14} aria-hidden="true" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Where you speak"
            className="absolute left-0 bottom-full mb-1.5 z-20 min-w-[200px] p-1.5 rounded-md border border-line-strong fill-surface-raised shadow-lg shadow-black/40 flex flex-col gap-0.5"
          >
            <div className="px-2 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-widest text-fg-muted">Speak as</div>
            {MODES.filter((m) => m.mode !== 'action').map((m) => (
              <ModeItem key={m.mode} meta={m} active={m.mode === mode} onPick={pick} />
            ))}
            <div className="my-1 h-px bg-line-strong" aria-hidden="true" />
            <div className="px-2 pb-0.5 text-[9px] font-mono uppercase tracking-widest text-fg-muted">Act</div>
            <ModeItem meta={MODE_META.action} active={mode === 'action'} onPick={pick} />
          </div>
        )}
      </div>

      {isOverLimit ? (
        <p className="text-xs text-status-error font-mono px-1">
          Message cannot exceed {MESSAGE_MAX_LENGTH} characters. Current: {charCount} characters
        </p>
      ) : (
        <p className="@max-[320px]:hidden px-1 text-[10px] font-mono text-fg-muted/80 flex flex-wrap gap-x-3">
          <span>
            <Kbd>/r</Kbd> <Kbd>/w</Kbd> <Kbd>/p</Kbd> <Kbd>/a</Kbd> switch while typing
          </span>
          <span>
            <Kbd>Tab</Kbd> cycles
          </span>
        </p>
      )}
    </form>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="px-1 rounded border border-line-subtle text-fg-secondary font-mono">{children}</kbd>
}

function ModeItem({ meta, active, onPick }: { meta: (typeof MODES)[number]; active: boolean; onPick: (mode: InputMode) => void }) {
  const Icon = meta.icon
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={() => onPick(meta.mode)}
      className={`grid grid-cols-[18px_1fr_auto] items-center gap-2 px-2 py-1.5 rounded text-left text-xs font-mono transition-colors hover:bg-surface-hover ${
        active ? 'bg-surface-hover text-fg-bright' : 'text-fg-secondary'
      }`}
    >
      <Icon size={13} className={CHANNEL_STYLES[meta.mode].glyph} aria-hidden="true" />
      <span>{meta.label}</span>
      <span className="text-[10px] text-fg-muted">{meta.hint}</span>
    </button>
  )
}
