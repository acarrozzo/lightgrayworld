'use client'

interface GameHeaderProps {
  playerName?: string
}

export default function GameHeader({ playerName }: GameHeaderProps) {
  return (
    <header className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/50 px-4 sm:px-6 py-1 shadow-sm">
      <div className="flex w-full items-center justify-center">
        <div className="flex items-center gap-2 text-center">
          <h1 className="text-sm font-medium text-white tracking-tight">Light Gray</h1>
          <span className="text-[10px] text-gray-500 font-normal">v0.1.4</span>
        </div>
      </div>
    </header>
  )
}
