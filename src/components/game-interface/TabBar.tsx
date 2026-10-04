'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Compass as CompassIcon, Globe, MessageSquare, MessageSquareText, MoreHorizontal, Settings as SettingsIcon } from 'lucide-react'
import Icon from '@/components/Icon'
import NotificationBadge from '@/components/NotificationBadge'

/**
 * The game's tabs, in the order they are shown. Explore is home: the room and
 * the compass, lit when nothing else is open. Feed is a tab only on a phone;
 * a wide screen has it as the right-hand panel.
 */
export type TabId = 'explore' | 'char' | 'inv' | 'world' | 'quests' | 'players' | 'feed' | 'settings'

export type TabBadges = Partial<Record<TabId, number | boolean | undefined>>

interface TabDef {
  id: TabId
  label: string
  title: string
  /** The icon's colour: the only colour a tile carries until it is open. */
  tone: string
  icon: (size: number) => ReactNode
  phoneOnly?: boolean
}

/**
 * The one registry the desktop bar, the phone bar and its More menu read.
 * A new tab is one entry here; where it opens is GameInterface's `selectTab`.
 */
export const TABS: TabDef[] = [
  { id: 'explore', label: 'Explore', title: 'Explore — the room and the compass', tone: 'text-fg-secondary', icon: (size) => <CompassIcon size={size} aria-hidden="true" /> },
  { id: 'char', label: 'Char', title: 'Character — who you are and your points', tone: 'text-hue-violet', icon: (size) => <Icon name="character" size={size} color="current" /> },
  { id: 'inv', label: 'Inv', title: 'Inventory — your stats, what you are wearing and your bag', tone: 'text-hue-green', icon: (size) => <Icon name="inv" size={size} color="current" /> },
  { id: 'world', label: 'World', title: 'World — teleport and map', tone: 'text-hue-sky', icon: (size) => <Globe size={size} aria-hidden="true" /> },
  { id: 'quests', label: 'Quests', title: 'Quests', tone: 'text-hue-gold', icon: (size) => <Icon name="trophy" size={size} color="current" /> },
  { id: 'players', label: 'Players', title: 'Players — who is here, and messages', tone: 'text-hue-pink', icon: (size) => <MessageSquare size={size} aria-hidden="true" /> },
  { id: 'feed', label: 'Feed', title: 'World Feed', tone: 'text-hue-blue', icon: (size) => <MessageSquareText size={size} aria-hidden="true" />, phoneOnly: true },
  { id: 'settings', label: 'Settings', title: 'Settings', tone: 'text-fg-secondary', icon: (size) => <SettingsIcon size={size} aria-hidden="true" /> },
]

export function tabDef(id: string): TabDef | undefined {
  return TABS.find((tab) => tab.id === id)
}

/** How many tabs a phone shows before the rest fold into More. */
const PHONE_VISIBLE = 5

interface TabBarProps {
  /** `row` is every tab, pinned across the top of the desktop column; `phone` is five tabs and More, across the bottom of the screen. */
  variant: 'row' | 'phone'
  active: TabId
  onSelect: (tab: TabId) => void
  badges?: TabBadges
  className?: string
}

const TILE =
  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border font-semibold uppercase tracking-wider transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'
const TILE_IDLE = 'border-line-subtle/50 text-fg-secondary hover:border-line-strong/70 hover:bg-surface-raised/40 hover:text-fg-primary'
const TILE_ON = 'border-line-focus bg-surface-raised/70 text-fg-bright ring-1 ring-line-focus'

/**
 * The tab bar: one outlined tile per tab, colour on the icon only, the open
 * tab ringed. Pressing the open tab's tile goes home to Explore, so the bar is
 * both the way in and the way back.
 */
export default function TabBar({ variant, active, onSelect, badges, className = '' }: TabBarProps) {
  const isPhone = variant === 'phone'
  const tabs = TABS.filter((tab) => isPhone || !tab.phoneOnly)
  const shown = isPhone ? tabs.slice(0, PHONE_VISIBLE) : tabs
  const overflow = isPhone ? tabs.slice(PHONE_VISIBLE) : []
  const size = isPhone ? 'h-12 text-[9px]' : 'h-[3.25rem] gap-1 px-1 text-[9px] tracking-normal'

  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moreOpen) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
    }
  }, [moreOpen])

  // What More is hiding: a count if any hidden tab has one, else a dot if any has a dot.
  const overflowCount = overflow.reduce((total, tab) => total + (typeof badges?.[tab.id] === 'number' ? (badges[tab.id] as number) : 0), 0)
  const overflowBadge = overflowCount > 0 ? overflowCount : overflow.some((tab) => badges?.[tab.id])
  const overflowActive = overflow.some((tab) => tab.id === active)

  return (
    <nav className={`flex items-stretch gap-1 ${className}`} aria-label="Game tabs">
      {shown.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            aria-pressed={isActive}
            aria-label={tab.title}
            title={tab.title}
            className={`${TILE} ${size} ${isActive ? TILE_ON : TILE_IDLE}`}
          >
            <NotificationBadge value={badges?.[tab.id]} className="absolute -right-1 -top-1 z-10" />
            <span className={`flex ${tab.tone}`}>{tab.icon(isPhone ? 18 : 20)}</span>
            <span className="max-w-full truncate" aria-hidden="true">{tab.label}</span>
          </button>
        )
      })}
      {overflow.length > 0 && (
        <div ref={moreRef} className="relative flex min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            aria-label="More tabs"
            className={`${TILE} ${size} ${overflowActive || moreOpen ? TILE_ON : TILE_IDLE}`}
          >
            <NotificationBadge value={overflowBadge} className="absolute -right-1 -top-1 z-10" />
            <MoreHorizontal size={18} aria-hidden="true" />
            <span aria-hidden="true">More</span>
          </button>
          {moreOpen && (
            <div role="menu" className="absolute bottom-full right-0 z-50 mb-2 flex w-44 flex-col gap-1 rounded-xl border border-line-strong bg-surface-overlay p-1.5 shadow-2xl shadow-black/50">
              {overflow.map((tab) => {
                const isActive = tab.id === active
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false)
                      onSelect(tab.id)
                    }}
                    className={`relative flex h-11 items-center gap-2.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                      isActive ? TILE_ON : TILE_IDLE
                    }`}
                  >
                    <span className={`flex ${tab.tone}`}>{tab.icon(18)}</span>
                    <span>{tab.id === 'feed' ? 'World Feed' : tab.label}</span>
                    <NotificationBadge value={badges?.[tab.id]} className="ml-auto" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </nav>
  )
}
