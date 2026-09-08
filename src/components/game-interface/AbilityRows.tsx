'use client'

import { useMemo } from 'react'
import EntryRow, { EntryVerb } from '@/components/EntryRow'
import type { InventoryItem } from '@/lib/game-state'
import { getItemActions, resolveItemIcon, summarizeConsumable, type ConsumableSummary } from '@/lib/item-actions'
import { castBlockedReason, spellTone, type CastSituation, type SpellbookEntry } from '@/lib/spellbook'
import { skillTone, strikeBlockedReason, type GearContext, type PassiveBonuses, type SkillbookEntry } from '@/lib/skillbook'

/**
 * One row per thing the player can reach for — a skill, a spell, a consumable —
 * drawn the same way wherever it appears. The character panel and the battle
 * command deck both render these, so a Fireball reads identically whether you
 * are planning or fighting.
 *
 * The split of duties is the same on every row: the name and the numbers open
 * the surface that owns the thing (the book, the bag) and never do anything
 * else; the verb at the end is the only control that spends MP, an item, or a
 * turn. In a fight the callers pass no `onOpen` at all, so the body goes inert
 * and the verb is the only live target on the row.
 */

/** The frame every ability row wears, so all three lists read as one. */
const ROW_FRAME = 'rounded-lg border-l-[3px] border-line-strong/70 bg-surface-raised/45 hover:bg-surface-raised/60'
const ROW_FRAME_MUTED = 'rounded-lg border-l-[3px] border-line-subtle/50 bg-surface-raised/25'

/**
 * How every list of these rows lays out: one column in a narrow container,
 * two once there is room for both without squeezing the names. A container
 * query, not a viewport one — the same list sits in a resizable side panel and
 * in the battle area, and only its own width decides.
 */
export const ABILITY_GRID = 'grid grid-cols-1 @min-[600px]:grid-cols-2 gap-1.5'

/**
 * A row's colour, as the semantic roles the theme already defines: what the
 * thing touches. The icon, the left rail and the verb all wear it, so a
 * Strength Potion reads as STR at a glance and its button matches.
 */
const TONES = {
  hp: { text: 'text-resource-hp', fill: 'fill-resource-hp', rail: 'border-l-resource-hp' },
  mp: { text: 'text-resource-mp', fill: 'fill-resource-mp', rail: 'border-l-resource-mp' },
  both: { text: 'text-hue-purple', fill: 'fill-hue-purple', rail: 'border-l-hue-purple' },
  str: { text: 'text-stat-str', fill: 'fill-stat-str', rail: 'border-l-stat-str' },
  dex: { text: 'text-stat-dex', fill: 'fill-stat-dex', rail: 'border-l-stat-dex' },
  mag: { text: 'text-stat-mag', fill: 'fill-stat-mag', rail: 'border-l-stat-mag' },
  def: { text: 'text-stat-def', fill: 'fill-stat-def', rail: 'border-l-stat-def' },
  all: { text: 'text-resource-gold', fill: 'fill-resource-gold', rail: 'border-l-resource-gold' },
  ability: { text: 'text-hue-sky', fill: 'fill-hue-sky', rail: 'border-l-hue-sky' },
  ward: { text: 'text-hue-green', fill: 'fill-hue-green', rail: 'border-l-hue-green' },
  neutral: { text: 'text-fg-bright', fill: 'fill-accent', rail: 'border-l-line-strong' },
} as const

/** Which of those a buff countdown belongs to, by the column it ticks down. */
const BUFF_TONE: Record<string, keyof typeof TONES> = {
  buffStrClicks: 'str',
  buffDexClicks: 'dex',
  buffMagClicks: 'mag',
  buffDefClicks: 'def',
  buffCoffeeClicks: 'all',
  buffGloryClicks: 'all',
  // Tea restores HP *and* MP a click, so it belongs to the dual family with
  // the potions that fill both — purple, not one vital's colour.
  buffTeaClicks: 'both',
  regenerateClicks: 'hp',
  ironSkinClicks: 'def',
  poisonImmuneClicks: 'ward',
  wings: 'ability',
  gills: 'ability',
}

/** What this consumable is coloured by: what it restores, or the buff it grants. */
function consumableTone(summary: ConsumableSummary) {
  if (summary.group === 'hp') return TONES.hp
  if (summary.group === 'mp') return TONES.mp
  if (summary.group === 'both') return TONES.both
  const buff = summary.buffs[0]
  // Coffee and Glory lift everything; they read as an aura, not as one stat.
  if (buff && Object.keys(buff.bonus).length >= 3) return TONES.all
  return TONES[BUFF_TONE[buff?.field ?? ''] ?? 'neutral']
}

/** `lvl 3/5`, the level tag every learned skill and spell carries. */
function LevelTag({ level, maxLevel }: { level: number; maxLevel: number }) {
  const atMax = maxLevel > 0 && level >= maxLevel
  return (
    <span
      className={`text-[9px] font-semibold uppercase tracking-[0.08em] leading-[14px] px-1 rounded-sm border tabular-nums flex-shrink-0 ${
        atMax ? 'border-resource-gold/50 text-resource-gold' : 'border-line-strong/60 text-fg-muted'
      }`}
    >
      lvl {level}/{maxLevel}
    </span>
  )
}

/* ------------------------------------------------------------------------- */
/* Skills                                                                     */
/* ------------------------------------------------------------------------- */

/** What a passive is doing right now, given what is in hand. */
function passiveStatus(entry: SkillbookEntry, gear: GearContext, passives: PassiveBonuses): string {
  const part = passives.parts.find((p) => p.skillId === entry.def.id)
  if (part) {
    return part.stat === 'dodge' ? `${part.amount}% chance to dodge` : `+${part.amount} ${part.stat.toUpperCase()} right now`
  }
  const holds = entry.def.id === 'block' ? 'a shield is equipped' : 'the right weapon is in hand'
  return `Counts while ${holds}`
}

export interface SkillRowProps {
  entry: SkillbookEntry
  gear: GearContext
  passives: PassiveBonuses
  situation: Omit<CastSituation, 'hp' | 'hpMax' | 'buffs'>
  /** Held while a turn resolves; the reason still explains any other refusal. */
  disabled?: boolean
  onUse: (skillId: string) => void
  /** Tap the name to read it in the book. Omit in a fight. */
  onOpen?: (skillId: string) => void
}

/**
 * A learned skill. Strikes carry a Use; passives carry nothing at all — they
 * are already working, and their line says by how much.
 */
export function SkillRow({ entry, gear, passives, situation, disabled = false, onUse, onOpen }: SkillRowProps) {
  const { def, level, maxLevel, castCost, preview, usable } = entry
  const tone = skillTone(def.hue)
  const blocked = strikeBlockedReason(entry, { ...situation, gear })
  const detail = def.kind === 'strike'
    ? preview ? `Adds ${preview.min}–${preview.max} to the swing` : def.formula
    : def.kind === 'passive' ? passiveStatus(entry, gear, passives)
    : def.formula

  return (
    <EntryRow
      density="deck"
      icon={def.icon}
      iconClass={`${tone.text} opacity-90`}
      name={def.name}
      nameTags={<LevelTag level={level} maxLevel={maxLevel} />}
      subline={<span className="text-[10px] text-fg-muted tabular-nums truncate">{detail}</span>}
      meta={usable && castCost !== null ? (
        <span className="text-xs font-bold text-resource-mp tabular-nums whitespace-nowrap">{castCost} MP</span>
      ) : undefined}
      reason={blocked}
      action={usable ? (
        <EntryVerb
          onClick={() => onUse(def.id)}
          disabled={Boolean(blocked) || disabled}
          fillClass={tone.fill}
          title={blocked ?? (situation.inBattle ? `${def.name} this turn` : `${def.name} — opens the fight`)}
          ariaLabel={`Use ${def.name}${blocked ? `. ${blocked}` : ''}`}
        >
          Use
        </EntryVerb>
      ) : undefined}
      onOpen={onOpen ? () => onOpen(def.id) : undefined}
      bodyAriaLabel={onOpen ? `${def.name} — read it in the skill book` : undefined}
      className={`${usable ? ROW_FRAME : ROW_FRAME_MUTED} ${usable ? tone.rail : ""}`}
    />
  )
}

/* ------------------------------------------------------------------------- */
/* Spells                                                                     */
/* ------------------------------------------------------------------------- */

export interface SpellRowProps {
  entry: SpellbookEntry
  situation: CastSituation
  /** Held while a turn resolves; the reason still explains any other refusal. */
  disabled?: boolean
  onCast: (spellId: string) => void
  /** Tap the name to read it in the book. Omit in a fight. */
  onOpen?: (spellId: string) => void
}

/** A learned spell. Wings and Gills have no handler yet and carry no verb. */
export function SpellRow({ entry, situation, disabled = false, onCast, onOpen }: SpellRowProps) {
  const { def, level, maxLevel, castCost, preview, castable } = entry
  const tone = spellTone(def.hue)
  const blocked = castBlockedReason(entry, situation)
  const detail = preview
    ? `${preview.label ?? (def.kind === 'heal' ? 'Heals' : def.kind === 'attack' ? 'Hits' : '')} ${
        preview.min === preview.max ? preview.min : `${preview.min}–${preview.max}`
      }${def.kind === 'attack' ? ' dmg' : ''}`.trim()
    : def.formula

  return (
    <EntryRow
      density="deck"
      icon={def.icon}
      iconClass={`${tone.text} opacity-90`}
      name={def.name}
      nameTags={<LevelTag level={level} maxLevel={maxLevel} />}
      subline={<span className="text-[10px] text-fg-muted tabular-nums truncate">{detail}</span>}
      meta={<span className="text-xs font-bold text-resource-mp tabular-nums whitespace-nowrap">{castCost} MP</span>}
      reason={blocked}
      action={castable ? (
        <EntryVerb
          onClick={() => onCast(def.id)}
          disabled={Boolean(blocked) || disabled}
          fillClass={tone.fill}
          title={blocked ?? (def.kind === 'attack' && !situation.inBattle ? `Cast ${def.name} — opens the fight` : `Cast ${def.name}`)}
          ariaLabel={`Cast ${def.name}${blocked ? `. ${blocked}` : ''}`}
        >
          Cast
        </EntryVerb>
      ) : undefined}
      onOpen={onOpen ? () => onOpen(def.id) : undefined}
      bodyAriaLabel={onOpen ? `${def.name} — read it in the spell book` : undefined}
      className={`${castable ? ROW_FRAME : ROW_FRAME_MUTED} ${castable ? tone.rail : ""}`}
    />
  )
}

/* ------------------------------------------------------------------------- */
/* Consumables                                                                */
/* ------------------------------------------------------------------------- */

/** One consumable, read once into what it does. */
export interface ConsumableEntry {
  item: InventoryItem
  summary: ConsumableSummary
  /** The verb the server expects: "drink", "eat". */
  action: string
}

/**
 * The bag, sorted the way a fight wants it: HP and MP restorers in two
 * ladders strongest first, anything that fills both under them, buffs last.
 * The Flower, which costs HP, stays out — nothing in this list hurts.
 */
export function useConsumableDeck(inventory: InventoryItem[]) {
  return useMemo(() => {
    const all: ConsumableEntry[] = inventory
      .filter((item) => item.template.type === 'CONSUMABLE')
      .map((item) => {
        const summary = summarizeConsumable(item.template.metadata as never)
        const action = getItemActions(item.template.slug, item.template.metadata as never)[0] ?? null
        return summary && action && summary.group !== 'harm' ? { item, summary, action: action.action } : null
      })
      .filter((entry): entry is ConsumableEntry => entry !== null)
    const byAmount = (pick: (summary: ConsumableSummary) => number) => (a: ConsumableEntry, b: ConsumableEntry) =>
      pick(b.summary) - pick(a.summary)
    const hp = all.filter((e) => e.summary.group === 'hp').sort(byAmount((s) => s.hp))
    const mp = all.filter((e) => e.summary.group === 'mp').sort(byAmount((s) => s.mp))
    const both = all.filter((e) => e.summary.group === 'both').sort(byAmount((s) => s.hp + s.mp))
    // Stat buffs before abilities (wings, gills), which do nothing for a fight.
    const buffs = all
      .filter((e) => e.summary.group === 'buff' || e.summary.group === 'other')
      .sort((a, b) =>
        Number(b.summary.buffs.some((buff) => buff.short.startsWith('+'))) -
        Number(a.summary.buffs.some((buff) => buff.short.startsWith('+')))
      )
    // `all` is those four in order, so a flat list (the character panel) reads
    // in the same order as the deck's grouped one.
    return { all: [...hp, ...mp, ...both, ...buffs], hp, mp, both, buffs }
  }, [inventory])
}

/**
 * What the item does, in the colours of what it touches — the consumable's
 * answer to a spell's "Hits 22–34". It sits on the second line because the
 * verb ("Drink") is already on the button, and saying it twice reads badly.
 */
function ConsumableEffect({ summary, toneClass }: { summary: ConsumableSummary; toneClass: string }) {
  const clicks = summary.buffs.find((buff) => buff.clicks > 0)?.clicks ?? 0
  return (
    <span className="text-[11px] font-semibold tabular-nums flex flex-wrap items-center gap-x-1.5">
      {summary.hp > 0 && <span className="text-resource-hp">+{summary.hp} HP</span>}
      {summary.mp > 0 && <span className="text-resource-mp">+{summary.mp} MP</span>}
      {summary.buffs.map((buff) => (
        <span key={buff.short} className={toneClass}>{buff.short}</span>
      ))}
      {clicks > 0 && <span className="text-[10px] font-normal text-fg-muted">{clicks} clicks</span>}
      {summary.hp <= 0 && summary.mp <= 0 && summary.buffs.length === 0 && (
        <span className="text-fg-muted font-normal">{summary.effect}</span>
      )}
    </span>
  )
}

export interface ConsumableRowProps {
  entry: ConsumableEntry
  /** Why it cannot be spent right now ("Full HP"), or null. */
  reason?: string | null
  disabled?: boolean
  onUse: (playerItemId: string, action: string) => void
  /** Tap the name to open it in the bag. Omit in a fight. */
  onOpen?: (playerItemId: string) => void
  onHoverChange?: (hovering: boolean) => void
}

/**
 * One consumable, with its verb as the only live control. Its colour comes
 * from what it does — no caller has to say; a Strength Potion is STR-coloured
 * in the bag, in the deck and in the character panel alike.
 */
export function ConsumableRow({
  entry,
  reason = null,
  disabled = false,
  onUse,
  onOpen,
  onHoverChange,
}: ConsumableRowProps) {
  const { item, summary, action } = entry
  const tone = consumableTone(summary)
  const blocked = Boolean(reason) || disabled

  return (
    <EntryRow
      density="deck"
      icon={resolveItemIcon(item.template.metadata ?? null, item.template.slug)}
      iconClass={`${tone.text} opacity-90`}
      name={item.template.name}
      nameTags={
        <span className="text-[10px] font-bold leading-[15px] px-1.5 rounded-md text-resource-gold bg-resource-gold/15 border border-resource-gold/40 tabular-nums flex-shrink-0">
          {item.quantity > 1 ? `×${item.quantity}` : 'last'}
        </span>
      }
      subline={<ConsumableEffect summary={summary} toneClass={tone.text} />}
      reason={reason}
      action={
        <EntryVerb
          onClick={() => onUse(item.id, action)}
          disabled={blocked}
          fillClass={tone.fill}
          title={reason ?? `${summary.label} the ${item.template.name} · ${summary.effect}`}
          ariaLabel={`${summary.label} ${item.template.name}, ${summary.effect}${reason ? `. ${reason}` : ''}`}
        >
          {summary.label}
        </EntryVerb>
      }
      onOpen={onOpen ? () => onOpen(item.id) : undefined}
      bodyAriaLabel={onOpen ? `${item.template.name} — open it in the bag` : undefined}
      onHoverChange={onHoverChange}
      className={`${ROW_FRAME} ${tone.rail}`}
    />
  )
}
