'use client'

import { useMemo } from 'react'
import { X, Hammer } from 'lucide-react'
import Icon from '@/components/Icon'
import ActionFlyout from '@/components/ActionFlyout'
import { useActionFlyout } from '@/hooks/useActionFlyout'
import type { InventoryItem } from '@/lib/game-state'
import { getCraftingKind } from '@/lib/inventory-categories'
import { getRecipesForRoom, CRAFTING_STATIONS } from '@/lib/game-data/crafting-recipes'

type Recipe = ReturnType<typeof getRecipesForRoom>[number]

interface CraftingPanelProps {
  roomId: string
  inventory: InventoryItem[]
  /**
   * The player's quest rows, used only to decide whether a quest-locked recipe
   * tier (Freddie's leather) is unlocked yet. The server re-checks it — this
   * just keeps the panel from advertising a craft that would be refused.
   */
  quests?: { questId: string; completed?: boolean }[]
  onCraft: (recipeId: string, quantity: number) => void
  onClose: () => void
  /** Recipe id currently being crafted (its buttons show a spinner / disable). */
  craftingRecipeId?: string | null
  /** Latest socket action result — drives the per-card result flyout. */
  actionResult?: {
    action?: string
    source?: string
    timestamp?: string
    data?: { showModal?: boolean; recipeId?: string } | null
  } | null
}

export default function CraftingPanel({
  roomId,
  inventory,
  quests = [],
  onCraft,
  onClose,
  craftingRecipeId = null,
  actionResult,
}: CraftingPanelProps) {
  const recipes = useMemo(() => getRecipesForRoom(roomId), [roomId])
  const startedQuestIds = useMemo(() => new Set(quests.map((q) => q.questId)), [quests])
  const completedQuestIds = useMemo(
    () => new Set(quests.filter((q) => q.completed).map((q) => q.questId)),
    [quests]
  )

  // The result flyout anchors to whichever recipe card the latest craft result
  // belongs to (all craft buttons share the action name 'craft', so we match on
  // the recipeId echoed back in the result payload).
  const { activeFlyoutAction, flyoutRootRef, dismissFlyout } = useActionFlyout(actionResult ?? undefined)
  const flyoutRecipeId =
    activeFlyoutAction === 'craft' ? actionResult?.data?.recipeId ?? null : null

  // slug -> { quantity, max } from the live inventory. Drives both recipe
  // availability and the materials/tools strip, so the panel re-renders the
  // moment a craft updates inventory in the store.
  const owned = useMemo(() => {
    const map = new Map<string, { quantity: number; max: number }>()
    for (const item of inventory) {
      map.set(item.template.slug, { quantity: item.quantity, max: item.template.max })
    }
    return map
  }, [inventory])

  const qtyOf = (slug: string) => owned.get(slug)?.quantity ?? 0

  // Crafting materials and tools the player is carrying, for the bottom strip.
  const { materials, tools } = useMemo(() => {
    const materials: InventoryItem[] = []
    const tools: InventoryItem[] = []
    for (const item of inventory) {
      const kind = getCraftingKind(item)
      if (kind === 'material') materials.push(item)
      else if (kind === 'tool') tools.push(item)
    }
    return { materials, tools }
  }, [inventory])

  /** The tool a recipe needs but does not consume, and whether it's in the bag. */
  const missingTool = (recipe: Recipe) => {
    if (!recipe.tool) return null
    // A recipe's `anyOf` names tools that stand in for the one it asks for (a
    // steel hammer works iron), so the requirement is met by any of them.
    const slugs = [recipe.tool.slug, ...((recipe.tool as { anyOf?: string[] }).anyOf ?? [])]
    return slugs.some((slug) => qtyOf(slug) >= 1) ? null : recipe.tool
  }

  /**
   * The quest a recipe is locked behind, while it is still locked. Most recipes
   * unlock the moment the quest is accepted; ones marking `requireCompleted`
   * (the chef's meatballs) stay locked until it is turned in.
   */
  const lockedBy = (recipe: Recipe) => {
    if (!recipe.unlock) return null
    const done = 'requireCompleted' in recipe.unlock && recipe.unlock.requireCompleted
      ? completedQuestIds.has(recipe.unlock.questId)
      : startedQuestIds.has(recipe.unlock.questId)
    return done ? null : recipe.unlock
  }

  // How many times this recipe can run right now — the min over inputs, then
  // clamped by remaining output stack space.
  const maxCraftableFor = (recipe: Recipe) => {
    if (lockedBy(recipe) || missingTool(recipe)) return 0
    let perBatch = Infinity
    for (const input of recipe.inputs) {
      perBatch = Math.min(perBatch, Math.floor(qtyOf(input.slug) / input.qty))
    }
    const outEntry = owned.get(recipe.output.slug)
    const outMax = recipe.output.max ?? outEntry?.max ?? Infinity
    const outRoom =
      outMax === Infinity
        ? perBatch
        : Math.floor((outMax - (outEntry?.quantity ?? 0)) / recipe.output.qty)
    return Math.max(0, Math.min(perBatch, outRoom))
  }

  const renderCard = (recipe: Recipe) => {
    const maxCraftable = maxCraftableFor(recipe)
    const canCraft = maxCraftable >= 1
    const locked = lockedBy(recipe)
    const needsTool = missingTool(recipe)
    const outEntry = owned.get(recipe.output.slug)
    const held = outEntry?.quantity ?? 0
    const atMax =
      recipe.output.max != null &&
      (outEntry?.quantity ?? 0) + recipe.output.qty > recipe.output.max
    const isBusy = craftingRecipeId === recipe.id
    const showFlyout = flyoutRecipeId === recipe.id

    return (
      <div
        key={recipe.id}
        className={`relative flex max-w-md flex-col gap-2 rounded-lg border p-3 transition-colors ${
          canCraft
            ? 'border-line-subtle/60 bg-surface-raised/40'
            : 'border-line-subtle/60 bg-surface-raised/20 opacity-70'
        }`}
      >
        {showFlyout && actionResult && (
          <ActionFlyout result={actionResult} anchorRef={flyoutRootRef} onDismiss={dismissFlyout} />
        )}

        {/* Header: output icon, name×qty, effect */}
        <div className="flex items-start gap-3">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-line-subtle/50 bg-surface-panel/60">
            <Icon name={recipe.outputIcon} size={44} className="text-action-attack" color="current" />
            {/* How many of this output the player is already carrying. Kept
                prominent so the held count reads at a glance while crafting. */}
            <span
              title={`You are carrying ${held} ${recipe.output.name}`}
              className={`absolute -top-2 -left-2 flex h-6 min-w-[24px] items-center justify-center rounded-full border px-1.5 text-sm font-bold tabular-nums shadow-sm shadow-black/50 ${
                held > 0
                  ? 'border-action-attack/70 bg-surface-canvas text-action-attack'
                  : 'border-line-subtle bg-surface-panel text-fg-muted'
              }`}
            >
              {held}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-semibold text-fg-bright truncate">{recipe.label}</span>
              {recipe.output.qty > 1 && (
                <span className="text-xs text-fg-secondary whitespace-nowrap">×{recipe.output.qty}</span>
              )}
            </div>
            {recipe.output.effect && (
              <div className="text-xs text-status-success/90">{recipe.output.effect}</div>
            )}
            {recipe.blurb && (
              <div className="text-[11px] text-fg-muted leading-snug mt-0.5">{recipe.blurb}</div>
            )}
          </div>
        </div>

        {/* Why this recipe is unavailable, when it is not simply a material shortfall. */}
        {locked && <div className="text-[11px] text-resource-gold/90">{locked.hint}</div>}
        {!locked && needsTool && (
          <div className="text-[11px] text-resource-gold/90">Needs a {needsTool.name} in your inventory.</div>
        )}

        {/* Ingredient requirements: cost (have / need). */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-fg-muted">Cost:</span>
          {recipe.tool && (
            <span className={`text-xs ${needsTool ? 'text-status-error' : 'text-fg-primary'}`}>
              {recipe.tool.name} <span className="font-semibold">{needsTool ? '0/1' : '1/1'}</span>
            </span>
          )}
          {recipe.inputs.map((input) => {
            const have = qtyOf(input.slug)
            const enough = have >= input.qty
            return (
              <span key={input.slug} className={`text-xs ${enough ? 'text-fg-primary' : 'text-status-error'}`}>
                {input.name} <span className="font-semibold">{have}/{input.qty}</span>
              </span>
            )
          })}
        </div>

        {/* Footer: max craftable + buttons */}
        <div ref={showFlyout ? flyoutRootRef : undefined} className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-fg-muted">
            Can make: <span className="font-semibold text-fg-primary">{maxCraftable}</span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-action-button
              onClick={() => onCraft(recipe.id, 1)}
              disabled={!canCraft || isBusy}
              title={atMax ? `You already hold the max number of ${recipe.output.name}` : 'Craft one'}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                canCraft && !isBusy
                  ? 'bg-action-attack/80 hover:bg-action-attack text-fg-bright'
                  : 'bg-surface-hover/50 text-fg-muted cursor-not-allowed'
              }`}
            >
              {isBusy ? '...' : atMax ? 'Full' : 'Craft 1'}
            </button>
            <button
              type="button"
              data-action-button
              onClick={() => onCraft(recipe.id, maxCraftable)}
              disabled={!canCraft || isBusy || maxCraftable < 2}
              title={maxCraftable >= 2 ? `Craft all ${maxCraftable}` : 'Not enough materials to batch-craft'}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                canCraft && !isBusy && maxCraftable >= 2
                  ? 'bg-resource-gold/80 hover:bg-resource-gold text-fg-bright'
                  : 'bg-surface-hover/40 text-fg-disabled cursor-not-allowed'
              }`}
            >
              Craft All{maxCraftable >= 2 ? ` (${maxCraftable})` : ''}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-action-attack/40 bg-surface-panel/95 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line-subtle/70 bg-action-attack/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Hammer size={20} className="text-action-attack" />
          <h3 className="text-lg font-bold text-action-attack">Crafting</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close crafting"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-fg-bright/80 hover:bg-surface-raised hover:text-fg-bright transition-colors"
        >
          <X size={16} />
          <span>Close Crafting</span>
        </button>
      </div>

      {/* Recipes, grouped by crafting station with a minimal section header. */}
      <div className="p-3 space-y-4">
        {recipes.length === 0 ? (
          <p className="text-sm text-fg-secondary px-1 py-2">No recipes available here.</p>
        ) : (
          CRAFTING_STATIONS.map((station) => {
            const stationRecipes = recipes.filter((r) => r.station === station.id)
            if (stationRecipes.length === 0) return null
            return (
              <div key={station.id} className="space-y-2">
                <div className="flex items-center gap-1.5 border-b border-line-subtle/60 pb-1">
                  <Icon name={station.icon} size={14} className="text-fg-secondary" color="current" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">
                    {station.label}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {stationRecipes.map(renderCard)}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Materials & tools strip */}
      <div className="border-t border-line-subtle/70 bg-surface-panel/60 px-3 py-2 space-y-1.5">
        <MaterialRow label="Materials" items={materials} emptyText="No materials" />
        <MaterialRow label="Tools" items={tools} emptyText="No tools" />
      </div>
    </div>
  )
}

function MaterialRow({
  label,
  items,
  emptyText,
}: {
  label: string
  items: InventoryItem[]
  emptyText: string
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-16 shrink-0 pt-0.5 text-[10px] uppercase tracking-wider text-fg-muted">{label}</span>
      {items.length === 0 ? (
        <span className="text-xs text-fg-disabled italic">{emptyText}</span>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {items.map((item) => (
            <span
              key={item.id}
              title={item.template.name}
              className="flex items-center gap-1 rounded border border-line-subtle/50 bg-surface-raised/50 px-1.5 py-0.5"
            >
              <Icon
                name={item.template.metadata?.icon || item.template.slug}
                size={20}
                className="text-fg-primary"
                color="current"
              />
              <span className="text-[11px] text-fg-primary max-w-[90px] truncate">{item.template.name}</span>
              <span className="text-[11px] font-semibold text-fg-secondary">×{item.quantity}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
