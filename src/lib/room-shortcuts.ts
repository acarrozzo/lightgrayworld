import { QUESTS } from '@/lib/game-data/quest-registry'
import { getFaction } from '@/lib/game-data/factions'
import { areRequirementsMet, type QuestRequirement, type RequirementContext } from '@/lib/quest-requirements'
import {
  classifyRoomAction,
  getRoomActions,
  isShortcutAction,
  type RoomAction,
  type RoomActionKind,
} from '@/lib/room-actions'
import type { GatherCooldownView } from '@/lib/types/room'
import type { InventoryItem, KillEntry, Player, QuestProgressRow } from '@/lib/game-state'

/**
 * The room's primary actions as a short rail of chips beside the D-pad — the
 * original nav's top-right badge column, derived instead of hand-listed.
 *
 * Pure: everything here is read from the room payload, the store's quests and
 * inventory, and the authored room-action table. A chip fires exactly what the
 * room card's own button fires; the server still decides cooldowns, turn cost,
 * provocation and refusals. The chip only knows enough to dim and to draw a
 * count bubble.
 */

/** How many chips the rail shows before folding the rest behind "+N in room". */
export const ROOM_SHORTCUT_CAP = 5

export type ShortcutTone = 'ready' | 'info' | 'wait'

export interface ShortcutBubble {
  text: string
  tone: ShortcutTone
  title: string
}

export interface RoomShortcut {
  key: string
  kind: RoomActionKind | 'attack'
  label: string
  /** An Icon name, or null for a chip with no glyph. */
  icon: string | null
  /** The `fill-*` role the chip wears: the action's own, as on the room card. */
  fillClass: string
  bubble: ShortcutBubble | null
  /** The server would refuse it right now (still on cooldown, already fighting). */
  disabled: boolean
  /** Still clickable, but nothing new will happen (an opened chest). */
  muted: boolean
  reason: string | null
  fire: string | { type: string; data?: Record<string, unknown> }
}

export interface RoomShortcutEnemy {
  slug: string
  name: string
  level: number
}

export interface RoomShortcutInput {
  roomId: string
  enemy: RoomShortcutEnemy | null
  isInBattle: boolean
  gatherCooldowns: GatherCooldownView[]
  /** Live seconds left per gather action when the caller ticks them; the table's own figure otherwise. */
  gatherRemaining?: Record<string, number>
  inventory: InventoryItem[]
  quests: QuestProgressRow[]
  killList: KillEntry[]
  player: Player | null
  giversMet: string[]
  goldChestOpened: boolean
}

export interface RoomShortcutRail {
  shortcuts: RoomShortcut[]
  /** Primary actions that did not fit under the cap. */
  hidden: number
}

const KIND_FILL: Record<RoomActionKind, string> = {
  npc: 'fill-action-talk',
  shop: 'fill-mood-treasure',
  harvest: 'fill-action-gather',
  chest: 'fill-mood-treasure',
  craft: 'fill-action-craft',
  rest: 'fill-action-rest',
  other: 'fill-surface-raised',
}

/** "4m", "38s", "2h": the short form a 16px bubble can hold. */
export function formatShortCountdown(seconds: number): string {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)}h`
  if (seconds >= 60) return `${Math.ceil(seconds / 60)}m`
  return `${Math.max(1, Math.ceil(seconds))}s`
}

type QuestDefLite = { requirements?: QuestRequirement[] }

/** Open quests for one giver: how many are ready to turn in, and how many are open at all. */
function questCounts(questIds: string[], quests: QuestProgressRow[], ctx: RequirementContext): { ready: number; open: number } {
  let ready = 0
  let open = 0
  for (const questId of questIds) {
    const def = (QUESTS as Record<string, QuestDefLite>)[questId]
    if (!def) continue
    const progress = quests.find((q) => q.questId === questId)
    if (!progress || progress.completed) continue
    open += 1
    if ((def.requirements ?? []).length > 0 && areRequirementsMet(def.requirements, ctx)) ready += 1
  }
  return { ready, open }
}

/** The room's actions the player may see, the same membership filter the room card applies. */
export function visibleRoomActions(roomId: string, quests: QuestProgressRow[]): RoomAction[] {
  return getRoomActions(roomId).filter((a) => {
    if (!a.requiresMembership) return true
    const membershipQuest = getFaction(a.requiresMembership)?.membershipQuest
    return !!membershipQuest && quests.some((q) => q.questId === membershipQuest && q.completed)
  })
}

/** Rail order: the fight, then NPCs with something ready, shops and crafting, harvests, the rest. */
function rank(kind: RoomShortcut['kind'], bubble: ShortcutBubble | null): number {
  switch (kind) {
    case 'attack': return 0
    case 'npc': return bubble?.tone === 'ready' ? 1 : 4
    case 'shop':
    case 'craft': return 2
    case 'harvest': return 3
    case 'chest':
    case 'rest': return 5
    default: return 6
  }
}

export function buildRoomShortcuts(input: RoomShortcutInput): RoomShortcutRail {
  const { roomId, enemy, isInBattle, gatherCooldowns, gatherRemaining, inventory, quests, killList, player, giversMet, goldChestOpened } = input
  const gatherByAction = new Map(gatherCooldowns.map((g) => [g.action, g] as const))
  const gatherActions = new Set(gatherCooldowns.map((g) => g.action))
  const heldSlugs = new Set(inventory.map((item) => item.template.slug))
  const ctx: RequirementContext = { inventory, killList, player, quests, giversMet } as RequirementContext

  const all: Array<{ shortcut: RoomShortcut; order: number }> = []

  if (enemy) {
    all.push({
      order: -1,
      shortcut: {
        key: `attack:${enemy.slug}`,
        kind: 'attack',
        label: `Attack ${enemy.name}`,
        icon: null,
        fillClass: 'fill-action-attack',
        bubble: { text: String(enemy.level), tone: 'info', title: `Level ${enemy.level}` },
        disabled: isInBattle,
        muted: false,
        reason: isInBattle ? 'Already fighting' : null,
        fire: { type: 'start_battle', data: { enemySlug: enemy.slug } },
      },
    })
  }

  visibleRoomActions(roomId, quests).forEach((action, index) => {
    const kind = classifyRoomAction(action, gatherActions)
    if (!isShortcutAction(action, kind)) return

    let bubble: ShortcutBubble | null = null
    let disabled = false
    let muted = false
    let reason: string | null = null

    if (kind === 'npc') {
      const { ready, open } = questCounts(action.questIds ?? [], quests, ctx)
      if (ready > 0) bubble = { text: String(ready), tone: 'ready', title: `${ready} quest${ready === 1 ? '' : 's'} ready to turn in` }
      else if (open > 0) bubble = { text: String(open), tone: 'info', title: `${open} open quest${open === 1 ? '' : 's'}` }
    } else if (kind === 'harvest') {
      const info = gatherByAction.get(action.action)
      const secondsLeft = gatherRemaining?.[action.action] ?? info?.secondsRemaining ?? 0
      if (secondsLeft > 0) {
        bubble = { text: formatShortCountdown(secondsLeft), tone: 'wait', title: 'Regrowing' }
        disabled = true
        reason = 'Regrowing'
      } else if (info) {
        const tier = info.toolTiers?.find((t) => heldSlugs.has(t.slug)) ?? null
        const hasTool = info.toolTiers ? tier !== null : info.toolRequired ? heldSlugs.has(info.toolRequired) : true
        const yieldCount = tier?.quantity ?? info.quantity ?? null
        if (!hasTool) {
          const toolName = info.toolRequired ?? info.toolTiers?.[info.toolTiers.length - 1]?.label ?? 'a tool'
          reason = `Needs ${toolName}`
          muted = true
        } else if (yieldCount != null) {
          bubble = { text: String(yieldCount), tone: 'info', title: `${yieldCount} ${info.itemNamePlural ?? ''} a swing`.trim() }
        }
      }
    } else if (kind === 'chest' && action.action === 'open gold chest' && goldChestOpened) {
      muted = true
      reason = 'Already opened'
    }

    all.push({
      order: index,
      shortcut: {
        key: `room:${action.action}`,
        kind,
        label: action.label,
        icon: action.icon || null,
        fillClass: action.className ?? KIND_FILL[kind],
        bubble,
        disabled,
        muted,
        reason,
        fire: action.action,
      },
    })
  })

  all.sort((a, b) => {
    const byRank = rank(a.shortcut.kind, a.shortcut.bubble) - rank(b.shortcut.kind, b.shortcut.bubble)
    return byRank !== 0 ? byRank : a.order - b.order
  })

  const shortcuts = all.slice(0, ROOM_SHORTCUT_CAP).map((entry) => entry.shortcut)
  return { shortcuts, hidden: Math.max(0, all.length - shortcuts.length) }
}
