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

export const AVATAR_COLORS = [
  { id: 'blue', name: 'Blue', value: '#60a5fa' },
  { id: 'red', name: 'Red', value: '#f87171' },
  { id: 'green', name: 'Green', value: '#4ade80' },
  { id: 'yellow', name: 'Yellow', value: '#facc15' },
  { id: 'purple', name: 'Purple', value: '#c084fc' },
  { id: 'pink', name: 'Pink', value: '#f472b6' },
  { id: 'orange', name: 'Orange', value: '#fb923c' },
  { id: 'cyan', name: 'Cyan', value: '#22d3ee' },
  { id: 'indigo', name: 'Indigo', value: '#818cf8' },
  { id: 'teal', name: 'Teal', value: '#2dd4bf' },
] as const

export type AvatarColorOption = (typeof AVATAR_COLORS)[number]
export type AvatarColorValue = AvatarColorOption['value']

export const DEFAULT_AVATAR_COLOR: AvatarColorValue = '#60a5fa'

export function getRandomAvatarColor(): AvatarColorValue {
  const index = Math.floor(Math.random() * AVATAR_COLORS.length)
  return AVATAR_COLORS[index]?.value ?? DEFAULT_AVATAR_COLOR
}

export function isValidPlayerAvatar(value: string): value is PlayerAvatar {
  return PLAYER_AVATARS.includes(value as PlayerAvatar)
}

