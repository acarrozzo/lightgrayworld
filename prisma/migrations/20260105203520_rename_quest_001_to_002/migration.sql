-- Update existing quest_001 to quest_002 to preserve player progress
UPDATE "QuestProgress" SET "questId" = 'quest_002' WHERE "questId" = 'quest_001';

