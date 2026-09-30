'use client'

import { useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import type { InventoryItem, Player } from '@/lib/game-state'
import { getCastableSpells } from '@/lib/spellbook'
import { skillTone, type SkillbookEntry } from '@/lib/skillbook'
import { ammoFor, attackBlockedBy, buildStrikeRow, rangeText, weaponInHand, type DeckContext } from '@/lib/action-deck'
import { defaultActionTab, useActionTab, type ActionTab } from '@/lib/use-action-tab'
import { ABILITY_GRID, SpellRow, useConsumableDeck } from './AbilityRows'
import ConsumableDeck from './ConsumableDeck'

export interface ActionDeckProps {
  player: Player
  inventory: InventoryItem[]
  /** The fight's view of things, or the room's: see action-deck.ts. */
  context: DeckContext
  mpMax: number
  /** Held while a turn resolves. */
  isActing: boolean
  onAttack: () => void
  onUseSkill: (skillId: string) => void
  onCastSpell: (spellId: string) => void
  onUseItem: (playerItemId: string, action: string) => void
  /** Out of a fight: tap a name to read it in the book. Omit in battle, where the row body goes inert. */
  onOpenBook?: (tab: 'skills' | 'spells', highlightId?: string) => void
  /** Out of a fight: tap an item's name to open it in the bag. */
  onOpenItem?: (playerItemId: string) => void
  /**
   * Cap the list and let it scroll inside its frame (the deck, the phone
   * sheet). Off, the list grows and whatever holds the deck scrolls — a list
   * that is a scroll container with nothing to scroll would swallow the wheel
   * instead of passing it up.
   */
  listClassName?: string
  idPrefix?: string
}

/**
 * The action deck: Attack and the power attacks beside it, then a filled
 * Spells | Items switch, then the list. The battle deck draws it under its
 * header; the Action layer draws it over the compass; the phone sheet draws
 * it over the room. One component, so the same situation always reads the
 * same: the differences between the three are state the server already
 * rules on, never layout.
 *
 * Every attack button prints its raw roll range before the enemy's block, the
 * original's "(max N)" made honest. Refused controls stay visible and dimmed
 * with the reason in place of the cost; the server refuses them too, without
 * spending the turn.
 */
export default function ActionDeck({
  player,
  inventory,
  context,
  mpMax,
  isActing,
  onAttack,
  onUseSkill,
  onCastSpell,
  onUseItem,
  onOpenBook,
  onOpenItem,
  listClassName = '',
  idPrefix = 'action',
}: ActionDeckProps) {
  const { situation, target, isRanged, swingMax, groupScale } = context
  const { weapon, iconName: weaponIconName, name: weaponName } = weaponInHand(inventory)

  // Where the switch was left, on this device, shared with every other deck;
  // before it has ever been moved, a caster opens on Spells.
  const [storedTab, setStoredTab] = useActionTab()
  const [firstDefault] = useState<ActionTab>(() => defaultActionTab(player, inventory))
  const activeTab: ActionTab = storedTab ?? firstDefault

  const blocked = attackBlockedBy({ player, inventory, isRanged, target })
  const strikes = useMemo(
    () => buildStrikeRow({ player, inventory, isRanged, swingMax, groupScale, playerMp: situation.mp, inBattle: situation.inBattle, target }),
    [player, inventory, isRanged, swingMax, groupScale, situation.mp, situation.inBattle, target]
  )
  const castableSpells = getCastableSpells(player)
  const consumables = useConsumableDeck(inventory)
  const hpFull = situation.hp >= situation.hpMax
  const mpFull = situation.mp >= mpMax

  // Bows and the crossbow spend ammo; the server refuses a shot with none left
  // without spending the turn. Count from the bag so the number is right before
  // the first shot too, not only after one.
  const ammo = ammoFor(weapon, inventory)
  const outOfAmmo = ammo !== null && ammo.remaining <= 0
  const attackDisabled = isActing || outOfAmmo || Boolean(blocked)
  const attackTitle = outOfAmmo && ammo
    ? `No ${ammo.label} left — equip another weapon from your bag`
    : blocked === 'Nothing to hit'
      ? 'Nothing here to attack'
      : `Rolls 0–${Math.max(0, swingMax)} ${isRanged ? 'DEX' : 'STR'}${target ? `; the ${target.name} blocks 0–${target.def ?? '?'}` : ''}`

  const tabs: { id: ActionTab; label: string; icon: string; count: number; fill: string }[] = [
    { id: 'spells', label: 'Spells', icon: 'magic', count: castableSpells.length, fill: 'fill-stat-mag' },
    { id: 'items', label: 'Items', icon: 'inv', count: consumables.all.length, fill: 'fill-resource-gold' },
  ]

  return (
    <div className="@container flex flex-col gap-2 min-h-0">
      {/* The strike row: Attack, then the power attacks the weapon can carry.
          In a narrow home (the Explore column, a phone) Attack takes the whole
          first line and the strikes drop under it, so the range and the
          weapon's name never fight for the same pixels. */}
      <div className="flex flex-wrap items-stretch gap-1.5">
        {/* Attack: ranged strikes are DEX, melee are STR — the same split the
            combat formulas use, so the control wears the stat it rolls against
            and prints the roll it can make: 0 to that stat, before the block.
            Out of a fight it opens one with the enemy in the room. */}
        <button
          type="button"
          onClick={onAttack}
          disabled={attackDisabled}
          title={attackTitle}
          aria-label={blocked ? `Attack with ${weaponName ?? 'fists'}. ${blocked}` : `Attack with ${weaponName ?? 'fists'}, ${rangeText(0, swingMax)} damage`}
          className={`basis-full @min-[460px]:basis-0 @min-[460px]:flex-[2] min-w-0 h-16 rounded-xl flex items-center gap-2.5 px-3 text-left shadow-md shadow-shadow/40 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${isRanged ? 'fill-stat-dex' : 'fill-stat-str'}`}
        >
          <Icon name={weaponIconName} size={30} className="opacity-90 flex-shrink-0" />
          <span className="flex-1 min-w-0 flex flex-col gap-1 leading-none">
            <span className="text-base font-black uppercase tracking-[0.12em]">{isActing ? '…' : 'Attack'}</span>
            <span className="text-[11px] font-medium opacity-85 truncate">{weaponName ?? 'Fists'}</span>
          </span>
          <span className="flex-shrink-0 flex flex-col items-end gap-1 leading-none">
            {/* The damage range, or why there is none against this enemy. */}
            {blocked ? (
              <span className="text-[11px] font-bold leading-none whitespace-nowrap">{blocked}</span>
            ) : (
              <span className="text-[15px] font-black tabular-nums leading-none">{rangeText(0, swingMax)}</span>
            )}
            {/* Ammo-spending weapons show what's left on the control itself, so
                running dry is visible before it blocks a shot. */}
            {ammo ? (
              <span
                className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                  ammo.remaining <= 0 ? 'fill-status-error' : ammo.remaining <= 5 ? 'fill-resource-gold' : 'bg-surface-canvas/35'
                }`}
                style={{ textShadow: 'none' }}
              >
                {ammo.remaining <= 0 ? `No ${ammo.label}` : `${ammo.remaining} ${ammo.label}`}
              </span>
            ) : !blocked && (
              <span className="text-[9px] font-semibold uppercase tracking-wider opacity-85 leading-none">dmg</span>
            )}
          </span>
        </button>

        {strikes.map(({ entry, range, reason }) => (
          <StrikeButton
            key={entry.def.id}
            entry={entry}
            range={range}
            reason={reason}
            disabled={isActing || outOfAmmo || Boolean(reason)}
            onClick={() => onUseSkill(entry.def.id)}
          />
        ))}
      </div>

      {/* The switch: one filled segment, counts on both. */}
      <div role="tablist" aria-label="Spells or Items" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-sunken border border-line-subtle">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-deck-${tab.id}`}
              id={`${idPrefix}-tab-${tab.id}`}
              onClick={() => setStoredTab(tab.id)}
              className={`h-9 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                selected ? tab.fill : 'text-fg-muted hover:text-fg-primary hover:bg-surface-raised/60'
              }`}
            >
              <Icon name={tab.icon} size={14} className={selected ? 'opacity-90' : 'opacity-70'} />
              <span>{tab.label}</span>
              <span className={`text-[10px] font-bold px-1.5 py-px rounded-full tabular-nums ${selected ? 'bg-surface-canvas/30' : 'bg-surface-raised text-fg-secondary'}`} style={selected ? { textShadow: 'none' } : undefined}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* The list. The deck caps it so a deep bag scrolls inside the card
          instead of pushing the room off the screen; the layer lets it fill. */}
      <div
        role="tabpanel"
        id={`${idPrefix}-deck-${activeTab}`}
        aria-labelledby={`${idPrefix}-tab-${activeTab}`}
        className={`@container flex flex-col gap-1.5 min-h-0 ${listClassName ? `overflow-y-auto overscroll-contain ${listClassName}` : ''}`}
      >
        {activeTab === 'items' && (
          <ConsumableDeck
            inventory={inventory}
            hpFull={hpFull}
            mpFull={mpFull}
            disabled={isActing}
            onUse={onUseItem}
            onOpen={onOpenItem}
          />
        )}

        {activeTab === 'spells' && (
          castableSpells.length === 0 ? (
            <p className="text-xs text-fg-disabled italic py-2 px-1">No spells learned yet.</p>
          ) : (
            // No `onOpen` in a fight: the row body is inert, so the only thing
            // on it that can spend MP is the Cast button itself.
            <div className={ABILITY_GRID}>
              {castableSpells.map((entry) => (
                <SpellRow
                  key={entry.def.id}
                  entry={entry}
                  situation={situation}
                  disabled={isActing}
                  onCast={onCastSpell}
                  onOpen={onOpenBook ? (spellId) => onOpenBook('spells', spellId) : undefined}
                />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

/**
 * One strike beside Attack — a power attack. Reads top to bottom: what it
 * is, what it can roll (swing plus bonus), what it costs. Refused strikes stay
 * visible and dimmed with the reason in place of the cost; the server refuses
 * them too, without spending the turn.
 */
function StrikeButton({
  entry,
  range,
  reason,
  disabled,
  onClick,
}: {
  entry: SkillbookEntry
  range: { lo: number; hi: number } | null
  reason: string | null
  disabled: boolean
  onClick: () => void
}) {
  const tone = skillTone(entry.def.hue)
  const cost = entry.castCost ?? 0
  const label = range ? `${entry.def.name}, ${rangeText(range.lo, range.hi)} damage, ${cost} MP` : `${entry.def.name}, ${cost} MP`
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={reason ?? `${entry.def.name} lvl ${entry.level} — ${entry.def.formula}`}
      aria-label={reason ? `${label}. ${reason}` : label}
      className={`flex-1 min-w-[72px] max-w-[116px] h-16 rounded-xl flex flex-col items-center justify-center gap-0.5 px-1.5 shadow-md shadow-shadow/40 transition-all duration-150 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${tone.fill}`}
    >
      <span className="flex items-center gap-1 max-w-full">
        <Icon name={entry.def.icon} size={14} className="opacity-90 flex-shrink-0" />
        <span className="text-[10px] font-bold leading-none truncate">{entry.def.name}</span>
      </span>
      <span className="text-[15px] font-black tabular-nums leading-none">
        {range ? rangeText(range.lo, range.hi) : '—'}
      </span>
      <span className={`text-[9px] font-semibold tabular-nums leading-none ${reason ? 'underline decoration-dotted' : 'opacity-85'}`}>
        {reason ?? `${cost} MP`}
      </span>
    </button>
  )
}
