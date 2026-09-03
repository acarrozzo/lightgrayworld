'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Lock, MapPin } from 'lucide-react'
import Icon from './Icon'
import ActionFlyout, { type ActionFlyoutResult } from './ActionFlyout'
import ItemRow, { ItemDrawer, NameTag } from './ItemRow'
import { useActionFlyout } from '@/hooks/useActionFlyout'
import { useGearCompareSetting } from '@/lib/use-gear-compare'
import { useCraftCanMakeSetting } from '@/lib/use-craft-can-make'
import type { InventoryItem } from '@/lib/game-state'
import { compareToEquipped, getCraftingKind, renderStatMods } from '@/lib/inventory-categories'
import {
  CRAFTING_FAMILIES,
  CRAFTING_RECIPES,
  getCraftingStation,
  isRecipeAvailableInRoom,
  whereToCraft,
} from '@/lib/game-data/crafting-recipes'

/* ------------------------------------------------------------------------- */
/* Types                                                                      */
/* ------------------------------------------------------------------------- */

interface RecipeIngredient {
  slug: string
  qty: number
  name: string
}
interface RecipeTool {
  slug: string
  name: string
  anyOf?: string[]
}
interface RecipeUnlock {
  questId: string
  requireCompleted?: boolean
  hint: string
}
interface Recipe {
  id: string
  label: string
  family: 'cook' | 'potions' | 'wood' | 'leather' | 'iron' | 'tools'
  batch: 'all' | 'one'
  station: 'fire' | 'crafting-table' | 'forge'
  effect?: string
  blurb?: string
  tool?: RecipeTool
  unlock?: RecipeUnlock
  inputs: RecipeIngredient[]
  output: RecipeIngredient
}
interface Family {
  id: string
  label: string
}
interface CraftingStation {
  label: string
  families: string[]
}
/** Why a family (or part of one) is a single line: a quest still to do, or a different station. */
type LockKind = 'lock' | 'elsewhere'

export type ItemTemplate = InventoryItem['template']
/** Templates keyed by slug, from /api/game/recipes. */
export type RecipeTemplates = Record<string, ItemTemplate>

interface CraftingSheetProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  roomName?: string
  inventory: InventoryItem[]
  /**
   * The player's quest rows, used to decide whether a quest-locked family is
   * open yet. The server re-checks it — this only keeps the sheet from
   * advertising a craft that would be refused.
   */
  quests?: { questId: string; completed?: boolean }[]
  /** Null while loading; rows fall back to the recipe's own names until then. */
  templates: RecipeTemplates | null
  templatesFailed?: boolean
  /** Recipe id currently being crafted (its buttons disable). */
  craftingRecipeId?: string | null
  /** Latest socket action result — drives the per-row result flyout. */
  actionResult?: (ActionFlyoutResult & { source?: string }) | null
  onCraft: (recipeId: string, quantity: number) => void
}

/* ------------------------------------------------------------------------- */
/* Styles shared with the bag and the shop                                    */
/* ------------------------------------------------------------------------- */

const PRIMARY =
  'px-2.5 min-h-[30px] rounded-md text-xs font-semibold flex items-center whitespace-nowrap transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none'
const CHIP =
  'relative px-2.5 py-1 text-[11px] font-medium rounded border transition-all duration-200 whitespace-nowrap inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed'
const CHIP_IDLE = 'fill-surface-raised border-line-subtle/50 hover:border-line-strong/50'
const CHIP_ON = 'fill-resource-mp border-resource-mp/50'
const TOGGLE_IDLE = 'bg-transparent border-line-strong/70 text-fg-secondary hover:text-fg-primary'
const TOGGLE_ON = 'bg-status-success/20 border-status-success/60 text-fg-bright'
const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted px-0.5 mt-1'
const META = 'text-[11px] text-fg-muted'
const STEP =
  'px-2.5 py-1 text-sm font-semibold text-fg-bright hover:bg-surface-raised/60 disabled:opacity-40 disabled:cursor-not-allowed'

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * A recipe's output as the item the bag would show, so ItemRow, ItemDrawer and
 * the gear compare take it unchanged. The row name is the recipe's label
 * ("Arrows" beside the ×10 pill), everything else is the template's.
 */
function toRowItem(recipe: Recipe, template: ItemTemplate | null): InventoryItem {
  const base: ItemTemplate = template ?? {
    id: recipe.output.slug,
    slug: recipe.output.slug,
    name: recipe.output.name,
    type: 'MISC',
    description: '',
    max: 999,
    value: 0,
    equipSlot: null,
    weaponCategory: null,
    metadata: null,
  }
  return {
    id: `recipe:${recipe.id}`,
    quantity: recipe.output.qty,
    isEquipped: false,
    slot: null,
    template: { ...base, name: recipe.label },
  }
}

/** "+100 HP" from a consumable template, in the resource's colour. */
function consumableEffect(template: ItemTemplate | null): { label: string; className: string } | null {
  const consumable = (template?.metadata as { consumable?: { stat?: string; amount?: number } } | null)?.consumable
  if (!consumable || typeof consumable.stat !== 'string') return null
  const amount = Number(consumable.amount) || 0
  const stat = consumable.stat.toUpperCase()
  const className = stat === 'HP' ? 'text-resource-hp' : stat === 'MP' ? 'text-resource-mp' : 'text-fg-secondary'
  return { label: `${amount >= 0 ? '+' : ''}${amount} ${stat}`, className }
}

/* ------------------------------------------------------------------------- */
/* Sheet                                                                      */
/* ------------------------------------------------------------------------- */

/**
 * The workbench: opens over the room the way the shop does, full-screen on a
 * phone and a fixed-height dialog on desktop. Recipes are the bag's rows,
 * grouped by material family the way the original craft screen listed them;
 * a family the player has not unlocked collapses to one line with its hint.
 * The server re-validates everything — this only renders availability.
 */
export default function CraftingSheet({
  isOpen,
  onClose,
  roomId,
  roomName,
  inventory,
  quests = [],
  templates,
  templatesFailed = false,
  craftingRecipeId = null,
  actionResult,
  onCraft,
}: CraftingSheetProps) {
  const [view, setView] = useState<string>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [compareEnabled, setCompareEnabled] = useGearCompareSetting()
  const [canMakeOnly, setCanMakeOnly] = useCraftCanMakeSetting()

  useEffect(() => {
    setOpenId(null)
  }, [isOpen, roomId])

  useEffect(() => {
    setQty(1)
  }, [openId])

  // The result flyout anchors to whichever row the latest craft result belongs
  // to (every craft shares the action name, so we match on the recipeId echoed
  // back in the payload).
  const { activeFlyoutAction, flyoutRootRef, dismissFlyout } = useActionFlyout(actionResult ?? undefined)
  const flyoutRecipeId =
    activeFlyoutAction === 'craft' ? (actionResult?.data as { recipeId?: string } | null)?.recipeId ?? null : null

  const station = getCraftingStation(roomId) as CraftingStation | null
  const recipes = CRAFTING_RECIPES as Recipe[]
  const families = CRAFTING_FAMILIES as Family[]
  const startedQuestIds = useMemo(() => new Set(quests.map((q) => q.questId)), [quests])
  const completedQuestIds = useMemo(
    () => new Set(quests.filter((q) => q.completed).map((q) => q.questId)),
    [quests]
  )

  // slug -> { quantity, max } from the live inventory. Drives availability and
  // the materials strip, so the sheet re-renders the moment a craft lands.
  const owned = useMemo(() => {
    const map = new Map<string, { quantity: number; max: number }>()
    for (const item of inventory) {
      const entry = map.get(item.template.slug)
      if (entry) entry.quantity += item.quantity
      else map.set(item.template.slug, { quantity: item.quantity, max: item.template.max })
    }
    return map
  }, [inventory])

  const qtyOf = (slug: string) => owned.get(slug)?.quantity ?? 0
  const templateFor = (slug: string): ItemTemplate | null => templates?.[slug] ?? null
  const nameOf = (slug: string, fallback: string) => templateFor(slug)?.name ?? fallback

  /**
   * The quest a recipe is locked behind, while it is still locked. Most recipes
   * unlock the moment the quest is accepted; ones marking `requireCompleted`
   * (the chef's meatballs, the iron tier) stay locked until it is turned in.
   */
  const lockedBy = (recipe: Recipe): RecipeUnlock | null => {
    if (!recipe.unlock) return null
    const open = recipe.unlock.requireCompleted
      ? completedQuestIds.has(recipe.unlock.questId)
      : startedQuestIds.has(recipe.unlock.questId)
    return open ? null : recipe.unlock
  }

  /** The tool a recipe needs but does not consume, when it is not in the bag. */
  const missingTool = (recipe: Recipe): RecipeTool | null => {
    if (!recipe.tool) return null
    const slugs = [recipe.tool.slug, ...(recipe.tool.anyOf ?? [])]
    return slugs.some((slug) => qtyOf(slug) >= 1) ? null : recipe.tool
  }

  /** How many more batches fit under the output's stack cap. */
  const capRoom = (recipe: Recipe): number => {
    const max = templateFor(recipe.output.slug)?.max ?? owned.get(recipe.output.slug)?.max ?? Infinity
    if (max === Infinity) return Infinity
    return Math.floor((max - qtyOf(recipe.output.slug)) / recipe.output.qty)
  }

  /** How many times this recipe can run right now. */
  const maxCraftableFor = (recipe: Recipe): number => {
    if (lockedBy(recipe) || missingTool(recipe)) return 0
    let batches = Infinity
    for (const input of recipe.inputs) {
      batches = Math.min(batches, Math.floor(qtyOf(input.slug) / input.qty))
    }
    return Math.max(0, Math.min(batches, capRoom(recipe)))
  }

  // Per family: whether this station works it, what is open, what is
  // craftable, and the rest grouped by reason — a quest still to do, or a
  // different station — so each reason reads once.
  const familyViews = families
    .map((family) => {
      const all = recipes.filter((recipe) => recipe.family === family.id)
      const offered = station?.families.includes(family.id) ?? false
      const here = all.filter((recipe) => isRecipeAvailableInRoom(recipe, roomId))
      const unlocked = here.filter((recipe) => !lockedBy(recipe))
      const craftable = unlocked.filter((recipe) => maxCraftableFor(recipe) >= 1)
      const lockHints = new Map<string, { count: number; kind: LockKind }>()
      for (const recipe of all) {
        const isHere = here.includes(recipe)
        const hint = isHere ? (lockedBy(recipe)?.hint ?? null) : (whereToCraft(recipe) as string | null)
        if (!hint) continue
        const entry = lockHints.get(hint) ?? { count: 0, kind: isHere ? 'lock' : 'elsewhere' }
        entry.count += 1
        lockHints.set(hint, entry)
      }
      return { family, all, offered, here, unlocked, craftable, shown: canMakeOnly ? craftable : unlocked, lockHints }
    })
    .filter((entry) => entry.all.length > 0)

  const familyHasContent = (entry: (typeof familyViews)[number]) => entry.shown.length > 0 || entry.lockHints.size > 0
  const offeredViews = familyViews.filter((entry) => entry.offered)
  const elsewhereViews = familyViews.filter((entry) => !entry.offered)
  const effectiveView =
    view === 'all' || offeredViews.some((entry) => entry.family.id === view && familyHasContent(entry)) ? view : 'all'
  const visible = offeredViews.filter((entry) => effectiveView === 'all' || entry.family.id === effectiveView)
  const totalShown = offeredViews.reduce((sum, entry) => sum + entry.shown.length, 0)

  // Materials and tools the player is carrying, for the header strip.
  const carried = useMemo(() => {
    const materials: InventoryItem[] = []
    const tools: InventoryItem[] = []
    for (const item of inventory) {
      const kind = getCraftingKind(item)
      if (kind === 'material') materials.push(item)
      else if (kind === 'tool') tools.push(item)
    }
    return [...materials, ...tools]
  }, [inventory])

  /** "12 wood, 3 stone in bag" for a family's section header. */
  const materialsSummary = (entry: (typeof familyViews)[number]): string | null => {
    const slugs: string[] = []
    for (const recipe of entry.unlocked) {
      for (const input of recipe.inputs) if (!slugs.includes(input.slug)) slugs.push(input.slug)
    }
    if (slugs.length === 0) return null
    const parts = slugs.slice(0, 3).map((slug) => {
      const fallback = entry.unlocked.flatMap((r) => r.inputs).find((i) => i.slug === slug)?.name ?? slug
      return `${qtyOf(slug)} ${nameOf(slug, fallback).toLowerCase()}`
    })
    return `${parts.join(', ')} in bag`
  }

  /* ----------------------------------------------------------------------- */
  /* Rows                                                                     */
  /* ----------------------------------------------------------------------- */

  const renderRecipe = (recipe: Recipe): ReactNode => {
    const template = templateFor(recipe.output.slug)
    const item = toRowItem(recipe, template)
    const held = qtyOf(recipe.output.slug)
    const locked = lockedBy(recipe)
    const tool = missingTool(recipe)
    const atCap = capRoom(recipe) <= 0
    const max = maxCraftableFor(recipe)
    const busy = craftingRecipeId === recipe.id
    const open = openId === recipe.id
    const verb = recipe.family === 'cook' ? 'Cook' : 'Craft'
    const compare = compareEnabled && template?.equipSlot ? compareToEquipped(item, inventory) : null
    const showFlyout = flyoutRecipeId === recipe.id
    const outputName = nameOf(recipe.output.slug, recipe.output.name)

    const shortInput = recipe.inputs.find((input) => qtyOf(input.slug) < input.qty)
    const reason: string | null = locked
      ? locked.hint
      : tool
        ? `Needs a ${tool.name} in your bag.`
        : atCap
          ? `You already carry as many ${outputName} as you can.`
          : shortInput
            ? `${shortInput.qty - qtyOf(shortInput.slug)} more ${nameOf(shortInput.slug, shortInput.name)} needed.`
            : null

    const batchAll = recipe.batch === 'all'
    const primaryLabel = atCap ? 'Full' : batchAll && max >= 1 ? `${verb} all ×${max}` : verb
    const primaryFill = batchAll ? 'fill-resource-gold' : 'fill-action-craft'
    const primaryQty = batchAll ? max : 1
    const clampedQty = Math.max(1, Math.min(qty, Math.max(1, max)))

    return (
      <div key={recipe.id} className="flex flex-col" ref={showFlyout ? flyoutRootRef : undefined}>
        {showFlyout && actionResult && (
          <ActionFlyout result={actionResult} anchorRef={flyoutRootRef} onDismiss={dismissFlyout} />
        )}
        <ItemRow
          item={item}
          open={open}
          onToggle={() => setOpenId((prev) => (prev === recipe.id ? null : recipe.id))}
          nameTag={held > 0 ? <NameTag>own {held}</NameTag> : undefined}
          subline={
            <RecipeSubline recipe={recipe} template={template} qtyOf={qtyOf} nameOf={nameOf} toolMissing={tool != null} />
          }
          compare={compare}
          muted={max < 1}
          action={
            <button
              type="button"
              data-action-button
              onClick={() => onCraft(recipe.id, primaryQty)}
              disabled={max < 1 || busy}
              title={reason ?? undefined}
              className={`${PRIMARY} ${max >= 1 ? primaryFill : 'bg-surface-hover/50 text-fg-muted'}`}
            >
              {busy ? '…' : primaryLabel}
            </button>
          }
        />
        {open && (
          <ItemDrawer
            item={item}
            compare={compare}
            meta={
              <>
                {recipe.tool && (
                  <span className={tool ? 'text-status-error' : 'text-status-success'}>
                    Needs a {recipe.tool.name}
                    {tool ? ' · not in your bag' : ' · in your bag'}
                  </span>
                )}
                {held > 0 && <span>You carry {held}</span>}
                {recipe.output.qty > 1 && <span>Makes {recipe.output.qty} per craft</span>}
              </>
            }
            hint={reason ?? recipe.blurb}
          >
            {max >= 1 && (
              <>
                <span className="inline-flex items-center rounded-md border border-line-strong overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, clampedQty - 1))}
                    disabled={clampedQty <= 1}
                    aria-label="Fewer"
                    className={STEP}
                  >
                    −
                  </button>
                  <span className="min-w-[34px] text-center text-sm font-semibold text-fg-bright bg-surface-sunken tabular-nums py-1">
                    {clampedQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(Math.min(max, clampedQty + 1))}
                    disabled={clampedQty >= max}
                    aria-label="More"
                    className={STEP}
                  >
                    +
                  </button>
                </span>
                <span className={META}>
                  of {max}
                  {recipe.output.qty > 1 && ` · ${clampedQty * recipe.output.qty} ${outputName}`}
                </span>
                <button
                  type="button"
                  data-action-button
                  onClick={() => onCraft(recipe.id, clampedQty)}
                  disabled={busy}
                  className={`${PRIMARY} ${primaryFill} ml-auto`}
                >
                  {verb} {clampedQty}
                </button>
              </>
            )}
          </ItemDrawer>
        )}
      </div>
    )
  }

  if (!isOpen) return null

  const title = station?.label ?? 'Crafting'

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center lg:items-center lg:bg-surface-sunken/80 lg:backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full h-full flex-col overflow-hidden bg-surface-panel lg:h-[85vh] lg:w-[90vw] lg:max-w-2xl lg:rounded-lg lg:border lg:border-line-subtle/50 lg:shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header: the station, where you are, and the X — the shop's shape. */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line-subtle/50 bg-action-craft/10">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-fg-bright truncate">
              <Icon name="craft" size={18} className="text-action-craft" color="current" />
              {title}
            </h2>
            {roomName && <p className="text-[11px] text-fg-muted truncate">{roomName}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded p-1.5 text-fg-secondary transition-colors hover:text-fg-bright hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
            aria-label="Close crafting"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Materials and tools in the bag, pinned where the shop pins your gold. */}
        <div className="px-4 py-2 border-b border-line-subtle/50 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-secondary">
          {carried.length === 0 ? (
            <span className="italic text-fg-muted">Nothing to craft with yet.</span>
          ) : (
            carried.map((item) => (
              <span key={item.id} className="whitespace-nowrap">
                {(getCraftingKind(item) === 'material' || item.quantity > 1) && (
                  <span className="font-semibold text-fg-bright tabular-nums">{item.quantity} </span>
                )}
                {item.template.name}
              </span>
            ))
          )}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-3 flex flex-col gap-3">
          {/* Family chips, then the two per-device toggles. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-pressed={effectiveView === 'all'}
              onClick={() => setView('all')}
              className={`${CHIP} ${effectiveView === 'all' ? CHIP_ON : CHIP_IDLE}`}
            >
              <span>All</span>
              {totalShown > 0 && <span className="text-[10px] font-normal opacity-60">{totalShown}</span>}
            </button>
            {offeredViews.map((entry) => {
              const active = effectiveView === entry.family.id
              const lockedOut = entry.unlocked.length === 0
              return (
                <button
                  key={entry.family.id}
                  type="button"
                  aria-pressed={active}
                  disabled={!familyHasContent(entry)}
                  onClick={() => setView(active ? 'all' : entry.family.id)}
                  className={`${CHIP} ${active ? CHIP_ON : CHIP_IDLE} ${lockedOut ? 'opacity-50' : ''}`}
                >
                  {lockedOut && <Lock size={9} className="text-fg-muted" aria-label="Locked" />}
                  <span>{entry.family.label}</span>
                  {!lockedOut && entry.shown.length > 0 && (
                    <span className="text-[10px] font-normal opacity-60">{entry.shown.length}</span>
                  )}
                </button>
              )
            })}
            <span className="ml-auto inline-flex items-center gap-1.5">
              <button
                type="button"
                aria-pressed={canMakeOnly}
                onClick={() => setCanMakeOnly(!canMakeOnly)}
                title="Only show what you can craft right now"
                className={`${CHIP} ${canMakeOnly ? TOGGLE_ON : TOGGLE_IDLE}`}
              >
                Can make
              </button>
              <button
                type="button"
                aria-pressed={compareEnabled}
                onClick={() => setCompareEnabled(!compareEnabled)}
                title="Compare gear with what you have equipped"
                className={`${CHIP} ${compareEnabled ? TOGGLE_ON : TOGGLE_IDLE}`}
              >
                Compare
              </button>
            </span>
          </div>

          {templates === null && !templatesFailed && (
            <p className={`${META} italic`}>Loading item details…</p>
          )}
          {templatesFailed && (
            <p className={`${META} italic`}>Item details did not load. Names and costs still work; close and reopen to retry.</p>
          )}

          {visible.map((entry) => {
            const summary = materialsSummary(entry)
            return (
              <div key={entry.family.id} className="flex flex-col gap-1.5">
                {entry.shown.length > 0 && (
                  <h4 className={SECTION_TITLE}>
                    {entry.family.label}
                    {summary && (
                      <span className="normal-case tracking-normal font-medium text-fg-secondary"> · {summary}</span>
                    )}
                  </h4>
                )}
                {entry.shown.map(renderRecipe)}
                {[...entry.lockHints].map(([hint, info]) => (
                  <LockLine
                    key={hint}
                    label={entry.family.label}
                    count={info.count}
                    hint={hint}
                    kind={info.kind}
                    partial={entry.unlocked.length > 0}
                  />
                ))}
              </div>
            )
          })}

          {visible.every((entry) => !familyHasContent(entry)) && (
            <p className="text-sm text-fg-secondary py-4">
              {canMakeOnly ? "Nothing you can make right now. Turn off Can make to see every recipe." : 'No recipes available here.'}
            </p>
          )}

          {/* Families this station does not work: one pointer line each, so the
              sheet still reads as the whole recipe book and says where to go. */}
          {effectiveView === 'all' && elsewhereViews.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h4 className={SECTION_TITLE}>Made elsewhere</h4>
              {elsewhereViews.flatMap((entry) =>
                [...entry.lockHints].map(([hint, info]) => (
                  <LockLine
                    key={`${entry.family.id}:${hint}`}
                    label={entry.family.label}
                    count={info.count}
                    hint={hint}
                    kind="elsewhere"
                    partial={false}
                  />
                ))
              )}
            </div>
          )}
        </div>

        <div className="border-t border-line-subtle/50 px-4 py-2.5 text-right">
          <button
            type="button"
            onClick={onClose}
            className="rounded fill-surface-hover px-4 py-1.5 text-sm font-medium transition-colors hover:bg-surface-selected focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * The row's second line: what the recipe makes (stat mods or effect from the
 * template, a short label for ammo, mounts and tools), then the cost in the
 * original's notation — need first, then what you have: `5 Redberry (17)`.
 */
function RecipeSubline({
  recipe,
  template,
  qtyOf,
  nameOf,
  toolMissing,
}: {
  recipe: Recipe
  template: ItemTemplate | null
  qtyOf: (slug: string) => number
  nameOf: (slug: string, fallback: string) => string
  toolMissing: boolean
}) {
  const mods = template ? renderStatMods(template.metadata) : null
  const consumable = consumableEffect(template)
  return (
    <>
      {mods && <span className="font-bold text-xs">{mods}</span>}
      {consumable && <span className={`text-xs font-semibold ${consumable.className}`}>{consumable.label}</span>}
      {recipe.effect && <span className={META}>{recipe.effect}</span>}
      <span className="inline-flex flex-wrap items-center gap-x-1.5 text-[11px]">
        {recipe.inputs.map((input) => {
          const have = qtyOf(input.slug)
          const short = have < input.qty
          return (
            <span key={input.slug} className={`whitespace-nowrap ${short ? 'text-status-error' : 'text-fg-secondary'}`}>
              {input.qty}{' '}
              <span className={`font-semibold ${short ? '' : 'text-fg-primary'}`}>{nameOf(input.slug, input.name)}</span>{' '}
              <span className={`tabular-nums ${short ? 'opacity-80' : 'text-fg-muted'}`}>({have})</span>
            </span>
          )
        })}
        {recipe.tool && (
          <span className={`font-semibold whitespace-nowrap ${toolMissing ? 'text-status-error' : 'text-status-success'}`}>
            {recipe.tool.name}
          </span>
        )}
      </span>
    </>
  )
}

/**
 * A family you can't use here, or the part of one you can't, as a single line
 * with its reason: a lock for a quest still to do, a pin for another station.
 */
function LockLine({
  label,
  count,
  hint,
  kind,
  partial,
}: {
  label: string
  count: number
  hint: string
  kind: LockKind
  partial: boolean
}) {
  const noun = count === 1 ? 'recipe' : 'recipes'
  const Glyph = kind === 'elsewhere' ? MapPin : Lock
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-line-strong/50 px-2.5 py-2 text-[11.5px] leading-snug text-fg-secondary">
      <Glyph size={13} className="mt-0.5 flex-shrink-0 text-fg-muted" aria-hidden />
      <span>
        {partial ? (
          <>{count} more {noun}</>
        ) : (
          <>
            <span className="font-semibold text-fg-bright">{label}</span> · {count} {noun}
          </>
        )}
        {' — '}
        <span className="text-resource-gold">{hint}</span>
      </span>
    </div>
  )
}
