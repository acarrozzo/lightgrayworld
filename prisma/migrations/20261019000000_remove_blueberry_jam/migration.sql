-- The Blueberry Jam quest (quest_oldman_004) was never in the original and is removed.
-- Drop its progress rows so no journal carries a quest that no longer exists.
DELETE FROM "QuestProgress" WHERE "questId" = 'quest_oldman_004';
