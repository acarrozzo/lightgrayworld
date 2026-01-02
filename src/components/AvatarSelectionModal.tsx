'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  PLAYER_AVATARS,
  DEFAULT_PLAYER_AVATAR,
  PlayerAvatar,
  DEFAULT_AVATAR_COLOR,
} from '@/lib/constants/avatars'
import ColorPicker from './ColorPicker'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'

interface AvatarSelectionModalProps {
  isOpen: boolean
  currentAvatar?: string | null
  currentColor?: string | null
  isSaving?: boolean
  onClose: () => void
  onSelectAvatar: (avatar: PlayerAvatar, color: string) => void
}

function formatAvatarName(avatar: string) {
  return avatar
    .replace('char-', '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

interface AvatarOptionProps {
  avatar: PlayerAvatar
  selectedAvatar: PlayerAvatar
  selectedColor: string
  onSelect: (avatar: PlayerAvatar) => void
}

function AvatarOption({ avatar, selectedAvatar, selectedColor, onSelect }: AvatarOptionProps) {
  const coloredSvg = useColoredAvatar(avatar, selectedColor)
  const isSelected = avatar === selectedAvatar

  return (
    <button
      type="button"
      onClick={() => onSelect(avatar)}
      className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border bg-gray-900/70 px-4 py-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
        isSelected
          ? 'border-indigo-500/80 shadow-lg shadow-indigo-500/20'
          : 'border-gray-800 hover:border-gray-700 hover:bg-gray-900'
      }`}
    >
      <div className="w-24 h-32 flex items-center justify-center overflow-hidden">
        {coloredSvg ? (
          <div
            className="w-20 h-28"
            dangerouslySetInnerHTML={{ __html: coloredSvg }}
          />
        ) : (
          <img
            src={`/img/svg/npc/${avatar}.svg`}
            alt={formatAvatarName(avatar)}
            className={`w-full h-full object-contain ${
              isSelected ? 'opacity-100' : 'opacity-80'
            }`}
            loading="lazy"
          />
        )}
      </div>
      <div className="text-center">
        <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
          {formatAvatarName(avatar)}
        </p>
        {isSelected && (
          <p className="text-xs text-indigo-400 uppercase tracking-wide">
            Selected
          </p>
        )}
      </div>
    </button>
  )
}

export default function AvatarSelectionModal({
  isOpen,
  currentAvatar,
  currentColor,
  isSaving = false,
  onClose,
  onSelectAvatar,
}: AvatarSelectionModalProps) {
  const [mounted, setMounted] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<PlayerAvatar>(
    (currentAvatar as PlayerAvatar) || DEFAULT_PLAYER_AVATAR
  )
  const [selectedColor, setSelectedColor] = useState(currentColor || DEFAULT_AVATAR_COLOR)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setSelectedAvatar((currentAvatar as PlayerAvatar) || DEFAULT_PLAYER_AVATAR)
      setSelectedColor(currentColor || DEFAULT_AVATAR_COLOR)
    }
  }, [isOpen, currentAvatar, currentColor])

  const handleSave = () => {
    if (!isSaving) {
      onSelectAvatar(selectedAvatar, selectedColor)
    }
  }

  if (!mounted || !isOpen) {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-50 p-4 sm:p-6 lg:p-10">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => (!isSaving ? onClose() : null)}
      />
      <div className="relative z-10 h-full w-full bg-gray-900/95 border border-gray-800/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-800/70">
          <div>
            <h3 className="text-2xl font-semibold text-white">Customize Your Avatar</h3>
            <p className="text-sm text-gray-400 mt-1">
              Choose a character and color that matches your vibe.
            </p>
          </div>
          <button
            onClick={() => (!isSaving ? onClose() : null)}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800/70"
            disabled={isSaving}
          >
            <span className="sr-only">Close</span>
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-indigo-300/80 mb-1">Current</p>
                <h4 className="text-2xl font-semibold text-white">{formatAvatarName(selectedAvatar)}</h4>
              </div>
              <div className="text-sm text-gray-300">
                <p className="uppercase text-gray-400 tracking-widest">Color</p>
                <p className="font-semibold text-white">{selectedColor}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-3">Palette</p>
              <ColorPicker
                selectedColor={selectedColor}
                onSelectColor={setSelectedColor}
              />
            </div>
          </div>

          <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Avatars</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {PLAYER_AVATARS.map((avatar) => (
                <AvatarOption
                  key={avatar}
                  avatar={avatar}
                  selectedAvatar={selectedAvatar}
                  selectedColor={selectedColor}
                  onSelect={setSelectedAvatar}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-8 py-6 border-t border-gray-800/70">
          <button
            type="button"
            onClick={() => (!isSaving ? onClose() : null)}
            className="px-4 py-2 rounded-full text-sm font-semibold text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Avatar'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

