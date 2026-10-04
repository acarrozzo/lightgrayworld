'use client'

import { ScrollEnd } from '../LayerShell'
import SettingsContent from '@/components/SettingsContent'

interface SettingsPanelProps {
  onLogout: () => void
}

export default function SettingsPanel({
  onLogout,
}: SettingsPanelProps) {
  return (
    <div className="relative w-full h-full">
      <SettingsContent onLogout={onLogout} />
      <ScrollEnd />
    </div>
  )
}

