'use client'

import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/lib/game-state'
import Icon from './Icon'

interface NPCListItem {
  instanceId: string
  npcId: string
  definitionId?: string | null
  roomId: string
  state: string
  hp: number
  hpMax: number
  targetId?: string | null
  metadata: Record<string, any>
  cooldowns: Record<string, any>
  threat: Array<{ playerId: string; threat: number }>
  config: {
    npcId: string
    roomKey: string
    maxAlive: number
    respawnSeconds: number
    leashDistance: number
    leashTimeMs: number
    persistent: boolean
    services: string[]
  } | null
  npc: {
    id: string
    name: string
    type?: string
    disposition?: string
    canBeAttacked?: boolean
    roomId?: string
    definitionId?: string
  } | null
}

interface NPCDetailResponse {
  instanceId: string
  runtime: NPCListItem
  config: NPCListItem['config']
  npc: NPCListItem['npc']
}

interface SpawnConfigSummary {
  npcId: string
  name: string
  description?: string
  disposition?: string
  canBeAttacked?: boolean
  roomId: string
  persistent: boolean
  maxAlive: number
  services: string[]
}

export default function AdminNPCPanel() {
  const { getAuthHeaders, player, isLoggedIn } = useGameStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [npcItems, setNpcItems] = useState<NPCListItem[]>([])
  const [configs, setConfigs] = useState<SpawnConfigSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<NPCDetailResponse | null>(null)
  const [filters, setFilters] = useState<{ roomId: string; state: string }>({
    roomId: '',
    state: '',
  })
  const [spawnNpcId, setSpawnNpcId] = useState<string>('')
  const [spawnCount, setSpawnCount] = useState<number>(1)
  const [spawnMessage, setSpawnMessage] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const authHeaders = useMemo(() => getAuthHeaders(), [getAuthHeaders])

  const fetchNPCs = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('includeConfigs', '1')
      if (filters.roomId.trim()) {
        params.set('roomId', filters.roomId.trim())
      }
      if (filters.state.trim()) {
        params.set('state', filters.state.trim())
      }

      const response = await fetch(`/api/admin/npc?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        if (response.status === 403) {
          throw new Error(body?.message || 'You do not have permission to access admin NPC tools.')
        }
        if (response.status === 503) {
          throw new Error(body?.message || 'NPC manager is not initialized. Start the socket server.')
        }
        throw new Error(body?.message || `Failed to load NPC list (status ${response.status})`)
      }

      const data = await response.json()
      setNpcItems(Array.isArray(data.items) ? data.items : [])
      setConfigs(Array.isArray(data.configs) ? data.configs : [])
    } catch (err) {
      console.error('[AdminNPCPanel] Failed to load NPCs', err)
      setError((err as Error).message || 'Failed to load NPC data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return
    fetchNPCs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn])

  const handleRefresh = async () => {
    await fetchNPCs()
    if (selectedId) {
      await loadDetail(selectedId)
    }
  }

  const loadDetail = async (instanceId: string) => {
    setActionMessage(null)
    try {
      const response = await fetch(`/api/admin/npc/${instanceId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      })
      if (!response.ok) {
        throw new Error(`Failed to load NPC detail (status ${response.status})`)
      }
      const data = (await response.json()) as NPCDetailResponse
      setDetail(data)
      setSelectedId(instanceId)
    } catch (err) {
      console.error('[AdminNPCPanel] Failed to load NPC detail', err)
      setActionMessage((err as Error).message || 'Failed to load detail.')
    }
  }

  const executeAction = async (
    instanceId: string,
    action: string,
    payload: Record<string, any> = {}
  ) => {
    setActionMessage(null)
    try {
      const response = await fetch(`/api/admin/npc/${instanceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          action,
          ...payload,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || `Action failed (status ${response.status})`)
      }

      const result = await response.json()
      setActionMessage(`Action "${action}" executed successfully.`)
      await fetchNPCs()
      if (result.snapshot) {
        setDetail(result.snapshot)
      } else if (selectedId === instanceId) {
        setDetail(null)
        setSelectedId(null)
      }
    } catch (err) {
      console.error('[AdminNPCPanel] Action failed', err)
      setActionMessage((err as Error).message || `Failed to execute "${action}".`)
    }
  }

  const handleSpawn = async (event: React.FormEvent) => {
    event.preventDefault()
    setSpawnMessage(null)
    if (!spawnNpcId.trim()) {
      setSpawnMessage('Please choose an NPC definition to spawn.')
      return
    }
    try {
      const response = await fetch('/api/admin/npc/spawn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          npcId: spawnNpcId,
          count: spawnCount,
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.message || `Spawn failed (status ${response.status})`)
      }
      const data = await response.json()
      setSpawnMessage(`Spawned ${data.count} NPC(s).`)
      setSpawnCount(1)
      await fetchNPCs()
    } catch (err) {
      console.error('[AdminNPCPanel] Spawn failed', err)
      setSpawnMessage((err as Error).message || 'Failed to spawn NPC.')
    }
  }

  const handleMove = async (instanceId: string) => {
    const toRoomId = window.prompt('Enter destination roomId:')
    if (!toRoomId || !toRoomId.trim()) return
    await executeAction(instanceId, 'move', { toRoomId: toRoomId.trim() })
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-red-900/20 p-6 text-red-200">
        You must be logged in to access admin tools.
      </div>
    )
  }

  if (!player) {
    return (
      <div className="rounded-xl border border-yellow-500/40 bg-yellow-900/20 p-6 text-yellow-200">
        Player data not available. Please reload and try again.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">NPC Administration</h1>
          <p className="text-sm text-gray-400">
            Monitor and manage NPC instances. Use with care — actions are immediate and
            authoritative.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Refresh
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
        <form className="flex flex-wrap items-end gap-4" onSubmit={(event) => event.preventDefault()}>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400">Room ID</label>
            <input
              type="text"
              value={filters.roomId}
              onChange={(event) => setFilters((prev) => ({ ...prev, roomId: event.target.value }))}
              className="mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="e.g. 1001"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400">State</label>
            <input
              type="text"
              value={filters.state}
              onChange={(event) => setFilters((prev) => ({ ...prev, state: event.target.value }))}
              className="mt-1 w-40 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              placeholder="e.g. ENGAGE"
            />
          </div>
          <button
            type="button"
            onClick={fetchNPCs}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Apply Filters
          </button>
          {error && <div className="text-sm text-red-300">{error}</div>}
        </form>
      </section>

      <section className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
        <h2 className="mb-3 text-lg font-semibold text-white">Spawn NPC</h2>
        <form className="flex flex-wrap items-end gap-4" onSubmit={handleSpawn}>
          <div className="flex flex-col">
            <label className="block text-xs font-semibold uppercase text-gray-400">NPC</label>
            <select
              value={spawnNpcId}
              onChange={(event) => setSpawnNpcId(event.target.value)}
              className="mt-1 w-64 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="">Select NPC...</option>
              {configs.map((config) => (
                <option key={config.npcId} value={config.npcId}>
                  {config.name} — room {config.roomId}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-gray-400">Count</label>
            <input
              type="number"
              min={1}
              max={5}
              value={spawnCount}
              onChange={(event) => setSpawnCount(Number(event.target.value) || 1)}
              className="mt-1 w-20 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            Spawn NPC
          </button>
          {spawnMessage && <div className="text-sm text-gray-300">{spawnMessage}</div>}
        </form>
      </section>

      <section className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Active NPCs ({npcItems.length})</h2>
          {loading && (
            <div className="flex items-center text-sm text-gray-400">
              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-gray-500 border-t-transparent" />
              Loading...
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-sm">
            <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Room</th>
                <th className="px-4 py-3 text-left">State</th>
                <th className="px-4 py-3 text-left">HP</th>
                <th className="px-4 py-3 text-left">Frozen</th>
                <th className="px-4 py-3 text-left">Services</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-200">
              {npcItems.map((item) => {
                const frozen = Boolean(item.metadata?.frozen)
                return (
                  <tr
                    key={item.instanceId}
                    className={selectedId === item.instanceId ? 'bg-gray-800/70' : ''}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{item.npc?.name || item.npcId}</div>
                      <div className="text-xs text-gray-400">{item.instanceId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{item.roomId}</div>
                      {item.config?.roomKey && item.config.roomKey !== item.roomId && (
                        <div className="text-xs text-gray-400">Home: {item.config.roomKey}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-purple-700/40 px-2 py-1 text-xs font-medium uppercase tracking-wide text-purple-200">
                        {item.state}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.hp} / {item.hpMax}
                    </td>
                    <td className="px-4 py-3">
                      {frozen ? (
                        <span className="rounded bg-blue-700/30 px-2 py-1 text-xs text-blue-200">
                          Frozen
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {item.config?.services?.length ? item.config.services.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => loadDetail(item.instanceId)}
                          className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => executeAction(item.instanceId, frozen ? 'unfreeze' : 'freeze')}
                          className="rounded bg-blue-700 px-3 py-1 text-xs text-white hover:bg-blue-600"
                        >
                          {frozen ? 'Unfreeze' : 'Freeze'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(item.instanceId)}
                          className="rounded bg-amber-600 px-3 py-1 text-xs text-white hover:bg-amber-500"
                        >
                          Move
                        </button>
                        <button
                          type="button"
                          onClick={() => executeAction(item.instanceId, 'return_home')}
                          className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500"
                        >
                          Return
                        </button>
                        <button
                          type="button"
                          onClick={() => executeAction(item.instanceId, 'despawn')}
                          className="rounded bg-red-700 px-3 py-1 text-xs text-white hover:bg-red-600"
                        >
                          Despawn
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {npcItems.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-400">
                    No active NPCs match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {actionMessage && (
          <div className="mt-3 rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300">
            {actionMessage}
          </div>
        )}
      </section>

      {detail && (
        <section className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Instance Detail — {detail.npc?.name || detail.runtime?.npcId || detail.instanceId}
            </h2>
            <button
              type="button"
              onClick={() => {
                setDetail(null)
                setSelectedId(null)
              }}
              className="rounded-lg bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-600"
            >
              Close
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Runtime
              </h3>
              <pre className="max-h-64 overflow-auto text-xs text-gray-300">
{JSON.stringify(detail.runtime, null, 2)}
              </pre>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-950/70 p-4">
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Config
              </h3>
              <pre className="max-h-64 overflow-auto text-xs text-gray-300">
{JSON.stringify(
  {
    config: detail.config,
    npc: detail.npc,
  },
  null,
  2
)}
              </pre>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

