'use client'

import { useEffect, useMemo, useState } from 'react'
import ActionModal from './ActionModal'
import { useGameStore } from '@/lib/game-state'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'

type PlayerProfileSummary = {
  id: string
  username: string
  level: number
  uIcon?: string | null
  uIconColor?: string | null
}

type PublicProfile = {
  avatar: { uIcon?: string | null; uIconColor?: string | null }
  username: string
  level: number
  characterClass: string
  characterRace: string
  hp: number
  hpMax: number
  mp: number
  mpMax: number
  str: number
  dex: number
  mag: number
  def: number
  currency: number
  equippedItems: Record<string, { name: string; slug?: string; icon?: string }>
}

interface PlayerProfileModalProps {
  isOpen: boolean
  onClose: () => void
  player: PlayerProfileSummary | null
  onInspect: (player: PlayerProfileSummary) => void
  onMessage: (player: PlayerProfileSummary) => void
}

const EQUIPMENT_LABELS: Record<string, string> = {
  rightHand: 'Main Hand',
  leftHand: 'Off Hand',
  head: 'Head',
  body: 'Body',
  hands: 'Hands',
  feet: 'Feet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  neck: 'Neck',
  artifact: 'Artifact',
  tech: 'Tech',
  companion: 'Companion',
  pet: 'Pet',
  mount: 'Mount',
  robot: 'Robot',
  aura: 'Aura',
}

const DISPLAY_SLOT_ORDER = Object.keys(EQUIPMENT_LABELS)

function toPercent(current: number, max: number) {
  if (!max || max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((current / max) * 100)))
}

export default function PlayerProfileModal({
  isOpen,
  onClose,
  player,
  onInspect,
  onMessage,
}: PlayerProfileModalProps) {
  const { getAuthHeaders } = useGameStore()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !player?.id) {
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`/api/users/${player.id}/profile`, {
      method: 'GET',
      headers: getAuthHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load profile')
        }
        return response.json()
      })
      .then((payload) => {
        if (cancelled) return
        setProfile(payload?.profile || null)
      })
      .catch((fetchError) => {
        if (cancelled) return
        console.error('Player profile fetch failed:', fetchError)
        setError('Failed to load public profile.')
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, player?.id, getAuthHeaders])

  const avatarKey = profile?.avatar?.uIcon ?? player?.uIcon ?? DEFAULT_PLAYER_AVATAR
  const avatarColor = profile?.avatar?.uIconColor ?? player?.uIconColor ?? DEFAULT_AVATAR_COLOR
  const coloredAvatar = useColoredAvatar(avatarKey, avatarColor)

  const content = useMemo(() => {
    if (!player) {
      return <div className="text-sm text-gray-400">No player selected.</div>
    }

    if (isLoading) {
      return <div className="text-sm text-gray-300">Loading profile...</div>
    }

    if (error) {
      return <div className="text-sm text-red-300">{error}</div>
    }

    if (!profile) {
      return <div className="text-sm text-gray-400">Profile unavailable.</div>
    }

    return (
      <div className="space-y-5 text-sm text-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-10 items-center justify-center rounded border border-gray-700/70 bg-gray-800/60">
            {coloredAvatar ? (
              <div className="h-14 w-9" dangerouslySetInnerHTML={{ __html: coloredAvatar }} />
            ) : (
              <span className="text-xs text-gray-400">...</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">{profile.username}</div>
            <div className="text-xs uppercase tracking-[0.15em] text-violet-200/80">
              Lvl {profile.level} {profile.characterRace} {profile.characterClass}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border border-gray-700/60 bg-gray-800/50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-red-200">
              <span>HP</span>
              <span>
                {profile.hp}/{profile.hpMax}
              </span>
            </div>
            <div className="h-2 rounded bg-gray-700">
              <div className="h-2 rounded bg-red-500" style={{ width: `${toPercent(profile.hp, profile.hpMax)}%` }} />
            </div>
          </div>
          <div className="rounded border border-gray-700/60 bg-gray-800/50 p-3">
            <div className="mb-1 flex items-center justify-between text-xs text-sky-200">
              <span>MP</span>
              <span>
                {profile.mp}/{profile.mpMax}
              </span>
            </div>
            <div className="h-2 rounded bg-gray-700">
              <div className="h-2 rounded bg-sky-500" style={{ width: `${toPercent(profile.mp, profile.mpMax)}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <div className="rounded border border-gray-700/60 bg-gray-800/50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400">STR</div>
            <div className="text-lg font-semibold text-white">{profile.str}</div>
          </div>
          <div className="rounded border border-gray-700/60 bg-gray-800/50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400">DEX</div>
            <div className="text-lg font-semibold text-white">{profile.dex}</div>
          </div>
          <div className="rounded border border-gray-700/60 bg-gray-800/50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400">MAG</div>
            <div className="text-lg font-semibold text-white">{profile.mag}</div>
          </div>
          <div className="rounded border border-gray-700/60 bg-gray-800/50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400">DEF</div>
            <div className="text-lg font-semibold text-white">{profile.def}</div>
          </div>
          <div className="rounded border border-gray-700/60 bg-gray-800/50 p-2 text-center">
            <div className="text-[10px] uppercase tracking-[0.15em] text-gray-400">Gold</div>
            <div className="text-lg font-semibold text-yellow-300">{profile.currency}</div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs uppercase tracking-[0.15em] text-gray-400">Equipped Items</div>
          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2">
            {DISPLAY_SLOT_ORDER.map((slot) => {
              const equipped = profile.equippedItems?.[slot]
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between rounded border border-gray-700/50 bg-gray-800/40 px-2.5 py-1.5"
                >
                  <span className="text-xs text-gray-400">{EQUIPMENT_LABELS[slot]}</span>
                  <span className="truncate pl-3 text-xs text-gray-200">{equipped?.name || '- - -'}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }, [player, profile, isLoading, error, coloredAvatar])

  return (
    <ActionModal
      isOpen={isOpen}
      onClose={onClose}
      title={player ? `${player.username} Profile` : 'Player Profile'}
      content={content}
      buttons={[
        {
          label: 'Inspect',
          direction: 'inspect-player',
          closeOnAction: true,
        },
        {
          label: 'Message',
          direction: 'message-player',
          closeOnAction: true,
        },
      ]}
      onAction={(direction) => {
        if (!player) return
        if (direction === 'inspect-player') {
          onInspect(player)
          return
        }
        if (direction === 'message-player') {
          onMessage(player)
        }
      }}
    />
  )
}
