-- Transfer "The Chief's Cloak" from the Young Soldier to Jack Lumber.
-- Renames the quest ID in all existing QuestProgress rows.
UPDATE "QuestProgress"
SET "questId" = 'quest_jacklumber_000'
WHERE "questId" = 'quest_youngsoldier_004';

-- Backfill the two Jack Lumber side quests for players who already completed
-- Scorpion Tails (quest_youngsoldier_002) before this migration.
INSERT INTO "QuestProgress" ("id", "userId", "questId", "progress", "completed")
SELECT
  gen_random_uuid(),
  qp."userId",
  side_quest."questId",
  0,
  false
FROM "QuestProgress" qp
CROSS JOIN (
  VALUES ('quest_jacklumber_001'), ('quest_jacklumber_002')
) AS side_quest("questId")
WHERE qp."questId" = 'quest_youngsoldier_002'
  AND qp."completed" = true
  AND NOT EXISTS (
    SELECT 1 FROM "QuestProgress" existing
    WHERE existing."userId" = qp."userId"
      AND existing."questId" = side_quest."questId"
  );
