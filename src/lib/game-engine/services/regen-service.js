/**
 * The per-click status tick on the vitals: regen in, poison out.
 *
 * The original's function-statuseffects.php ran once a click, after the
 * action. It summed the regen rings, the Shaman Necklace, the Sky Hawk, a
 * running cup of tea and the Regenerate spell, topped HP and MP up toward
 * their maxima, then let poison take its bite. That order is kept: regen
 * lands first, poison comes off what is left.
 *
 * Which sources apply and how much is game-data/regen.js (shared with the
 * client's chip); this module is the database side of it. An item opts in by
 * declaring `metadata.regen: { hp?: number, mp?: number }` in the seed — no
 * code change needed to add another regen item.
 */
const { prisma } = require('../../db-client')
const { sumGearRegen } = require('../../game-data/regen')

/**
 * Sum the regen declared by everything the player currently has equipped.
 * @param {string} playerId
 * @returns {Promise<{hp: number, mp: number}>}
 */
async function getEquippedRegen(playerId) {
  const equipped = await prisma.playerItem.findMany({
    where: { playerId, isEquipped: true },
    select: { ItemTemplate: { select: { metadata: true } } },
  })
  return sumGearRegen(equipped.map((row) => row.ItemTemplate?.metadata))
}

/**
 * Apply one click's regen and poison to the live row, in one statement.
 *
 * Regen is clamped to the player's maxima but never lowers an overcharged
 * value (a fountain rest above max is left alone): the HP side is
 * `GREATEST(hp, LEAST(hpMax, hp + regen))`. Poison then comes off that,
 * floored at `canDie ? 0 : 1` — in a fight poison can finish you, and the
 * caller routes HP 0 through the defeat flow; out of one it leaves you at
 * 1 HP, since there is no dying outside battle in this game.
 *
 * The dead don't regenerate and can't be poisoned further: the WHERE clause
 * skips a row already at 0, so a regen ring never quietly stands a player
 * back up in the room that killed them.
 *
 * @param {string} playerId
 * @param {{ regen: {hp: number, mp: number}, poisonDamage?: number, allowMpRegen?: boolean, canDie?: boolean }} tick
 * @returns {Promise<{hp: number, mp: number, hpMax: number, mpMax: number, prevHp: number, prevMp: number, regenHp: number, regenMp: number, poisonDamage: number}|null>}
 *   the new vitals with what moved them, or null when there was nothing to apply
 */
async function applyStatusTick(playerId, { regen, poisonDamage = 0, allowMpRegen = true, canDie = false }) {
  const regenHp = Math.max(0, Math.floor(Number(regen?.hp) || 0))
  const regenMp = allowMpRegen ? Math.max(0, Math.floor(Number(regen?.mp) || 0)) : 0
  const poison = Math.max(0, Math.floor(Number(poisonDamage) || 0))
  if (regenHp <= 0 && regenMp <= 0 && poison <= 0) return null

  const rows = await prisma.$queryRawUnsafe(
    `WITH prev AS (SELECT hp AS prev_hp, mp AS prev_mp FROM "User" WHERE id = $1)
     UPDATE "User"
     SET hp = GREATEST($5, GREATEST(hp, LEAST("hpMax", hp + $2)) - $4),
         mp = GREATEST(mp, LEAST("mpMax", mp + $3))
     WHERE id = $1 AND hp > 0
     RETURNING hp, mp, "hpMax", "mpMax",
       (SELECT prev_hp FROM prev) AS "prevHp", (SELECT prev_mp FROM prev) AS "prevMp"`,
    playerId,
    regenHp,
    regenMp,
    poison,
    canDie ? 0 : 1
  )

  const row = rows[0]
  if (!row) return null
  return {
    hp: Number(row.hp),
    mp: Number(row.mp),
    hpMax: Number(row.hpMax),
    mpMax: Number(row.mpMax),
    prevHp: Number(row.prevHp),
    prevMp: Number(row.prevMp),
    regenHp,
    regenMp,
    poisonDamage: poison,
  }
}

module.exports = { getEquippedRegen, applyStatusTick }
