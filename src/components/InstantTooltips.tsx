'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Space between the tooltip and what it describes, and from the window's edge. */
const GAP = 6
const EDGE = 8

/**
 * Every `title` in the game, shown the moment the mouse arrives instead of
 * after the browser's own second-long wait.
 *
 * The interface has some two hundred `title`s — why a button is disabled,
 * what a stat is made of, what a teleport costs — and the browser holds each
 * back for about a second. Rather than rewrite them all, this takes them over
 * in one place: when the mouse enters an element with a `title`, the text
 * moves to `data-instant-tip` (so the browser's tooltip never fires) and is
 * drawn here at once; when the mouse leaves, the `title` goes back, so screen
 * readers and touch devices keep what they had. A click hides it, as the
 * browser's does, until the mouse leaves that element.
 *
 * Mouse only: a touch has no hover, and the game's own hover cards (trait
 * tags, the party peek, the map's pins) are already instant and carry no
 * `title`.
 */
export default function InstantTooltips() {
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    let current: HTMLElement | null = null
    let muted: HTMLElement | null = null
    let observer: MutationObserver | null = null

    /** Move the element's title aside so the browser has nothing to show. */
    const stash = (el: HTMLElement): string => {
      const text = el.getAttribute('title') ?? ''
      el.setAttribute('data-instant-tip', text)
      el.removeAttribute('title')
      return text
    }

    const release = () => {
      observer?.disconnect()
      observer = null
      if (current) {
        const text = current.getAttribute('data-instant-tip')
        current.removeAttribute('data-instant-tip')
        if (text !== null && !current.hasAttribute('title')) current.setAttribute('title', text)
      }
      current = null
      setTip(null)
    }

    const show = (el: HTMLElement) => {
      const text = stash(el)
      current = el
      setTip(text.trim() ? { text, rect: el.getBoundingClientRect() } : null)
      // The game may change the title while it is showing (a button that
      // becomes disabled says why): take the new one and redraw.
      observer = new MutationObserver(() => {
        if (!current || !current.hasAttribute('title')) return
        const next = stash(current)
        setTip(next.trim() ? { text: next, rect: current.getBoundingClientRect() } : null)
      })
      observer.observe(el, { attributes: true, attributeFilter: ['title'] })
    }

    const onOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      if (current && !current.isConnected) release()
      const target = event.target instanceof Element ? event.target : null
      const el = target?.closest<HTMLElement>('[title], [data-instant-tip]') ?? null
      // Anywhere but the element just clicked lifts its mute.
      if (el !== muted) muted = null
      if (el === current) return
      release()
      if (el && el !== muted && el.hasAttribute('title') && !(el instanceof SVGElement) && el.tagName !== 'IFRAME') show(el)
    }

    const onOut = (event: PointerEvent) => {
      // Leaving the window altogether.
      if (!event.relatedTarget) {
        muted = null
        release()
      }
    }

    // A click hides it until the mouse leaves that element, as the browser does.
    const onDown = () => {
      if (!current) return
      muted = current
      release()
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && current) release()
    }

    document.addEventListener('pointerover', onOver, true)
    document.addEventListener('pointerout', onOut, true)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', release, true)
    window.addEventListener('blur', release)
    return () => {
      release()
      document.removeEventListener('pointerover', onOver, true)
      document.removeEventListener('pointerout', onOut, true)
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', release, true)
      window.removeEventListener('blur', release)
    }
  }, [])

  // Above what it describes, centred and kept inside the window; below when
  // there is no room above (the header, the top of a list).
  useLayoutEffect(() => {
    const box = boxRef.current
    if (!tip || !box) {
      setPos(null)
      return
    }
    const w = box.offsetWidth
    const h = box.offsetHeight
    const { rect } = tip
    const left = Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, rect.left + rect.width / 2 - w / 2))
    const above = rect.top - GAP - h
    const top = above >= EDGE ? above : Math.min(window.innerHeight - h - EDGE, rect.bottom + GAP)
    setPos({ left, top })
  }, [tip])

  if (!tip) return null
  return (
    <div
      ref={boxRef}
      role="tooltip"
      className="pointer-events-none fixed z-[200] max-w-[min(320px,calc(100vw-16px))] whitespace-pre-line rounded-md border border-line-strong bg-surface-panel px-2 py-1 text-[11px] leading-snug text-fg-primary shadow-lg shadow-shadow"
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      {tip.text}
    </div>
  )
}
