'use client'

import { useMemo } from 'react'
import { useGameStore, type BattleState, type InventoryItem, type Player } from '@/lib/game-state'
import { describeStat, effectiveStats, STAT_KEYS, type StatKey } from '@/lib/effective-stats'
import { Stat } from '@/components/GameHeader'
import EnemyTraitTags from '@/components/EnemyTraitTags'
import VitalBar from './VitalBar'
import { LevelBadge, RankBadge, TurnChip } from './battle-badges'

/**
 * The duel at the top of the battle card, under the In Battle strip.
 *
 * You on the left, the enemy on the right, VS and the turn between, as the
 * original's `#uBox` and `#eBox` stood side by side. Each side is drawn the
 * same way: name and level, a fat health bar with its number inside, then the
 * stats in the header's own stacked form — your four, with the one doing the
 * damage boxed in its colour and the one meeting the enemy's blow underlined;
 * the enemy's ATT and DEF, its ATT boxed the same way, in the tone of how it
 * hits (a caster's in MAG blue, an archer's in DEX green).
 *
 * The header above keeps its own HP/MP and a small enemy bar, so the fight
 * shows on every tab; this is the full reading. One drawing at every card
 * width: the bars take the column, the columns are capped so the duel stays
 * gathered around VS on a wide card.
 */

interface BattleDuelProps {
  /** The live battle, or the frozen last frame once it is won. */
  battle: BattleState
  player: Player
  inventory: InventoryItem[]
  weaponCategory: 'MELEE' | 'RANGED' | null
  /** The Turn chip opens the fight's ledger. */
  onOpenLedger?: () => void
  /** Pressing one of your four stats: opens the bag, where the gear behind them is. Left out, they are plain. */
  onOpenStats?: () => void
}

const ENEMY_ATT_TONE: Record<NonNullable<BattleState['enemyDamageType']>, string> = {
  MELEE: 'text-combat-damage',
  RANGED: 'text-stat-dex',
  MAGIC: 'text-stat-mag',
}

const ENEMY_ATT_VAR: Record<NonNullable<BattleState['enemyDamageType']>, string> = {
  MELEE: '--combat-damage',
  RANGED: '--stat-dex',
  MAGIC: '--stat-mag',
}

const ENEMY_HIT_WORD: Record<NonNullable<BattleState['enemyDamageType']>, string> = {
  MELEE: 'melee',
  RANGED: 'ranged',
  MAGIC: 'magic',
}

/** The enemy's number, in the header's stacked form, mirrored to its side. */
function EnemyStat({ label, value, tone, cssVar, emphasis, title }: { label: string; value: number | null; tone: string; cssVar: string; emphasis?: boolean; title?: string }) {
  const style = emphasis
    ? { background: `color-mix(in srgb, var(${cssVar}) 18%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(${cssVar}) 45%, transparent)` }
    : undefined
  return (
    <span className="inline-flex flex-col items-center leading-none rounded px-1 py-0.5 -my-0.5 text-xs" title={title} style={style}>
      <span className={`text-[7px] tracking-wider ${emphasis ? tone : 'text-fg-muted'}`} aria-hidden="true">{label}</span>
      <span className={`tabular-nums ${tone} ${emphasis ? 'font-bold' : ''}`}>{value ?? '—'}</span>
    </span>
  )
}

export default function BattleDuel({ battle, player, inventory, weaponCategory, onOpenLedger, onOpenStats }: BattleDuelProps) {
  // The item under the pointer in the deck: a restorer ghosts onto the bars,
  // a buff puts its "+20" beside the stat it lifts. The deck sets and clears
  // it; the duel only reads it.
  const itemPreview = useGameStore((s) => s.itemPreview)
  const effective = useMemo(() => effectiveStats(player, inventory), [player, inventory])
  const statTitles = useMemo(
    () => ({ str: describeStat('STR', effective.str), dex: describeStat('DEX', effective.dex), mag: describeStat('MAG', effective.mag), def: describeStat('DEF', effective.def) }),
    [effective],
  )
  // The stat the last strike rolled: MAG for a spell, DEX behind a bow, STR
  // for everything else. Before the first strike the weapon in hand decides.
  const attackKey: StatKey = battle.spell ? 'mag' : weaponCategory === 'RANGED' ? 'dex' : 'str'
  // The stat that met the enemy's last blow — DEF against melee, DEX against
  // arrows, MAG against spells (pickPlayerDefensiveStat).
  const defendKey: StatKey = battle.enemyDamageType === 'RANGED' ? 'dex' : battle.enemyDamageType === 'MAGIC' ? 'mag' : 'def'
  const groupPct = battle.multiplayerBonus ? Math.max(0, battle.bonusPercent ?? 0) : 0
  const groupOthers = Math.round(groupPct / 10)
  const groupTitle = `Group bonus: ${groupOthers} other${groupOthers === 1 ? '' : 's'} fighting here, +10% each to your attack and defense rolls`
  const enemyType = battle.enemyDamageType ?? 'MELEE'
  // Won, the card holds the last frame; the frame's HP is the fight's, the
  // live player's may already have moved on.
  const hp = battle.playerHp
  const hpMax = battle.playerHpMax || player.hpMax

  return (
    <div
      className="border-b border-line-subtle/60"
      role="region"
      aria-label={`You ${Math.min(hp, hpMax)} of ${hpMax} HP, ${battle.enemyName ?? 'the enemy'} ${battle.enemyCurrentHp} of ${battle.enemyMaxHp} HP, turn ${battle.turnCount}`}
    >
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-stretch gap-2 px-2.5 py-2 text-xs @min-[600px]:gap-4 @min-[600px]:px-3 @min-[600px]:py-2.5">

          {/* You. The column is capped so the duel stays gathered around VS on a wide screen. */}
          <div className="ml-auto flex w-full max-w-[26rem] min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <LevelBadge level={player.level} />
              <span className="truncate text-xs font-black tracking-tight text-fg-bright @min-[600px]:text-sm">{player.username}</span>
            </div>
            <VitalBar
              kind="hp"
              size="fat"
              self
              current={hp}
              max={hpMax}
              preview={itemPreview?.hp ?? 0}
              extra={itemPreview?.hp ? <span className="text-combat-heal animate-pulse">+{itemPreview.hp}</span> : null}
              className="w-full"
            />
            <VitalBar
              kind="mp"
              size="mid"
              current={player.mp}
              max={player.mpMax}
              preview={itemPreview?.mp ?? 0}
              extra={itemPreview?.mp ? <span className="text-combat-heal animate-pulse">+{itemPreview.mp}</span> : null}
              className="w-full"
            />
            <div className="flex items-center gap-1.5 pt-0.5 @min-[600px]:gap-2.5">
              {STAT_KEYS.map((key) => (
                <Stat
                  key={key}
                  stat={key}
                  value={effective[key].total}
                  title={statTitles?.[key]}
                  bump={itemPreview?.stats?.[key]}
                  emphasis={key === attackKey ? 'attack' : key === defendKey ? 'defend' : undefined}
                  onClick={onOpenStats}
                />
              ))}
            </div>
          </div>

          {/* VS, the turn, and the group bonus when there is one */}
          <div className="flex flex-col items-center justify-center gap-1 px-0.5">
            <span className="text-[10px] font-black tracking-widest text-fg-disabled">VS</span>
            <TurnChip turn={battle.turnCount} onOpen={onOpenLedger} size="sm" />
            {groupPct > 0 && (
              <span className="text-[8px] font-bold tracking-wider text-resource-mp tabular-nums" title={groupTitle}>+{groupPct}%</span>
            )}
          </div>

          {/* The enemy, drawn the same way, mirrored. */}
          <div className="mr-auto flex w-full max-w-[26rem] min-w-0 flex-col items-end gap-1 text-right">
            <div className="flex min-w-0 max-w-full items-center justify-end gap-1.5">
              <span className="truncate text-xs font-black tracking-tight text-fg-bright @min-[600px]:text-sm">{battle.enemyName}</span>
              {battle.enemyLevel !== null && <LevelBadge level={battle.enemyLevel} />}
              {battle.enemyRank && <RankBadge rank={battle.enemyRank} />}
            </div>
            <VitalBar
              kind="foe"
              size="fat"
              rtl
              current={battle.enemyCurrentHp}
              max={battle.enemyMaxHp}
              initialPct={100}
              label={battle.enemyName ? undefined : 'HP'}
              className="w-full"
            />
            <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-x-2.5 gap-y-1 pt-0.5">
              <EnemyTraitTags traits={battle.enemyTraits} activeId={battle.enemyAction?.id} align="end" className="justify-end" />
              <span className="flex items-center gap-1.5 @min-[600px]:gap-2.5">
                <EnemyStat
                  label="ATT"
                  value={battle.enemyAtt}
                  tone={ENEMY_ATT_TONE[enemyType]}
                  cssVar={ENEMY_ATT_VAR[enemyType]}
                  emphasis
                  title={`Attack ${battle.enemyAtt ?? '—'} · hits with ${ENEMY_HIT_WORD[enemyType]}${battle.enemyStrMax !== null ? ` · rolls up to ${battle.enemyStrMax}` : ''}`}
                />
                <EnemyStat label="DEF" value={battle.enemyDef} tone="text-stat-def" cssVar="--stat-def" title={`Defense ${battle.enemyDef ?? '—'}`} />
              </span>
            </div>
          </div>
        </div>
    </div>
  )
}
