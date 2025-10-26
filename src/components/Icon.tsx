'use client'

import React from 'react'
import { IconMappings, type IconName } from '@/lib/icon-mappings'

interface IconProps {
  name: string
  className?: string
  size?: number
  color?: string
  rotation?: number
}

export default function Icon({ name, className = '', size = 24, color = 'currentColor', rotation = 0 }: IconProps) {
  // Get the appropriate color class
  const colorClass = getColorClass(color)
  
  // Validate icon name exists in mappings
  const iconName = IconMappings[name as IconName] || name

  return (
    <svg 
      className={`icon-svg ${colorClass} ${className}`}
      style={{ 
        width: size, 
        height: size,
        transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined
      }}
      fill="currentColor"
      stroke="currentColor"
      viewBox="0 0 100 100"
    >
      <use href={`/sprite-sheet.svg?v=9#${iconName}`} />
    </svg>
  )
}

// Predefined icon mappings for common actions and UI elements
export const Icons = {
  // Chat and UI
  chat: 'question', // Using question mark for chat
  actions: 'inv', // Using inventory for actions/feed
  stats: 'character', // Using character for stats
  inventory: 'inv', // Using inventory icon
  skills: 'attack', // Using attack for skills
  quests: 'inv', // Using inventory for quests
  
  // Actions
  look: 'aim', // Using aim for look
  attack: 'attack', // Using attack icon
  search: 'aim', // Using aim for search
  rest: 'heal', // Using heal for rest
  move: 'arrow-north', // Using arrow for move
  default: 'magic', // Using magic for default
} as const

// Predefined color classes for easy styling
export const IconColors = {
  blue: 'text-blue-500',
  red: 'text-red-500',
  green: 'text-green-500',
  yellow: 'text-yellow-500',
  purple: 'text-purple-500',
  pink: 'text-pink-500',
  orange: 'text-orange-500',
  gray: 'text-gray-500',
  white: 'text-white',
  black: 'text-black',
  current: 'text-current',
} as const

// Helper function to get icon name
export function getIconName(type: string): string {
  return Icons[type as keyof typeof Icons] || Icons.default
}

// Helper function to get color class
export function getColorClass(color: string): string {
  return IconColors[color as keyof typeof IconColors] || IconColors.current
}
