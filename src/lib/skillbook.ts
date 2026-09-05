/**
 * Client-side view of the skill registry.
 *
 * game-data/skills.js is the single source of truth for what each skill is;
 * this module turns a player's skill levels, teacher flags and what they are
 * holding into what the book, the battle Skills list and the Character panel
 * need to render — caps, costs, previews, the passive bonuses in force —
 * without a server round-trip. Nothing here decides anything: the server
 * re-derives every number when a skill is learned or used.
 */
import type { InventoryItem, Player } from '@/lib/game-state'
import { effectiveMag, spellTone } from '@/lib/spellbook'
import { isTwoHanded } from '@/lib/inventory-categories'

export type SkillGroupId = 'offense' | 'attack' | 'defense' | 'upgrade'
export type SkillKind = 'passive' | 'strike' | 'upgrade'
export type SkillWeapon = 'ONE_HANDED' | 'TWO_HANDED' | 'RANGED' | 'ANY'

export interface GearContext {
  weaponCategory: 'MELEE' | 'RANGED' | null
  isTwoHanded: boolean
  hasShield: boolean
}

export interface SkillTeacherTier {
  flag: string
  max: number
}

export interface SkillBonusPreview {
  min: number
  max: number
  text: string
}

export interface SkillDef {
  id: string
  column: string
  name: string
  group: SkillGroupId
  kind: SkillKind
  implemented: boolean
  icon: string
  attackIcon?: string
  hue: string
  description: string
  formula: string
  teachers: SkillTeacherTier[]
  learnCost: (level: number) => number
  weapon?: SkillWeapon
  magic?: boolean
  castCost?: (level: number) => number
  preview?: (level: number, mag: number) => SkillBonusPreview
}

export interface SkillGroupDef {
  id: SkillGroupId
  name: string
  blurb: string
}

export interface PassiveBonuses {
  str: number
  dex: number
  def: number
  dodgeChance: number
  parts: { skillId: string; stat: 'str' | 'dex' | 'def' | 'dodge'; amount: number }[]
}

const registry = require('@/lib/game-data/skills') as {
  SKILLS: SkillDef[]
  SKILL_GROUPS: SkillGroupDef[]
  SKILL_TEACHERS: Record<string, { name: string; roomId: string }>
  getSkill: (id: string) => SkillDef | null
  getSkillMaxLevel: (skill: SkillDef, flags: Record<string, boolean> | undefined) => number
  getNextLearnCost: (skill: SkillDef, level: number, maxLevel: number) => number | null
  isStrikeSkill: (skill: SkillDef) => boolean
  isShieldItem: (template: { slug?: string; equipSlot?: string | null } | null | undefined) => boolean
  weaponKind: (gear: GearContext) => 'ONE_HANDED' | 'TWO_HANDED' | 'RANGED' | null
  weaponFits: (skill: SkillDef, gear: GearContext) => boolean
  weaponFitReason: (skill: SkillDef, gear: GearContext) => string | null
  getPassiveSkillBonuses: (levels: Record<string, number> | undefined, gear: GearContext) => PassiveBonuses
  previewSkillBonus: (skill: SkillDef, level: number, mag: number) => SkillBonusPreview | null
}

export const SKILLS = registry.SKILLS
export const SKILL_GROUPS = registry.SKILL_GROUPS
export const SKILL_TEACHERS = registry.SKILL_TEACHERS
export const getSkill = registry.getSkill
export const isShieldItem = registry.isShieldItem
export const weaponFits = registry.weaponFits
export const weaponFitReason = registry.weaponFitReason
export const weaponKind = registry.weaponKind

/** Skills paint with the same decorative hue roles spells do. */
export const skillTone = spellTone

/** What the player is holding, from the live bag — the context every skill reads. */
export function gearContextFromInventory(inventory: InventoryItem[]): GearContext {
  const weapon = inventory.find((item) => item.isEquipped && item.slot === 'MAIN_HAND') ?? null
  const offHand = inventory.find((item) => item.isEquipped && item.slot === 'OFF_HAND') ?? null
  return {
    weaponCategory: (weapon?.template.weaponCategory as 'MELEE' | 'RANGED' | null | undefined) ?? null,
    isTwoHanded: weapon ? isTwoHanded(weapon) : false,
    hasShield: offHand ? registry.isShieldItem(offHand.template) : false,
  }
}

export interface SkillbookEntry {
  def: SkillDef
  level: number
  /** Cap from the best teacher met; 0 when no teacher has been found yet. */
  maxLevel: number
  /** SP for the next level, or null at the cap / with no teacher. */
  nextLearnCost: number | null
  /** MP per use for strikes (at level 1 when unlearned, for display); null for passives. */
  castCost: number | null
  preview: SkillBonusPreview | null
  /** Learned, a strike, and the engine can fire it. */
  usable: boolean
  teachers: { flag: string; name: string; max: number; met: boolean }[]
}

/** The full skill book for a player: every skill, learned or not. */
export function buildSkillbook(player: Player | null | undefined): SkillbookEntry[] {
  const levels = player?.skills ?? {}
  const flags = player?.skillTeachers ?? {}
  const mag = effectiveMag(player)

  return SKILLS.map((def) => {
    const level = levels[def.column] ?? 0
    const maxLevel = registry.getSkillMaxLevel(def, flags)
    const displayLevel = Math.max(1, level)
    return {
      def,
      level,
      maxLevel,
      nextLearnCost: registry.getNextLearnCost(def, level, maxLevel),
      castCost: def.castCost ? def.castCost(displayLevel) : null,
      preview: registry.previewSkillBonus(def, displayLevel, mag),
      usable: level >= 1 && registry.isStrikeSkill(def),
      teachers: def.teachers.map((tier) => ({
        flag: tier.flag,
        name: SKILL_TEACHERS[tier.flag]?.name ?? tier.flag,
        max: tier.max,
        met: Boolean(flags[tier.flag]),
      })),
    }
  })
}

/** Learned strikes the engine can fire right now, in registry order. */
export function getStrikeSkills(player: Player | null | undefined): SkillbookEntry[] {
  return buildSkillbook(player).filter((entry) => entry.usable)
}

/** Whether the player could spend SP on any skill at all — drives the "Learn" nudge. */
export function hasLearnableSkill(player: Player | null | undefined): boolean {
  const sp = player?.sp ?? 0
  return buildSkillbook(player).some((entry) => entry.nextLearnCost !== null && entry.nextLearnCost <= sp)
}

/** The passive bonuses in force for what the player is holding. */
export function passiveSkillBonuses(player: Player | null | undefined, gear: GearContext): PassiveBonuses {
  return registry.getPassiveSkillBonuses(player?.skills, gear)
}
