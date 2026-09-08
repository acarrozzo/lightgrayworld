'use client'

import { createBooleanDeviceSetting } from './device-setting'

/**
 * Whether each of the character panel's three lists — skills, spells, the
 * consumables in the bag — is folded away. Stored collapsed-side-up so the
 * default (nothing in storage) leaves every section open. A per-device
 * convenience in localStorage; the server never sees it.
 */
export const useSkillsCollapsed = createBooleanDeviceSetting('lg:char-fold-skills')
export const useSpellsCollapsed = createBooleanDeviceSetting('lg:char-fold-spells')
export const useItemsCollapsed = createBooleanDeviceSetting('lg:char-fold-items')
