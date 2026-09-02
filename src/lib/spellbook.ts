/**
 * Client-side view of the spell registry.
 *
 * game-data/spells.js is the single source of truth for what each spell is;
 * this module turns a player's spell levels and teacher flags into what the
 * spellbook, the battle Spells tab and the World Tool need to render — caps,
 * costs, previews — without a server round-trip. Nothing here decides anything:
 * the server re-derives every number when a spell is learned or cast.
 */
import type { Player } from '@/lib/game-state'
const { getStatBuffBonuses } = require('@/lib/game-engine/services/buff-service') as {
  getStatBuffBonuses: (row: Record<string, number> | null | undefined) => { str: number; dex: number; mag: number; def: number }
}

export type SpellSchool = 'destruction' | 'restoration' | 'alteration'
export type SpellKind = 'attack' | 'heal' | 'buff'

export interface SpellTeacherTier {
  flag: string
  max: number
}

export interface SpellPreview {
  min: number
  max: number
  text: string
}

export interface SpellDef {
  id: string
  column: string
  name: string
  school: SpellSchool
  kind: SpellKind
  implemented: boolean
  icon: string
  attackIcon?: string
  hue: string
  description: string
  formula: string
  teachers: SpellTeacherTier[]
  learnCost: (level: number) => number
  castCost: (level: number, mag: number) => number
  preview?: (level: number, mag: number) => SpellPreview
}

export interface SpellSchoolDef {
  id: SpellSchool
  name: string
  blurb: string
}

const registry = require('@/lib/game-data/spells') as {
  SPELLS: SpellDef[]
  SPELL_SCHOOLS: SpellSchoolDef[]
  SPELL_TEACHERS: Record<string, { name: string; roomId: string }>
  getSpell: (id: string) => SpellDef | null
  getSpellMaxLevel: (spell: SpellDef, flags: Record<string, boolean> | undefined) => number
  getNextLearnCost: (spell: SpellDef, level: number, maxLevel: number) => number | null
  isCastable: (spell: SpellDef) => boolean
  previewSpell: (spell: SpellDef, level: number, mag: number) => SpellPreview | null
}

export const SPELLS = registry.SPELLS
export const SPELL_SCHOOLS = registry.SPELL_SCHOOLS
export const SPELL_TEACHERS = registry.SPELL_TEACHERS
export const getSpell = registry.getSpell

/**
 * Each spell's decorative hue, as the semantic-role classes the UI paints with.
 * Hues distinguish spells without meaning anything (a Fireball is "the red
 * one"), which is exactly what the `hue.*` family is for.
 */
export const SPELL_TONES: Record<string, { text: string; fill: string; border: string; glow: string }> = {
  blue: { text: 'text-hue-blue', fill: 'fill-hue-blue', border: 'border-hue-blue', glow: 'var(--hue-blue)' },
  red: { text: 'text-hue-red', fill: 'fill-hue-red', border: 'border-hue-red', glow: 'var(--hue-red)' },
  green: { text: 'text-hue-green', fill: 'fill-hue-green', border: 'border-hue-green', glow: 'var(--hue-green)' },
  gold: { text: 'text-hue-gold', fill: 'fill-hue-gold', border: 'border-hue-gold', glow: 'var(--hue-gold)' },
  sky: { text: 'text-hue-sky', fill: 'fill-hue-sky', border: 'border-hue-sky', glow: 'var(--hue-sky)' },
  pink: { text: 'text-hue-pink', fill: 'fill-hue-pink', border: 'border-hue-pink', glow: 'var(--hue-pink)' },
  purple: { text: 'text-hue-purple', fill: 'fill-hue-purple', border: 'border-hue-purple', glow: 'var(--hue-purple)' },
  violet: { text: 'text-hue-violet', fill: 'fill-hue-violet', border: 'border-hue-violet', glow: 'var(--hue-violet)' },
  gray: { text: 'text-hue-gray', fill: 'fill-hue-gray', border: 'border-hue-gray', glow: 'var(--hue-gray)' },
}

export function spellTone(hue: string) {
  return SPELL_TONES[hue] ?? SPELL_TONES.gray
}

/**
 * Effective MAG — core + equipment + running buffs — the number every spell
 * formula reads (the original's `magmod`). Mirrors BattleState.applyStats.
 */
export function effectiveMag(player: Pick<Player, 'mag' | 'magMod' | 'buffs'> | null | undefined): number {
  if (!player) return 0
  return (player.mag ?? 0) + (player.magMod ?? 0) + getStatBuffBonuses(player.buffs ?? null).mag
}

export interface SpellbookEntry {
  def: SpellDef
  level: number
  /** Cap from the best teacher met; 0 when no teacher has been found yet. */
  maxLevel: number
  /** SP for the next level, or null at the cap / with no teacher. */
  nextLearnCost: number | null
  /** MP to cast at the current level (at level 1 when unlearned, for display). */
  castCost: number
  preview: SpellPreview | null
  /** Learned, and its kind has a handler in the engine. */
  castable: boolean
  teachers: { flag: string; name: string; max: number; met: boolean }[]
}

/** The full spellbook for a player: every spell, learned or not. */
export function buildSpellbook(player: Player | null | undefined): SpellbookEntry[] {
  const levels = player?.spells ?? {}
  const flags = player?.spellTeachers ?? {}
  const mag = effectiveMag(player)

  return SPELLS.map((def) => {
    const level = levels[def.column] ?? 0
    const maxLevel = registry.getSpellMaxLevel(def, flags)
    const displayLevel = Math.max(1, level)
    return {
      def,
      level,
      maxLevel,
      nextLearnCost: registry.getNextLearnCost(def, level, maxLevel),
      castCost: def.castCost(displayLevel, mag),
      preview: registry.previewSpell(def, displayLevel, mag),
      castable: level >= 1 && registry.isCastable(def),
      teachers: def.teachers.map((tier) => ({
        flag: tier.flag,
        name: SPELL_TEACHERS[tier.flag]?.name ?? tier.flag,
        max: tier.max,
        met: Boolean(flags[tier.flag]),
      })),
    }
  })
}

/** Learned spells the engine can cast right now, in registry order. */
export function getCastableSpells(player: Player | null | undefined): SpellbookEntry[] {
  return buildSpellbook(player).filter((entry) => entry.castable)
}

/** Whether the player could spend SP on anything at all — drives the "Learn" nudge. */
export function hasLearnableSpell(player: Player | null | undefined): boolean {
  const sp = player?.sp ?? 0
  return buildSpellbook(player).some((entry) => entry.nextLearnCost !== null && entry.nextLearnCost <= sp)
}
