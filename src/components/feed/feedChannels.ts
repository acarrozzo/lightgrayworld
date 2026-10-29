import { Globe, MessageSquare, Users, Sparkles, Footprints, type LucideIcon } from 'lucide-react'

/**
 * The feed's one legend: a channel is who is speaking and where, and it has
 * one colour wherever it appears — the row bar, the filter chip, the mode
 * glyph in the composer, and the activity ticker. The colours are the
 * theme's `channel.*` roles (src/lib/theme), so every theme places them.
 *
 * Tailwind reads class names from source, so every class here is a literal.
 */

export type InputMode = 'action' | 'room' | 'world' | 'party'
export type FeedChannel = InputMode | 'events' | 'dm'

export type ChannelStyle = {
  /** Text colour. */
  text: string
  /** The row's left bar. */
  bar: string
  /** An active chip: border, tint, text. */
  chip: string
  /** The composer glyph. */
  glyph: string
}

export const CHANNEL_STYLES: Record<FeedChannel, ChannelStyle> = {
  world: {
    text: 'text-channel-world',
    bar: 'bg-channel-world',
    chip: 'border-channel-world bg-channel-world/10 hover:bg-channel-world/20 text-channel-world',
    glyph: 'text-channel-world',
  },
  room: {
    text: 'text-channel-room',
    bar: 'bg-channel-room',
    chip: 'border-channel-room bg-channel-room/10 hover:bg-channel-room/20 text-channel-room',
    glyph: 'text-channel-room',
  },
  party: {
    text: 'text-channel-party',
    bar: 'bg-channel-party',
    chip: 'border-channel-party bg-channel-party/10 hover:bg-channel-party/20 text-channel-party',
    glyph: 'text-channel-party',
  },
  action: {
    text: 'text-channel-action',
    bar: 'bg-channel-action',
    chip: 'border-channel-action bg-channel-action/10 hover:bg-channel-action/20 text-channel-action',
    glyph: 'text-channel-action',
  },
  events: {
    text: 'text-channel-system',
    bar: 'bg-channel-system',
    chip: 'border-channel-system bg-channel-system/10 hover:bg-channel-system/20 text-channel-system',
    glyph: 'text-channel-system',
  },
  dm: {
    text: 'text-channel-dm',
    bar: 'bg-channel-dm',
    chip: 'border-channel-dm bg-channel-dm/10 hover:bg-channel-dm/20 text-channel-dm',
    glyph: 'text-channel-dm',
  },
}

/** A neutral active chip (the All filter). */
export const NEUTRAL_CHIP = 'border-fg-secondary bg-fg-secondary/10 hover:bg-fg-secondary/20 text-fg-bright'
/** An inactive chip. */
export const IDLE_CHIP = 'border-line-strong/80 hover:border-line-strong bg-transparent hover:bg-surface-raised/30 text-fg-secondary hover:text-fg-primary'

export type ModeMeta = {
  mode: InputMode
  label: string
  /** One word for the menu: who hears it. */
  hint: string
  placeholder: string
  icon: LucideIcon
  /** Slash prefixes that switch to this mode while typing. */
  aliases: string[]
}

/** Menu order: the three ways to speak, then the one way to act. */
export const MODES: ModeMeta[] = [
  { mode: 'world', label: 'World Chat', hint: 'everyone', placeholder: 'Shout something...', icon: Globe, aliases: ['w', 'world'] },
  { mode: 'room', label: 'Room Chat', hint: 'this room', placeholder: 'Say something...', icon: MessageSquare, aliases: ['r', 'room'] },
  { mode: 'party', label: 'Party', hint: 'your party', placeholder: 'Tell the party...', icon: Users, aliases: ['p', 'party'] },
  { mode: 'action', label: 'Action', hint: 'type a command', placeholder: 'Enter action...', icon: Sparkles, aliases: ['a', 'act', 'action'] },
]

export const MODE_META: Record<InputMode, ModeMeta> = Object.fromEntries(MODES.map((m) => [m.mode, m])) as Record<InputMode, ModeMeta>

export const isInputMode = (value: unknown): value is InputMode =>
  value === 'action' || value === 'room' || value === 'world' || value === 'party'

/** Tab in the composer: the next mode round the menu. */
export const nextMode = (mode: InputMode): InputMode => {
  const i = MODES.findIndex((m) => m.mode === mode)
  return MODES[(i + 1) % MODES.length].mode
}

const ALIAS_TO_MODE: Record<string, InputMode> = Object.fromEntries(
  MODES.flatMap((m) => m.aliases.map((a) => [a, m.mode])),
)

/**
 * A slash prefix at the start of the input switches the mode and is removed
 * from what the player is typing. The prefix only counts once a space (or the
 * end, on submit) follows it, so `/rest` is never mistaken for `/r est`.
 *
 * @param value what is in the input
 * @param atSubmit the player pressed Enter: a bare `/r` with nothing after it
 *   also counts
 */
export const parseSlashPrefix = (
  value: string,
  atSubmit = false,
): { mode: InputMode; rest: string } | null => {
  const match = /^\/([a-z]+)(\s|$)/i.exec(value)
  if (!match) return null
  const mode = ALIAS_TO_MODE[match[1].toLowerCase()]
  if (!mode) return null
  const terminated = match[2] !== ''
  if (!terminated && !atSubmit) return null
  return { mode, rest: value.slice(match[0].length) }
}

/** The filter and the composer shake hands: a chat sub-filter per speaking mode. */
export type ChatSubFilter = 'all-chat' | 'world-chat' | 'room-chat' | 'party-chat'

export const chatSubFilterForMode = (mode: InputMode): ChatSubFilter | null => {
  if (mode === 'world') return 'world-chat'
  if (mode === 'room') return 'room-chat'
  if (mode === 'party') return 'party-chat'
  return null
}

export const modeForChatSubFilter = (sub: ChatSubFilter): InputMode | null => {
  if (sub === 'world-chat') return 'world'
  if (sub === 'room-chat') return 'room'
  if (sub === 'party-chat') return 'party'
  return null
}

/** Which channel a feed entry speaks on, for the row's colour and a reply tap. */
export const channelOfEntry = (entry: { type: string; eventType?: string }): FeedChannel => {
  if (entry.type === 'party') return 'party'
  if (entry.type === 'dm') return 'dm'
  if (entry.type === 'action') return 'action'
  if (entry.eventType) {
    const travel = entry.eventType === 'room-enter' || entry.eventType === 'room-exit' || entry.eventType === 'room-travel'
    return travel ? 'action' : 'events'
  }
  return entry.type === 'world' ? 'world' : 'room'
}

export const EVENTS_ICON: LucideIcon = Footprints
