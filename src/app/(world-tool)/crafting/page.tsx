export const runtime = 'nodejs'

import WorldToolNav from '@/components/WorldToolNav'
import Icon from '@/components/Icon'
import { EntityLink } from '@/components/world-tool/EntityLink'
import { itemHref, roomHref } from '@/components/world-tool/hrefs'
import { Tag } from '@/components/world-tool/ui'

export const metadata = {
  title: 'Crafting — Light Gray World Tool',
  description:
    'Every crafting recipe in Light Gray RPG, by family, with its inputs, output, station and the rooms it can be made in.',
}

// Recipes are shared by the client and the server, so this page reads exactly
// what the crafting action resolves against and cannot drift from it.
const {
  CRAFTING_RECIPES,
  CRAFTING_FAMILIES,
  CRAFTING_STATIONS,
  CRAFTING_ROOMS,
  isRecipeAvailableInRoom,
} = require('@/lib/game-data/crafting-recipes') as {
  CRAFTING_RECIPES: Recipe[]
  CRAFTING_FAMILIES: { id: string; label: string; blurb?: string }[]
  CRAFTING_STATIONS: Record<string, Station>
  CRAFTING_ROOMS: string[]
  // Takes the recipe itself, not its id. `whereToCraft` next to it returns a
  // sentence for the game feed, which is not what a reference table wants.
  isRecipeAvailableInRoom: (recipe: Recipe, roomId: string) => boolean
}

type Ingredient = { slug: string; qty: number; name: string }
type Recipe = {
  id: string
  label: string
  family: string
  batch?: string
  station?: string
  blurb?: string
  inputs: Ingredient[]
  output: Ingredient
}
type Station = {
  label: string
  button?: string
  icon?: string
  where?: string
  made?: string
  families?: string[]
}

export default function CraftingPage() {
  // Which rooms host each recipe, asked of the same predicate the engine uses
  // to decide whether a craft is legal where the player is standing.
  const roomsFor = (recipe: Recipe): string[] =>
    CRAFTING_ROOMS.filter((roomId) => {
      try {
        return isRecipeAvailableInRoom(recipe, roomId)
      } catch {
        return false
      }
    })

  const familyLabel = new Map(CRAFTING_FAMILIES.map((f) => [f.id, f.label]))
  const stationsByRoom = Object.entries(CRAFTING_STATIONS)

  return (
    <div className="min-h-screen fill-surface-canvas">
      <WorldToolNav active="crafting" />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-fg-bright">Crafting</h1>
          <p className="mt-1 max-w-4xl text-sm text-fg-secondary">
            {CRAFTING_RECIPES.length} recipes across {CRAFTING_FAMILIES.length} families, made at{' '}
            {stationsByRoom.length} stations. Inputs and outputs link to the Item Compendium;
            each station links to its room in the World Atlas.
          </p>
        </header>

        {/* Stations first: the rooms that make crafting possible at all. */}
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold text-fg-bright">Stations</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stationsByRoom.map(([roomId, st]) => (
              <div
                key={roomId}
                className="rounded-lg border border-line-subtle bg-surface-panel/30 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  {st.icon && <Icon name={st.icon} size={20} />}
                  <span className="font-semibold text-fg-bright">{st.label}</span>
                  <EntityLink
                    href={roomHref(roomId)}
                    title={`Room ${roomId} in the World Atlas`}
                    className="ml-auto font-mono text-xs"
                  >
                    #{roomId}
                  </EntityLink>
                </div>
                {st.where && <p className="mt-0.5 text-xs text-fg-muted">{st.where}</p>}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(st.families ?? []).map((f) => (
                    <Tag key={f}>{familyLabel.get(f) ?? f}</Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {CRAFTING_FAMILIES.map((family) => {
          const recipes = CRAFTING_RECIPES.filter((r) => r.family === family.id)
          if (recipes.length === 0) return null
          return (
            <section key={family.id} className="mb-8">
              <h2 className="text-lg font-semibold text-fg-bright">{family.label}</h2>
              {family.blurb && <p className="mb-3 text-sm text-fg-secondary">{family.blurb}</p>}
              <div className="overflow-x-auto rounded border border-line-subtle/80 bg-surface-panel">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-subtle text-left text-xs uppercase tracking-wide text-fg-muted">
                      <th scope="col" className="px-3 py-2">Makes</th>
                      <th scope="col" className="px-3 py-2">From</th>
                      <th scope="col" className="px-3 py-2">Station</th>
                      <th scope="col" className="px-3 py-2">Where</th>
                      <th scope="col" className="px-3 py-2">Batch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.map((r) => {
                      const rooms = roomsFor(r)
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-line-subtle/60 align-top last:border-b-0"
                        >
                          <td className="px-3 py-2">
                            <EntityLink href={itemHref(r.output.slug)} className="font-medium">
                              {r.output.name}
                            </EntityLink>
                            {r.output.qty > 1 && (
                              <span className="text-fg-muted"> ×{r.output.qty}</span>
                            )}
                            {r.blurb && (
                              <p className="mt-0.5 max-w-xs text-xs text-fg-muted">{r.blurb}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {r.inputs.map((i) => (
                                <span key={i.slug} className="whitespace-nowrap">
                                  <EntityLink href={itemHref(i.slug)}>{i.name}</EntityLink>
                                  {i.qty > 1 && <span className="text-fg-muted"> ×{i.qty}</span>}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-fg-secondary">
                            {r.station ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            {rooms.length === 0 ? (
                              <span className="text-fg-disabled">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {rooms.map((roomId) => (
                                  <EntityLink
                                    key={roomId}
                                    href={roomHref(roomId)}
                                    className="font-mono text-xs"
                                  >
                                    #{roomId}
                                  </EntityLink>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-fg-muted">
                            {r.batch ?? 'one'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
