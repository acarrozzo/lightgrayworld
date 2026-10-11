'use client'

import { useEffect, useMemo, useState, type Ref } from 'react'
import Icon from '@/components/Icon'
import type { ReactNode } from 'react'
import type { InventoryItem, Player } from '@/lib/game-state'
import { getCastableSpells } from '@/lib/spellbook'
import { skillTone } from '@/lib/skillbook'
import { ammoFor, attackBlockedBy, buildStrikeRow, rangeText, weaponInHand, type DeckContext } from '@/lib/action-deck'
import { startingActionTab, type ActionTab } from '@/lib/use-action-tab'
import EntryRow, { EntryVerb } from '@/components/EntryRow'
import { ABILITY_GRID, LevelTag, ROW_FRAME, SpellRow, useConsumableDeck } from './AbilityRows'
import ConsumableDeck from './ConsumableDeck'

export interface ActionDeckProps {
  /**
   * The open tab, when the holder owns the switch (the Actions layer draws it
   * as header sub-tabs). Left out, the deck keeps its own and draws the filled
   * switch above the list, as the battle card does.
   */
  tab?: ActionTab
  onTabChange?: (tab: ActionTab) => void
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
  /** The list element, for whoever needs to measure what height it got. */
  listRef?: Ref<HTMLDivElement>
  /** On the deck's root: `flex-1` lets it fill a column its holder has pinned. */
  className?: string
  idPrefix?: string
}

/**
 * The action deck: a filled Attack | Spells | Items switch, then that tab's
 * rows — Attack and the power attacks, the spells, or the item ladders, all
 * drawn the same way. The battle card draws it under its header; the Actions
 * tab draws it as its page. One component, so the same situation always reads
 * the same: the differences between the two are state the server already
 * rules on, never layout. Teleport is the World tab's and Retreat the battle
 * card's corner; neither is a row here.
 *
 * Every attack button prints its raw roll range before the enemy's block, the
 * original's "(max N)" made honest. Refused controls stay visible and dimmed
 * with the reason in place of the cost; the server refuses them too, without
 * spending the turn.
 */
export default function ActionDeck({
  tab: controlledTab,
  onTabChange,
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
  listRef,
  className = '',
  idPrefix = 'action',
}: ActionDeckProps) {
  const { situation, target, isRanged, swingMax, groupScale } = context
  const { weapon, iconName: weaponIconName, name: weaponName } = weaponInHand(inventory)

  // Where the switch starts is decided fresh each time, never remembered: a
  // fight opens on Attack (Spells for a caster), and the Actions tab out of
  // a fight opens on Items. A fight starting or ending while the deck is on
  // screen moves it to that side's start.
  const [ownTab, setOwnTab] = useState<ActionTab>(() => startingActionTab(situation.inBattle, player, inventory))
  useEffect(() => {
    setOwnTab(startingActionTab(situation.inBattle, player, inventory))
    // Only the fight starting or ending resets the tab; the player and bag
    // changing mid-fight must not yank it back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situation.inBattle])
  const activeTab = controlledTab ?? ownTab
  const setActiveTab = onTabChange ?? setOwnTab
  const ownsSwitch = controlledTab === undefined

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

  const tabs: { id: ActionTab; label: string; icon: ReactNode; count?: number; fill: string }[] = [
    { id: 'attack', label: 'Attack', icon: <Icon name={weaponIconName} size={18} className="flex-shrink-0 opacity-90" />, fill: isRanged ? 'fill-stat-dex' : 'fill-stat-str' },
    { id: 'spells', label: 'Spells', icon: <Icon name="magic" size={18} className="flex-shrink-0 opacity-90" />, count: castableSpells.length, fill: 'fill-stat-mag' },
    { id: 'items', label: 'Items', icon: <Icon name="inv" size={18} className="flex-shrink-0 opacity-90" />, count: consumables.all.length, fill: 'fill-resource-gold' },
  ]
  const shownTab: ActionTab = activeTab

  return (
    <div className={`@container flex flex-col gap-2 min-h-0 ${className}`}>
      {/* The switch: one filled segment of three, counts on the two lists. */}
      {ownsSwitch && <div role="tablist" aria-label="Attack, Spells or Items" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-surface-sunken border border-line-subtle">
        {tabs.map((tab) => {
          const selected = shownTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-deck-${tab.id}`}
              id={`${idPrefix}-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`h-12 min-w-0 rounded-lg flex items-center justify-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-focus @max-[460px]:flex-col @max-[460px]:gap-0.5 @max-[460px]:text-[9px] @max-[460px]:tracking-normal ${
                selected ? tab.fill : 'text-fg-muted hover:text-fg-primary hover:bg-surface-raised/60'
              }`}
            >
              {/* In a narrow deck the icon sits over the label, as the main tab bar does. */}
              <span className={selected ? 'opacity-100' : 'opacity-70'}>{tab.icon}</span>
              <span className="truncate">{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-px rounded-full tabular-nums @max-[460px]:hidden ${selected ? 'bg-surface-canvas/30' : 'bg-surface-raised text-fg-secondary'}`} style={selected ? { textShadow: 'none' } : undefined}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>}

      {/* The list. The deck caps it so a deep bag scrolls inside the card
          instead of pushing the room off the screen; the layer lets it fill. */}
      <div
        ref={listRef}
        role={ownsSwitch ? 'tabpanel' : undefined}
        id={`${idPrefix}-deck-${shownTab}`}
        aria-labelledby={ownsSwitch ? `${idPrefix}-tab-${shownTab}` : undefined}
        className={`@container flex flex-col gap-1.5 min-h-0 ${listClassName ? `overflow-y-auto overscroll-contain ${listClassName}` : ''}`}
      >
        {/* Attack and the power attacks, as the same rows the spells and
            items wear: what it is, the whole swing it can roll before the
            enemy's block, what it costs, and one verb that spends the turn.
            Refused rows stay visible with the reason in place of the cost;
            the server refuses them too, without spending the turn. */}
        {shownTab === 'attack' && (
          <div className={ABILITY_GRID}>
            {/* Attack: ranged strikes are DEX, melee are STR — the same split
                the combat formulas use, so the verb wears the stat it rolls
                against. Out of a fight it opens one with the enemy in the room.
                Ammo-spending weapons show what is left where a cost would be. */}
            <EntryRow
              density="deck"
              icon={weaponIconName}
              iconClass={`${isRanged ? 'text-stat-dex' : 'text-stat-str'} opacity-90`}
              name="Attack"
              nameTags={<span className="truncate text-[10px] font-medium text-fg-muted">{weaponName ?? 'Fists'}</span>}
              subline={<span className="text-[10px] text-fg-muted tabular-nums truncate">Hits {rangeText(0, swingMax)} dmg</span>}
              meta={
                ammo ? (
                  <span
                    className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md whitespace-nowrap ${
                      ammo.remaining <= 5 ? 'fill-resource-gold' : 'bg-surface-canvas/60 text-fg-secondary'
                    }`}
                  >
                    {ammo.remaining} {ammo.label}
                  </span>
                ) : undefined
              }
              reason={outOfAmmo && ammo ? `No ${ammo.label}` : blocked}
              action={
                <EntryVerb
                  onClick={onAttack}
                  disabled={attackDisabled}
                  fillClass={isRanged ? 'fill-stat-dex' : 'fill-stat-str'}
                  title={attackTitle}
                  ariaLabel={blocked ? `Attack with ${weaponName ?? 'fists'}. ${blocked}` : `Attack with ${weaponName ?? 'fists'}, ${rangeText(0, swingMax)} damage`}
                >
                  {isActing ? '…' : 'Attack'}
                </EntryVerb>
              }
              className={`${ROW_FRAME} ${isRanged ? 'border-l-stat-dex' : 'border-l-stat-str'}`}
            />

            {strikes.map(({ entry, range, reason }) => {
              const tone = skillTone(entry.def.hue)
              const cost = entry.castCost ?? 0
              return (
                <EntryRow
                  key={entry.def.id}
                  density="deck"
                  icon={entry.def.icon}
                  iconClass={`${tone.text} opacity-90`}
                  name={entry.def.name}
                  nameTags={<LevelTag level={entry.level} maxLevel={entry.maxLevel} />}
                  subline={
                    <span className="text-[10px] text-fg-muted tabular-nums truncate">{range ? `Hits ${rangeText(range.lo, range.hi)} dmg` : entry.def.formula}</span>
                  }
                  meta={<span className="text-xs font-bold text-resource-mp tabular-nums whitespace-nowrap">{cost} MP</span>}
                  reason={reason}
                  action={
                    <EntryVerb
                      onClick={() => onUseSkill(entry.def.id)}
                      disabled={isActing || outOfAmmo || Boolean(reason)}
                      fillClass={tone.fill}
                      title={reason ?? `${entry.def.name} lvl ${entry.level} — ${entry.def.formula}`}
                      ariaLabel={`Use ${entry.def.name}${reason ? `. ${reason}` : range ? `, ${rangeText(range.lo, range.hi)} damage, ${cost} MP` : ''}`}
                    >
                      Use
                    </EntryVerb>
                  }
                  onOpen={onOpenBook ? () => onOpenBook('skills', entry.def.id) : undefined}
                  bodyAriaLabel={onOpenBook ? `${entry.def.name} — read it in the skill book` : undefined}
                  className={`${ROW_FRAME} ${tone.rail}`}
                />
              )
            })}
          </div>
        )}

        {shownTab === 'items' && (
          <ConsumableDeck
            inventory={inventory}
            hpFull={hpFull}
            mpFull={mpFull}
            disabled={isActing}
            onUse={onUseItem}
            onOpen={onOpenItem}
          />
        )}

        {shownTab === 'spells' && (
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
