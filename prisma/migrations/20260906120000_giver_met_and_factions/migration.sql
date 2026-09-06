-- Quest givers are met, not "intro-quested". The 24 "Talk to X" / "Find X"
-- quests become a GiverMet row per player per giver; standing with a faction
-- is derived from QuestProgress and needs no table of its own.

-- CreateTable
CREATE TABLE "GiverMet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "metAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiverMet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiverMet_userId_giverId_key" ON "GiverMet"("userId", "giverId");

-- CreateIndex
CREATE INDEX "GiverMet_userId_idx" ON "GiverMet"("userId");

-- AddForeignKey
ALTER TABLE "GiverMet" ADD CONSTRAINT "GiverMet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A completed intro quest was the player having met that giver.
INSERT INTO "GiverMet" ("id", "userId", "giverId", "metAt")
SELECT gen_random_uuid()::text, qp."userId", m.giver_id, CURRENT_TIMESTAMP
FROM "QuestProgress" qp
JOIN (VALUES
    ('quest_oldman_000', 'old_man'),
    ('quest_youngsoldier_000', 'young_soldier'),
    ('quest_jacklumber_intro', 'jack_lumber'),
    ('quest_freddie_intro', 'freddie'),
    ('quest_forestgnome_intro', 'forest_gnome'),
    ('quest_hunterbill_intro', 'hunter_bill'),
    ('quest_redguardcaptain_intro', 'red_guard_captain'),
    ('quest_townhallplaza_intro', 'town_hall_plaza'),
    ('quest_mayorrudolf_intro', 'mayor_rudolf'),
    ('quest_warriorsguild_intro', 'warriors_guild_recruiter'),
    ('quest_warriorpete_intro', 'warrior_pete'),
    ('quest_wizardsguild_intro', 'wizards_guild_recruiter'),
    ('quest_wizardmorty_intro', 'wizard_morty'),
    ('quest_miningguild_intro', 'mining_guild_recruiter'),
    ('quest_guildleader_intro', 'mining_guild_leader'),
    ('quest_dwarfcaptain_intro', 'dwarf_captain'),
    ('quest_bountyboard_intro', 'dwarf_bounty_board'),
    ('quest_friendlypirate_intro', 'friendly_pirate'),
    ('quest_junglejim_intro', 'jungle_jim'),
    ('quest_watertempleguardian_intro', 'water_temple_guardian'),
    ('quest_rangerguard_intro', 'ranger_guard'),
    ('quest_darkelf_intro', 'dark_elf'),
    ('quest_rangersguild_intro', 'rangers_guild_recruiter'),
    ('quest_rangerlego_intro', 'ranger_lego')
) AS m(quest_id, giver_id) ON m.quest_id = qp."questId"
WHERE qp."completed" = true
ON CONFLICT ("userId", "giverId") DO NOTHING;

-- The intro rows are left in place for now. Nothing in the new code reads
-- them (their ids are not in quests.json, so the journal, the counts and the
-- reconcile pass all ignore them), and a server still running the previous
-- code against this database keeps working while it is deployed. A later
-- migration can delete them once nothing depends on them.
