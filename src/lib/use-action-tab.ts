'use client'

import { createChoiceDeviceSetting } from './device-setting'
import { getCastableSpells } from './spellbook'
import { effectiveStats } from './effective-stats'
import type { InventoryItem, Player } from './game-state'

/** The two lists under the action deck's strike row. */
export type ActionTab = 'spells' | 'items'
export const ACTION_TABS: readonly ActionTab[] = ['spells', 'items']

/**
 * Where the Spells | Items switch was left, shared by the battle deck, the
 * Action layer and the phone sheet, so a potion drunk from one leaves the
 * other on Items too. A per-device convenience; null until first chosen.
 */
export const useActionTab = createChoiceDeviceSetting<ActionTab>('lg:action-tab', ACTION_TABS)

/**
 * The first default, before the player has ever moved the switch: Items,
 * unless they are a caster — MAG strictly the highest of the four effective
 * stats, with a spell to cast — who opens on Spells.
 */
export function defaultActionTab(player: Player | null | undefined, inventory: InventoryItem[]): ActionTab {
  if (!player || getCastableSpells(player).length === 0) return 'items'
  const stats = effectiveStats(player, inventory)
  const mag = stats.mag.total
  return mag > stats.str.total && mag > stats.dex.total && mag > stats.def.total ? 'spells' : 'items'
}
