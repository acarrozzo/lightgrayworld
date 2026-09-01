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
  // Validate icon name exists in mappings
  const iconName = IconMappings[name as IconName] || name
  
  // Parse className for opacity modifiers (e.g., /70, /50)
  // Tailwind opacity modifiers don't work with SVG fill="currentColor", so we need to extract and apply separately
  let processedClassName = className
  let fillOpacity: number | undefined = undefined
  
  // Match opacity modifier at the end of a class (e.g., text-fg-muted/70 or gray-500/70)
  const opacityMatch = className.match(/\/(\d+)(?:\s|$)/)
  if (opacityMatch) {
    const opacityValue = parseInt(opacityMatch[1])
    if (opacityValue >= 0 && opacityValue <= 100) {
      fillOpacity = opacityValue / 100
      // Remove the opacity modifier from className to avoid conflicts
      processedClassName = className.replace(/\/(\d+)(?=\s|$)/g, '').trim()
    }
  }
  
  // Check if processedClassName contains a text color class (e.g., text-*)
  // If so, use that instead of the default colorClass
  const hasTextColorClass = /\btext-[\w-]+/.test(processedClassName)
  const colorClass = hasTextColorClass ? '' : getColorClass(color)
  
  // Check if className contains width or height utilities (e.g., w-*, h-*)
  // If so, don't apply inline width/height styles to allow responsive classes to work
  const hasSizeClasses = /\b(w-|h-|width|height)/.test(processedClassName)
  
  const style: React.CSSProperties = {
    transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined
  }
  
  // Apply fill-opacity if opacity modifier was detected
  if (fillOpacity !== undefined) {
    style.fillOpacity = fillOpacity
  }
  
  // Only apply inline width/height if no size classes are present
  if (!hasSizeClasses) {
    style.width = size
    style.height = size
  }

  return (
    <svg 
      className={`icon-svg ${colorClass} ${processedClassName}`.trim()}
      style={style}
      fill="currentColor"
      preserveAspectRatio="xMidYMid meet"
    >
      <use href={`/sprite-sheet.svg?v=10#${iconName}`} />
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
  blue: 'text-resource-mp',
  red: 'text-status-error',
  green: 'text-status-success',
  yellow: 'text-status-warning',
  purple: 'text-stat-mag',
  pink: 'text-hue-pink',
  violet: 'text-stat-mag',
  orange: 'text-action-attack',
  gray: 'text-fg-muted',
  white: 'text-fg-bright',
  black: 'text-fg-on-accent',
  sky: 'text-status-info',
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
