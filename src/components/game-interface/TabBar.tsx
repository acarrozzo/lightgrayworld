'use client'

import type { ReactNode } from 'react'
import { Compass as CompassIcon, Globe, MessageSquare, MessageSquareText, Settings as SettingsIcon } from 'lucide-react'
import Icon from '@/components/Icon'
import NotificationBadge from '@/components/NotificationBadge'
import { getTabButtonColorClasses, getTabIconColorClass, type TabColor } from '@/lib/tabColors'

import type { TabId } from '@/lib/tab-rules'

export type { TabId }
export type TabBadges = Partial<Record<TabId, number | boolean | undefined>>

interface TabDef {
  id: TabId
  label: string
  title: string
  /** The tab's accent: its icon always, its border, fill and text while it is open. The sub-tabs under it use the same one. */
  color: TabColor
  /** The same accent as a text class, for the tab's header title. */
  tone: string
  icon: (size: number) => ReactNode
  /** A tab only on a phone: a wide screen has the feed as its right-hand panel. The phone bar carries every tab, eight tiles. */
  phoneOnly?: boolean
  /** Opened from the header's gear, not from the bar. */
  offBar?: boolean
}

/**
 * The game's tabs, in the order they are shown. Explore is home: the room and
 * the compass, lit when nothing else is open; Actions, the last tile, is what
 * you can do — attack, strikes, spells and items — red, the fight's colour. One
 * registry for the desktop bar, the phone bar and every tab's header. The rules for what opens and
 * closes them are in `lib/tab-rules`.
 */
export const TABS: TabDef[] = [
  { id: 'explore', color: 'blue', label: 'Explore', title: 'Explore — the room and the compass', tone: 'text-hue-blue', icon: (size) => <CompassIcon size={size} aria-hidden="true" /> },
  { id: 'char', color: 'violet', label: 'Char', title: 'Character — who you are and your points', tone: 'text-hue-violet', icon: (size) => <Icon name="character" size={size} color="current" /> },
  { id: 'inv', color: 'green', label: 'Inv', title: 'Inventory — your stats, what you are wearing and your bag', tone: 'text-hue-green', icon: (size) => <Icon name="inv" size={size} color="current" /> },
  { id: 'world', color: 'sky', label: 'World', title: 'World — teleport and map', tone: 'text-hue-sky', icon: (size) => <Globe size={size} aria-hidden="true" /> },
  { id: 'quests', color: 'gold', label: 'Quests', title: 'Quests', tone: 'text-hue-gold', icon: (size) => <Icon name="trophy" size={size} color="current" /> },
  { id: 'players', color: 'pink', label: 'Players', title: 'Players — who is here, and messages', tone: 'text-hue-pink', icon: (size) => <MessageSquare size={size} aria-hidden="true" /> },
  { id: 'feed', color: 'blue', label: 'Feed', title: 'World Feed', tone: 'text-hue-blue', icon: (size) => <MessageSquareText size={size} aria-hidden="true" />, phoneOnly: true },
  { id: 'actions', color: 'red', label: 'Actions', title: 'Actions — attack, strikes, spells and items', tone: 'text-hue-red', icon: (size) => <Icon name="hand" size={size} color="current" /> },
  { id: 'settings', color: 'gray', label: 'Settings', title: 'Settings', tone: 'text-fg-secondary', icon: (size) => <SettingsIcon size={size} aria-hidden="true" />, offBar: true },
]

export function tabDef(id: string): TabDef | undefined {
  return TABS.find((tab) => tab.id === id)
}

interface TabBarProps {
  /** `row` is pinned across the top of the desktop column; `phone` runs across the bottom of the screen and adds Feed. */
  variant: 'row' | 'phone'
  active: TabId
  onSelect: (tab: TabId) => void
  badges?: TabBadges
  /** Tabs the player has not found yet: left out of the bar entirely. */
  hidden?: ReadonlySet<TabId>
  /** Tabs that have just arrived: they glow until first opened. */
  fresh?: ReadonlySet<TabId>
  className?: string
}

// The sub-tab button's pattern (SubTabButton), one size up and with the icon
// over the label: a flat grey outline at rest, the tab's accent as border,
// tint and text when open.
const TILE =
  'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg font-medium shadow-sm hover:shadow transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus'
const TILE_IDLE =
  'border-1 border-line-strong/80 hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-secondary hover:text-fg-primary'
const tileClasses = (color: TabColor, isActive: boolean) => (isActive ? getTabButtonColorClasses(color, true) : TILE_IDLE)

/**
 * The tab bar: one outlined tile per tab, drawn in the sub-tabs' pattern with
 * an icon on top. The open tab wears its accent. Pressing the open tab's tile goes home to Explore, so the bar is
 * both the way in and the way back.
 */
export default function TabBar({ variant, active, onSelect, badges, hidden, fresh, className = '' }: TabBarProps) {
  const isPhone = variant === 'phone'
  const shown = TABS.filter((tab) => !tab.offBar && (isPhone || !tab.phoneOnly) && !hidden?.has(tab.id))
  const size = isPhone ? 'h-12 text-[10px]' : 'h-[3.25rem] gap-1 px-1 text-[10px]'

  return (
    <nav className={`flex items-stretch gap-1 ${className}`} aria-label="Game tabs">
      {shown.map((tab) => {
        const isActive = tab.id === active
        const isFresh = fresh?.has(tab.id) && !isActive
        return (
          <button
            key={tab.id}
            type="button"
            data-tab={tab.id}
            onClick={() => onSelect(tab.id)}
            aria-pressed={isActive}
            aria-label={isFresh ? `${tab.title} (new)` : tab.title}
            title={tab.title}
            className={`${TILE} ${size} ${tileClasses(tab.color, isActive)} ${isFresh ? 'tab-fresh' : ''}`}
          >
            <NotificationBadge value={badges?.[tab.id]} className="absolute -right-1 -top-1 z-10" />
            {isFresh && <span className="absolute -left-1 -top-1 z-10 rounded-full fill-accent px-1 text-[8px] font-bold uppercase leading-[14px] tracking-wide">new</span>}
            <span className={`flex ${getTabIconColorClass(tab.color, isActive)}`}>{tab.icon(isPhone ? 18 : 20)}</span>
            <span className="max-w-full truncate" aria-hidden="true">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
