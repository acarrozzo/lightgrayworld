export const PLAYER_AVATARS = [
  'char-archer',
  'char-barbarian',
  'char-beastmaster',
  'char-commander',
  'char-darkprince',
  'char-general',
  'char-mage',
  'char-marauder',
  'char-ranger1',
  'char-soldier',
  'char-spearman',
  'char-wanderer',
  'char-wizard',
] as const

export type PlayerAvatar = (typeof PLAYER_AVATARS)[number]

export const DEFAULT_PLAYER_AVATAR: PlayerAvatar = 'char-commander'

const BRIGHT_COLORS = [
  { id: 'blue-bright', name: 'Blue (Bright)', value: '#60a5fa' },
  { id: 'red-bright', name: 'Red (Bright)', value: '#f87171' },
  { id: 'green-bright', name: 'Green (Bright)', value: '#4ade80' },
  { id: 'yellow-bright', name: 'Yellow (Bright)', value: '#facc15' },
  { id: 'purple-bright', name: 'Purple (Bright)', value: '#c084fc' },
  { id: 'pink-bright', name: 'Pink (Bright)', value: '#f472b6' },
  { id: 'orange-bright', name: 'Orange (Bright)', value: '#fb923c' },
  { id: 'cyan-bright', name: 'Cyan (Bright)', value: '#22d3ee' },
  { id: 'indigo-bright', name: 'Indigo (Bright)', value: '#818cf8' },
  { id: 'teal-bright', name: 'Teal (Bright)', value: '#2dd4bf' },
] as const

const MUTED_COLORS = [
  { id: 'blue-deep', name: 'Blue (Deep)', value: '#1e3a8a' },
  { id: 'red-deep', name: 'Red (Deep)', value: '#991b1b' },
  { id: 'green-deep', name: 'Green (Deep)', value: '#166534' },
  { id: 'yellow-deep', name: 'Yellow (Deep)', value: '#854d0e' },
  { id: 'purple-deep', name: 'Purple (Deep)', value: '#5b21b6' },
  { id: 'pink-deep', name: 'Pink (Deep)', value: '#9d174d' },
  { id: 'orange-deep', name: 'Orange (Deep)', value: '#9a3412' },
  { id: 'cyan-deep', name: 'Cyan (Deep)', value: '#155e75' },
  { id: 'indigo-deep', name: 'Indigo (Deep)', value: '#312e81' },
  { id: 'teal-deep', name: 'Teal (Deep)', value: '#115e59' },
] as const

const EARTH_COLORS = [
  { id: 'slate', name: 'Slate', value: '#475569' },
  { id: 'stone', name: 'Stone', value: '#57534e' },
] as const

export const AVATAR_COLORS = [...BRIGHT_COLORS, ...MUTED_COLORS, ...EARTH_COLORS] as const

export type AvatarColorOption = (typeof AVATAR_COLORS)[number]
export type AvatarColorValue = AvatarColorOption['value']

export const DEFAULT_AVATAR_COLOR: AvatarColorValue = '#1e3a8a'

export function getRandomAvatarColor(): AvatarColorValue {
  const index = Math.floor(Math.random() * AVATAR_COLORS.length)
  return AVATAR_COLORS[index]?.value ?? DEFAULT_AVATAR_COLOR
}

export function isValidPlayerAvatar(value: string): value is PlayerAvatar {
  return PLAYER_AVATARS.includes(value as PlayerAvatar)
}

