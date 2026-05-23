export type TabColor =
  | 'blue'
  | 'green'
  | 'purple'
  | 'gold'
  | 'red'
  | 'sky'
  | 'gray'
  | 'violet'
  | 'pink'

export function getTabIconColorClass(color: TabColor | string | undefined, isActive: boolean): string {
  const c = color || 'blue'
  if (isActive) {
    switch (c) {
      case 'blue': return 'text-blue-300'
      case 'green': return 'text-green-300'
      case 'purple': return 'text-purple-300'
      case 'gold': return 'text-yellow-300'
      case 'red': return 'text-red-300'
      case 'sky': return 'text-sky-300'
      case 'gray': return 'text-gray-300'
      case 'violet': return 'text-violet-300'
      case 'pink': return 'text-pink-300'
      default: return 'text-blue-300'
    }
  }
  switch (c) {
    case 'blue': return 'text-blue-400'
    case 'green': return 'text-green-400'
    case 'purple': return 'text-purple-400'
    case 'gold': return 'text-yellow-400'
    case 'red': return 'text-red-400'
    case 'sky': return 'text-sky-400'
    case 'gray': return 'text-gray-400'
    case 'violet': return 'text-violet-400'
    case 'pink': return 'text-pink-400'
    default: return 'text-blue-400'
  }
}

export function getTabButtonColorClasses(color: TabColor | string | undefined, isActive: boolean): string {
  const c = color || 'blue'
  if (isActive) {
    switch (c) {
      case 'blue': return 'border-1 border-blue-500 hover:border-blue-400 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300'
      case 'green': return 'border-1 border-green-500 hover:border-green-400 bg-green-500/10 hover:bg-green-500/20 text-green-300'
      case 'purple': return 'border-1 border-purple-500 hover:border-purple-400 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300'
      case 'gold': return 'border-1 border-amber-500 hover:border-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
      case 'red': return 'border-1 border-red-500 hover:border-red-400 bg-red-500/10 hover:bg-red-500/20 text-red-300'
      case 'sky': return 'border-1 border-sky-500 hover:border-sky-400 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300'
      case 'violet': return 'border-1 border-violet-500 hover:border-violet-400 bg-violet-500/10 hover:bg-violet-500/20 text-violet-300'
      case 'pink': return 'border-1 border-pink-500 hover:border-pink-400 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300'
      default: return 'border-1 border-indigo-500 hover:border-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300'
    }
  }
  return 'border-1 border-gray-600 hover:border-gray-500 bg-transparent hover:bg-gray-800/30 text-gray-400 hover:text-gray-300'
}
