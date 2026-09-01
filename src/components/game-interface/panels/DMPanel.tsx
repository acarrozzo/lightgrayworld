'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, SendHorizontal } from 'lucide-react'
import { useGameStore } from '@/lib/game-state'
import { MESSAGE_MAX_LENGTH } from '@/lib/sanitization'
import { useDMStore, type DMThread } from '@/store/dmStore'
import { useColoredAvatar } from '@/hooks/useColoredAvatar'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_AVATAR_COLOR } from '@/lib/constants/avatars'

interface DMPanelProps {
  onClose: () => void
  onMessageSent?: (payload: { message: string; recipientUsername?: string; recipientUserId: string }) => void
}

const formatTimestamp = (timestamp: number): string => {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 60) {
    if (diffMinutes < 1) {
      return 'just now'
    }
    return `${diffMinutes}m ago`
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ThreadAvatar({ thread }: { thread: DMThread }) {
  const iconKey = thread.otherUser.uIcon || DEFAULT_PLAYER_AVATAR
  const iconColor = thread.otherUser.uIconColor || DEFAULT_AVATAR_COLOR
  const avatar = useColoredAvatar(iconKey, iconColor)

  return (
    <div className="flex h-11 w-8 items-center justify-center rounded border border-line-subtle/60 bg-surface-raised/60">
      {avatar ? (
        <div className="h-10 w-7" dangerouslySetInnerHTML={{ __html: avatar }} />
      ) : (
        <span className="text-[10px] text-fg-muted">...</span>
      )}
    </div>
  )
}

export default function DMPanel({ onClose, onMessageSent }: DMPanelProps) {
  const player = useGameStore((s) => s.player)
  const getAuthHeaders = useGameStore((s) => s.getAuthHeaders)
  const {
    threadsByUserId,
    messagesByUserId,
    selectedThreadUserId,
    setThreads,
    setMessages,
    appendMessage,
    markThreadRead,
    setSelectedThread,
    upsertThread,
  } = useDMStore()

  const [composer, setComposer] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingThreads, setIsLoadingThreads] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sortedThreads = useMemo(
    () =>
      Object.values(threadsByUserId).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      ),
    [threadsByUserId]
  )
  const selectedThread = selectedThreadUserId ? threadsByUserId[selectedThreadUserId] : null
  const selectedMessages = selectedThreadUserId ? messagesByUserId[selectedThreadUserId] || [] : []

  useEffect(() => {
    if (!player?.id) return
    setIsLoadingThreads(true)
    setError(null)

    fetch('/api/dm/inbox', {
      method: 'GET',
      headers: getAuthHeaders(),
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error?.message || 'Failed to load inbox')
        }
        const threads = Array.isArray(payload?.threads) ? payload.threads : []
        setThreads(threads)
      })
      .catch((fetchError) => {
        console.error('DM inbox load error:', fetchError)
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load direct messages')
      })
      .finally(() => {
        setIsLoadingThreads(false)
      })
  }, [player?.id, getAuthHeaders, setThreads])

  const loadThread = async (otherUserId: string) => {
    if (!otherUserId) return

    setSelectedThread(otherUserId)
    setIsLoadingMessages(true)
    setError(null)

    try {
      const response = await fetch(`/api/dm/with/${otherUserId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to load thread')
      }
      setMessages(otherUserId, Array.isArray(payload?.messages) ? payload.messages : [])
      markThreadRead(otherUserId)
      if (payload?.otherUser) {
        upsertThread({
          threadId: threadsByUserId[otherUserId]?.threadId,
          otherUser: payload.otherUser,
          lastMessageSnippet: threadsByUserId[otherUserId]?.lastMessageSnippet || '',
          lastMessageAt: threadsByUserId[otherUserId]?.lastMessageAt || new Date().toISOString(),
          unreadCount: 0,
        })
      }
    } catch (loadError) {
      console.error('DM thread load error:', loadError)
      setError(loadError instanceof Error ? loadError.message : 'Failed to load thread')
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const handleSend = async () => {
    const recipientUserId = selectedThreadUserId
    const message = composer.trim()
    if (!player?.id || !recipientUserId || !message || isSending) return

    if (message.length > MESSAGE_MAX_LENGTH) {
      setError(`Message cannot exceed ${MESSAGE_MAX_LENGTH} characters`)
      return
    }

    setIsSending(true)
    setError(null)
    try {
      const response = await fetch('/api/dm/send', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipientUserId,
          message,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error?.message || 'Failed to send direct message')
      }

      appendMessage(payload.directMessage, player.id)
      onMessageSent?.({
        message: payload.directMessage.message,
        recipientUsername: payload.directMessage.recipientUsername,
        recipientUserId: payload.directMessage.recipientId,
      })
      setComposer('')
    } catch (sendError) {
      console.error('DM send error:', sendError)
      setError(sendError instanceof Error ? sendError.message : 'Failed to send direct message')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="relative h-full w-full">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-lg p-2 text-fg-secondary transition-colors duration-200 hover:bg-surface-raised/50 hover:text-fg-bright"
        title="Close"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      <div className="flex h-full flex-col gap-3 p-4 sm:p-5">
        <div className="pr-10">
          <h3 className="text-lg font-semibold text-fg-bright">Direct Messages</h3>
          <p className="mt-1 text-xs text-fg-secondary">Global private messaging with offline delivery.</p>
        </div>

        {error && (
          <div className="rounded-md border border-status-error/60 bg-status-error/40 px-3 py-2 text-xs text-status-error">
            {error}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">
          <div className="min-h-0 overflow-y-auto rounded-lg border border-line-subtle/60 bg-surface-panel/60">
            {isLoadingThreads ? (
              <div className="px-3 py-3 text-xs text-fg-secondary">Loading conversations...</div>
            ) : sortedThreads.length === 0 ? (
              <div className="px-3 py-3 text-xs text-fg-muted">No direct message threads yet.</div>
            ) : (
              <div className="divide-y divide-line-subtle/70">
                {sortedThreads.map((thread) => {
                  const isActive = selectedThreadUserId === thread.otherUser.id
                  return (
                    <button
                      key={thread.otherUser.id}
                      type="button"
                      onClick={() => loadThread(thread.otherUser.id)}
                      className={`w-full px-3 py-2 text-left transition-colors ${
                        isActive ? 'bg-stat-mag/30' : 'hover:bg-surface-raised/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ThreadAvatar thread={thread} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-semibold text-fg-bright">
                              {thread.otherUser.username}
                            </span>
                            {thread.unreadCount > 0 && (
                              <span className="rounded-full fill-stat-mag px-1.5 py-0.5 text-[10px] font-semibold">
                                {thread.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-fg-secondary">{thread.lastMessageSnippet}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-line-subtle/60 bg-surface-panel/40">
            {!selectedThread ? (
              <div className="p-4 text-sm text-fg-secondary">Select a thread to view message history.</div>
            ) : (
              <>
                <div className="border-b border-line-subtle/60 px-3 py-2 text-sm font-medium text-fg-bright">
                  {selectedThread.otherUser.username}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto space-y-2 px-3 py-3">
                  {isLoadingMessages ? (
                    <div className="text-xs text-fg-secondary">Loading messages...</div>
                  ) : selectedMessages.length === 0 ? (
                    <div className="text-xs text-fg-muted">No messages yet. Say hello.</div>
                  ) : (
                    selectedMessages.map((message) => {
                      const isSelf = message.senderId === player?.id
                      const senderLabel = isSelf
                        ? (player?.username || 'You')
                        : (message.senderUsername || selectedThread.otherUser.username || 'Unknown')
                      const timestampLabel = formatTimestamp(new Date(message.createdAt).getTime())
                      return (
                        <div key={message.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                          <div className="flex max-w-[88%] flex-col gap-0.5">
                            <span className={`text-[10px] text-fg-secondary font-mono font-medium ${isSelf ? 'text-right' : ''}`}>
                              {senderLabel}
                            </span>
                            <div
                              className={`rounded-lg px-3 py-2 text-sm ${
                                isSelf
                                  ? 'fill-stat-mag'
                                  : 'border border-line-subtle/70 fill-surface-raised'
                              }`}
                            >
                              <div className="whitespace-pre-wrap break-words">{message.message}</div>
                            </div>
                            <div className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[9px] text-fg-muted/70 whitespace-nowrap tabular-nums font-mono">
                                {timestampLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="border-t border-line-subtle/60 p-2">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      handleSend()
                    }}
                    className="flex items-end gap-2"
                  >
                    <textarea
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      rows={2}
                      maxLength={MESSAGE_MAX_LENGTH}
                      placeholder={`Message ${selectedThread.otherUser.username}...`}
                      className="min-h-[56px] flex-1 resize-y rounded border border-line-subtle fill-surface-canvas px-3 py-2 text-sm outline-none transition-colors focus:border-stat-mag"
                    />
                    <button
                      type="submit"
                      disabled={isSending || !composer.trim()}
                      className="inline-flex h-10 items-center gap-1 rounded fill-stat-mag px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <SendHorizontal size={14} />
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
