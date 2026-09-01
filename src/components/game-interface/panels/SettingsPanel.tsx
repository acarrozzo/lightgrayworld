'use client'

import { X } from 'lucide-react'
import SettingsContent from '@/components/SettingsContent'

interface SettingsPanelProps {
  onLogout: () => void
  onClose: () => void
}

export default function SettingsPanel({
  onLogout,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="relative w-full h-full">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 text-fg-secondary hover:text-fg-bright transition-colors duration-200 rounded-lg hover:bg-surface-raised/50"
        title="Close"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <SettingsContent onLogout={onLogout} />
    </div>
  )
}

