'use client'

import type { ReactNode } from 'react'
import { Globe } from 'lucide-react'
import Icon from '@/components/Icon'

/**
 * The layers that open over the compass: the World and Inv tabs of the tab
 * bar, and Action, which is not a tab but a button of the Explore view.
 */
export type DeckTab = 'world' | 'inv' | 'action'

export interface DeckTabConfig {
  id: DeckTab
  /** The tile's label. */
  label: string
  /** The tile's tooltip and the layer's accessible name. */
  title: string
  /** The tile's fill: the colour of what it opens. */
  fill: string
  /** The same colour as text, for the layer's own title. */
  tone: string
  icon: (size: number) => ReactNode
}

/**
 * What each layer is called and coloured, for its header and its accessible
 * name. A new layer is one entry here and one case in `DeckContent`.
 */
export const DECK_TABS: DeckTabConfig[] = [
  {
    id: 'world',
    label: 'World',
    title: 'World — teleport and map',
    fill: 'fill-hue-sky',
    tone: 'text-hue-sky',
    icon: (size) => <Globe size={size} strokeWidth={2.2} aria-hidden="true" />,
  },
  {
    id: 'inv',
    label: 'Inv',
    title: 'Inventory — your stats, what you are wearing and your bag',
    fill: 'fill-hue-green',
    tone: 'text-hue-green',
    icon: (size) => <Icon name="inv" size={size} color="current" />,
  },
  {
    id: 'action',
    label: 'Action',
    title: 'Action — attack, strikes, spells and items',
    fill: 'fill-action-attack',
    tone: 'text-action-attack',
    icon: (size) => <Icon name="hand" size={size} color="current" />,
  },
]

export function deckTabConfig(tab: DeckTab): DeckTabConfig {
  return DECK_TABS.find((entry) => entry.id === tab) ?? DECK_TABS[0]
}

// Whether the tabs were last left full screen on this device: one switch for
// the whole set, so going full screen and then changing tab stays full screen.
// A browser convenience only, never authoritative for anything. The key is the
// one the World layer used before the deck, so that choice carries over.
const FULLSCREEN_KEY = 'lg-world-layer-fullscreen'

export function readDeckFullscreen(): boolean {
  try {
    return window.localStorage.getItem(FULLSCREEN_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDeckFullscreen(value: boolean) {
  try {
    window.localStorage.setItem(FULLSCREEN_KEY, value ? '1' : '0')
  } catch {
    // Storage can be unavailable (private mode, blocked); the layer still works.
  }
}
