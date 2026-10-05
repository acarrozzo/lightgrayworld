'use client'

import { getCastableSpells } from './spellbook'
import { effectiveStats } from './effective-stats'
import type { InventoryItem, Player } from './game-state'

/** The action deck's three tabs: the attack and its strikes, the spells, the items. */
export type ActionTab = 'attack' | 'spells' | 'items'
export const ACTION_TABS: readonly ActionTab[] = ['attack', 'spells', 'items']

/**
 * The tab a fight opens on: Attack, unless the player is a caster — MAG
 * strictly the highest of the four effective stats, with a spell to cast —
 * who opens on Spells. Nothing is remembered between fights; every one starts
 * here.
 */
export function battleStartTab(player: Player | null | undefined, inventory: InventoryItem[]): ActionTab {
  if (!player || getCastableSpells(player).length === 0) return 'attack'
  const stats = effectiveStats(player, inventory)
  const mag = stats.mag.total
  return mag > stats.str.total && mag > stats.dex.total && mag > stats.def.total ? 'spells' : 'attack'
}

/**
 * The tab the deck opens on. In a fight, `battleStartTab`. Out of one — the
 * Action button under the compass — always Items: between fights the deck is
 * for eating, drinking and patching up, and Attack usually has nothing to hit.
 */
export function startingActionTab(inBattle: boolean, player: Player | null | undefined, inventory: InventoryItem[]): ActionTab {
  return inBattle ? battleStartTab(player, inventory) : 'items'
}
