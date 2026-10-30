import type { BattleState, InventoryItem, Player } from '@/lib/game-state'
import type { CastSituation } from '@/lib/spellbook'
import { castBlockedReason, effectiveMag, getCastableSpells } from '@/lib/spellbook'
import { gearContextFromInventory, getStrikeSkills, previewSkillBonus, weaponFits, type SkillbookEntry } from '@/lib/skillbook'
import { effectiveStats } from '@/lib/effective-stats'
import { playerCanFly } from '@/lib/status-effects'
import { resolveItemIcon } from '@/lib/item-actions'

/**
 * The rules behind the action deck's strike row — Attack and the power
 * attacks beside it — in one place, so the battle deck and the Actions tab
 * print the same range and the same refusal for the same situation. Pure: nothing here decides an outcome, the server
 * does; this only says what the server would say, before the tap.
 */

/** What a swing is up against: the enemy's flags, from the fight or from the room. */
export interface DeckTarget {
  name: string
  def: number | null
  flying: boolean
  immuneMelee: boolean
  immuneRanged: boolean
  immuneMagic: boolean
}

export interface StrikeRowContext {
  player: Player
  inventory: InventoryItem[]
  isRanged: boolean
  /** The top of the plain swing: the stat the weapon rolls, group bonus folded in. */
  swingMax: number
  /** 1 out of a fight; 1 + bonusPercent/100 in one. Lifts Magic Strike's MAG roll. */
  groupScale: number
  playerMp: number
  inBattle: boolean
  /** null when there is nothing in the room to hit. */
  target: DeckTarget | null
  /**
   * The room rolls encounters: with nothing to hit, Attack and the strikes
   * hunt — spend the turn drawing something out — instead of being refused.
   */
  canHunt?: boolean
}

export interface StrikeRowEntry {
  entry: SkillbookEntry
  /** Total roll range, swing included; null when the strike cannot land at all. */
  range: { lo: number; hi: number } | null
  reason: string | null
  cost: number
}

/** Why a plain Attack has no range against this target, or null when it does. */
export function attackBlockedBy(ctx: Pick<StrikeRowContext, 'player' | 'inventory' | 'isRanged' | 'target' | 'canHunt'>): string | null {
  if (!ctx.target) return ctx.canHunt ? null : 'Nothing to hit'
  const immuneToWeapon = ctx.isRanged ? ctx.target.immuneRanged : ctx.target.immuneMelee
  if (immuneToWeapon) return "Can't hurt it"
  // A bare melee swing cannot reach something airborne unless the player is
  // airborne too (wings, or a flying mount) — the original's rule.
  if (ctx.target.flying && !ctx.isRanged && !playerCanFly(ctx.player, ctx.inventory)) return "Can't reach"
  return null
}

/**
 * The strikes the weapon in hand can carry, with what each can roll and why
 * it is refused. Slice wants one hand, Smash two, Aim a ranged weapon, Magic
 * Strike anything; the rest stay in the book. The server drops a strike whose
 * bonus cannot land before charging MP, so a refused strike costs nothing.
 */
export function buildStrikeRow(ctx: StrikeRowContext): StrikeRowEntry[] {
  const gear = gearContextFromInventory(ctx.inventory)
  const blocked = attackBlockedBy(ctx)
  const immuneToMagic = ctx.target?.immuneMagic ?? false
  return getStrikeSkills(ctx.player)
    .filter((entry) => weaponFits(entry.def, gear))
    .map((entry) => {
      // Magic Strike scales with MAG, which the group bonus also lifts.
      const bonus = entry.def.magic && ctx.groupScale > 1
        ? previewSkillBonus(entry.def, Math.max(1, entry.level), Math.floor(effectiveMag(ctx.player) * ctx.groupScale))
        : entry.preview
      const cost = entry.castCost ?? 0
      const reason =
        blocked ? blocked
        : entry.def.magic && immuneToMagic ? 'Magic fizzles'
        : ctx.playerMp < cost ? 'Not enough MP'
        : null
      const range = bonus && !blocked
        ? { lo: bonus.min, hi: Math.max(0, ctx.swingMax) + bonus.max }
        : null
      return { entry, range, reason, cost }
    })
}

/** A damage range as the deck prints it: the raw roll, before the enemy blocks. */
export function rangeText(lo: number, hi: number): string {
  return `${Math.max(0, lo)}–${Math.max(0, hi)}`
}

/** Turn a slug ("goblin-cloak") into a readable label ("Goblin Cloak"). */
export function prettifyDropName(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Ammo the equipped weapon spends, counted from the live bag. */
export function ammoFor(weapon: InventoryItem | null | undefined, inventory: InventoryItem[]): { slug: string; remaining: number; label: string } | null {
  const meta = (weapon?.template.metadata ?? null) as { ammo?: unknown } | null
  const slug = typeof meta?.ammo === 'string' ? meta.ammo : null
  if (!slug) return null
  const stack = inventory.find((item) => item.template.slug === slug) ?? null
  return {
    slug,
    remaining: stack?.quantity ?? 0,
    label: (stack?.template.name ?? prettifyDropName(slug)).toLowerCase(),
  }
}

/** The main-hand weapon and how the deck names and draws it. */
export function weaponInHand(inventory: InventoryItem[]): { weapon: InventoryItem | null; iconName: string; name: string | null; isRanged: boolean } {
  const weapon = inventory.find((item) => item.isEquipped && item.slot === 'MAIN_HAND') ?? null
  return {
    weapon,
    iconName: weapon ? resolveItemIcon(weapon.template.metadata as { icon?: string } | null, weapon.template.slug ?? '') : 'equipment-fists',
    name: weapon?.template.name ?? null,
    isRanged: weapon?.template.weaponCategory === 'RANGED',
  }
}

/** The enemy in a running fight, from the traits the server sends. */
export function targetFromBattle(battle: BattleState): DeckTarget {
  const has = (id: string) => battle.enemyTraits.some((trait) => trait.id === id)
  return {
    name: battle.enemyName ?? 'enemy',
    def: battle.enemyDef ?? null,
    flying: has('flying'),
    immuneMelee: has('immune-melee'),
    immuneRanged: has('immune-ranged'),
    immuneMagic: has('immune-magic'),
  }
}

/** The room's present enemy, before a fight, or null with nothing to hit. */
export function targetFromRoomEnemy(enemy: { name: string; def?: number | null; isFlying?: boolean; isMeleeImmune?: boolean; isRangedImmune?: boolean; isMagicImmune?: boolean } | null | undefined): DeckTarget | null {
  if (!enemy) return null
  return {
    name: enemy.name,
    def: enemy.def ?? null,
    flying: Boolean(enemy.isFlying),
    immuneMelee: Boolean(enemy.isMeleeImmune),
    immuneRanged: Boolean(enemy.isRangedImmune),
    immuneMagic: Boolean(enemy.isMagicImmune),
  }
}

/** Everything the deck needs to draw, for one place. */
export interface DeckContext {
  situation: CastSituation
  target: DeckTarget | null
  isRanged: boolean
  swingMax: number
  groupScale: number
}

/** The deck as a running fight sees it. */
export function deckContextFromBattle(battle: BattleState, player: Player, inventory: InventoryItem[]): DeckContext {
  const { isRanged } = weaponInHand(inventory)
  const groupScale = 1 + (battle.bonusPercent ?? 0) / 100
  // The server sends the top of the swing at battle start and after every
  // turn; the client formula covers the gap on a fresh hydration. After a
  // spell that number is the MAG the spell rolled, not the weapon's.
  const serverSwing = battle.spell ? null : battle.playerStrMax
  const swingMax = serverSwing ?? Math.floor(effectiveStats(player, inventory)[isRanged ? 'dex' : 'str'].total * groupScale)
  return {
    situation: { inBattle: true, hasTarget: true, mp: player.mp ?? 0, hp: battle.playerHp, hpMax: battle.playerHpMax, buffs: player.buffs },
    target: targetFromBattle(battle),
    isRanged,
    swingMax,
    groupScale,
  }
}

/**
 * The deck as the compass sees it: the present enemy, if any, and your own
 * stats. `canHunt` is the room's word that it rolls encounters, so an empty
 * room keeps Attack live as a hunt.
 */
export function deckContextFromRoom(
  enemy: Parameters<typeof targetFromRoomEnemy>[0],
  player: Player,
  inventory: InventoryItem[],
  { canHunt = false }: { canHunt?: boolean } = {}
): DeckContext {
  const { isRanged } = weaponInHand(inventory)
  const target = targetFromRoomEnemy(enemy)
  return {
    situation: { inBattle: false, hasTarget: target !== null, canHunt, mp: player.mp ?? 0, hp: player.hp ?? 0, hpMax: player.hpMax ?? 0, buffs: player.buffs },
    target,
    isRanged,
    swingMax: effectiveStats(player, inventory)[isRanged ? 'dex' : 'str'].total,
    groupScale: 1,
  }
}

/** One line of the Explore Attack menu: the plain swing, a strike, or an attack spell. */
export interface AttackMenuRow {
  kind: 'attack' | 'strike' | 'spell'
  /** `attack`, or the skill's or the spell's id. */
  id: string
  name: string
  icon: string
  /** The skill's or spell's decorative hue; null for the plain swing, which wears its stat. */
  hue: string | null
  level: number | null
  maxLevel: number | null
  /** What it rolls before the enemy blocks; null when it cannot land. */
  range: { lo: number; hi: number } | null
  /** The weapon in hand, on the plain swing's line. */
  weapon?: string
  /** Something a landed hit leaves behind: Poison Dart's poison. */
  leaves?: string
  /** MP, or null for the plain swing. */
  cost: number | null
  reason: string | null
}

/**
 * Everything that hits, for the menu under Attack's chevron: the swing, the
 * strikes the weapon in hand carries, then the attack spells. The rows are
 * the Actions tab's — the same ranges and the same refusals, from
 * buildStrikeRow and castBlockedReason — gathered into one list. A weapon out
 * of ammo refuses the swing and the strikes, as the deck does.
 */
export function buildAttackMenu({ player, inventory, context }: { player: Player; inventory: InventoryItem[]; context: DeckContext }): AttackMenuRow[] {
  const { situation, target, isRanged, swingMax, groupScale } = context
  const canHunt = situation.canHunt ?? false
  const { weapon, iconName, name: weaponName } = weaponInHand(inventory)
  const ammo = ammoFor(weapon, inventory)
  const noAmmo = ammo !== null && ammo.remaining <= 0 ? `No ${ammo.label}` : null
  const blocked = attackBlockedBy({ player, inventory, isRanged, target, canHunt })

  const swing: AttackMenuRow = {
    kind: 'attack',
    id: 'attack',
    name: 'Attack',
    icon: iconName,
    hue: null,
    level: null,
    maxLevel: null,
    range: blocked || noAmmo ? null : { lo: 0, hi: Math.max(0, swingMax) },
    weapon: weaponName ?? 'Fists',
    cost: null,
    reason: noAmmo ?? blocked,
  }

  const strikes: AttackMenuRow[] = buildStrikeRow({
    player, inventory, isRanged, swingMax, groupScale, playerMp: situation.mp, inBattle: situation.inBattle, target, canHunt,
  }).map(({ entry, range, reason, cost }) => ({
    kind: 'strike',
    id: entry.def.id,
    name: entry.def.name,
    icon: entry.def.icon,
    hue: entry.def.hue,
    level: entry.level,
    maxLevel: entry.maxLevel,
    range,
    cost,
    reason: reason ?? noAmmo,
  }))

  const spells: AttackMenuRow[] = getCastableSpells(player)
    .filter((entry) => entry.def.kind === 'attack')
    .map((entry) => ({
      kind: 'spell',
      id: entry.def.id,
      name: entry.def.name,
      icon: entry.def.icon,
      hue: entry.def.hue,
      level: entry.level,
      maxLevel: entry.maxLevel,
      range: entry.preview ? { lo: entry.preview.min, hi: entry.preview.max } : null,
      leaves: entry.def.dot ? 'poison' : undefined,
      cost: entry.castCost,
      reason: castBlockedReason(entry, situation),
    }))

  return [swing, ...strikes, ...spells]
}
