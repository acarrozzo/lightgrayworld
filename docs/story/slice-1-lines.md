# Slice 1 lines: the frame

**Status: wired on October 18, 2026.** The Blueberry Jam quest (`quest_oldman_004`) was removed on October 19; its three lines below are gone with it. Every Proposed line below is in `quest-givers.json` / `quests.json`. Edit the data directly from here on; this file is the record of what was agreed.

Room Zero, the Guardian Angel, the Old Man, the Young Soldier. Every line below is a draft for you to rewrite in place. Edit the **Proposed** column directly in this file; strike a row to drop it. Nothing ships until you have touched it.

**How the hooks work.** A giver's `greeting` shows on first meeting. While one of their quests is active you see that quest's `reminderDialog`, or its `completionDialog` when it is ready to turn in. With no quest active you see the first `idleDialogs` entry whose gate is open (newest completed quest first, `null` is the default). An idle `message` can be a set of lines that rotates. An `aside` is a rotating line added under whatever the giver says, reminder or idle, from the first `asides` entry whose gate is open. Gates can only name the giver's own quests.

## Room Zero (done)

| Where | Current | Status |
|---|---|---|
| Read Paper | It looks like a map of Room Zero. A gray square with a star in the center. | yours, in |
| Read Sign | Welcome to Room Zero, the first room ever made. It is unlike the others. I allow you to access here, for now. | unchanged |
| Examine Pillar | The bright blue light emanating from the pillar seems to be a button. Press it to teleport to the grassy field. | unchanged |

## Guardian Angel (029)

Second draft. Stoic. Chained by the gods, knows why, does not dwell on it. Her purpose is to guide and help the Wanderer. She does not know the Maker or the Pillar. She arrived when the Wanderers did, so she never saw the Academy standing and never says a year. She points the Wanderer at the land that still needs them, and at the end, at Pax.

**What the "names" are, for reference.** The four grand quests she gives are the ones built on October 17: finish every quest in a land and the Pillar beside her carries a title for it (Savior of the Grassy Field, then of the Lowlands, then of Land and Sea, then of Vega), each replacing the last, and the Pillar lists the players who hold each one. A fifth, Eternal Mage, is dark until Star City. That mechanic can stay as it is while her dialog stops talking about names at all; the Pillar's own examine text can carry that. These drafts assume that. If you would rather the titles go too, say so and it is a data change.

### Fixed lines

| Hook | Current | Proposed |
|---|---|---|
| greeting (first talk) | You have been called. The academy that trained the mages of Vega fell when magic left this land, and five names were carved into the Pillar for whoever would stand for it. Help every soul in a land and come back to me. Each name you earn replaces the last, until all of Vega knows you by one. | You might be the wanderer I'm looking for. What I need lies deep under Star City. You are not ready, first help the people of this field. |
| GQ1 reminder | The first name is not yours yet. The Grassy Field still has people who need you. {standings} | The Field first. {standings} |
| GQ1 completion | The Grassy Field is safe because of you. Your first name is carved into the Pillar: Savior of the Grassy Field. | The Field is safe. The Pillar noticed. Red Town and the Forest are next. |
| GQ2 reminder | The Lowlands are not yours yet. The Forest and Red Town still have work for you. {standings} | The Forest and Red Town. Both guilds. {standings} |
| GQ2 completion | From the field to the red walls of the town, the Lowlands stand because of you. The Pillar now carries a greater name: Savior of the Lowlands. | The Lowlands stand. Go south to the dwarves, and out onto the water. |
| GQ3 reminder | Land and sea are not yours yet. The dwarves and the ocean still wait. {standings} | The dwarves and the ocean. {standings} |
| GQ3 completion | The stone and the water both know your name now. The Pillar carries it: Savior of Land and Sea. | Land and sea. Now the dark trees and the mountain. Be ready before you go. |
| GQ4 reminder | Vega is not yours yet. The dark trees and the high peaks still have need of you. {standings} | The Dark Forest and the Mountains. {standings} |
| GQ4 completion | Four lands, and every one of them saved by you. The Pillar carries the name all of Vega knows: Savior of Vega. One name is still dark. When the gates of Star City open, come back to me. | Vega is yours to the gates. Pax waits at Camp Hero. He needs what you have. Go to him. |
| idle, after GQ4 | Four names are yours and the Pillar hums with them. The fifth is still dark. When the gates of Star City open, come back to me. | Pax is at Camp Hero. I have nothing more for you here. |
| idle, default | The Pillar hums quietly. There are names still waiting to be earned. | Help who you can. Come back when you have. |

### Asides (rotating, one shows under each talk)

Picked at random from the newest open set. She states the chain like weather and moves on. Write as many or as few per state as you like.

| State | Proposed lines |
|---|---|
| before any grand quest | The chain is the gods' business. Yours is the Field. |
| | Why i'm here? I only half know. |
| | Ask me about the city. Not the chain. |
| | Don't be sorry for me. I'm not. |
| | I got here when you did. Don't ask me how. |
| | They know what you are out there. Some will like it. Some won't. |
| after GQ1 (Grassy Field) | The Field is quiet. Good. Red Town is not. |
| | The Old Man still goes to that grave. Someone should. |
| after GQ2 (Lowlands) | Red Town argues. That is what living people do. |
| | The guilds will take you now. Use them. |
| after GQ3 (Land and Sea) | The dwarves say Frederick is with them. I can't go and look. |
| | The beasts are still out there. Pax and his friends did most of it. You do the rest. |
| after GQ4 (Vega) | The ones in Star City brought the dark. The dark brought the scorpions. Remember that when you get there. |
| | When the gates open, don't come back here first. Go. |

## Old Man (003)

His wife is dead and unnamed. Three lines in the game still have her alive.

| Hook | Current | Proposed |
|---|---|---|
| quest_oldman_004 summary | The Old Man has a craving for his wife's famous blueberry jam. He needs a good haul of fresh blueberries. | The Old Man wants blueberry jam the way his wife made it. He needs berries. |
| quest_oldman_004 reminder | The Old Man leans back with a wistful look. "My wife makes the most wonderful blueberry jam, but we're fresh out of berries. Head over to the blueberry patch and bring me back ten of 'em when you get a chance." | My wife made the best blueberry jam. I've got her recipe and no berries. Bring me ten from the patch. |
| quest_oldman_004 completion | The Old Man's eyes go wide. "Well I'll be — you actually got 'em! Those'll make the finest jam this side of the bayou. My wife is going to be absolutely delighted, I tell you." | Well I'll be. You got 'em. I'll make a batch tonight. Won't be as good as hers. |
| idle, after 004 | The Old Man rocks contentedly in his chair. "The gator's gone, the rats are gone, and my wife's got her jam. You've been a true blessing to this old man, traveler." | The gator's gone, the rats are gone, and there's jam in the cupboard. You've been a blessing to this old man. |
| idle, after 003 | The Old Man rocks contentedly in his chair. "The rats are gone, the gator is dealt with, and my wife got her flower. You've been a true blessing, traveler." | The rats are gone, the gator is dealt with, and my wife got her flower. You've been a true blessing, traveler. |
| idle, after 001 | The Old Man smiles warmly. "Thank you again for your help, traveler! That flower made the perfect addition to my recipe. If you need anything else, feel free to ask." | Thanks again for that flower. She would have loved it. |

## Young Soldier (007)

Born on Domus, a Star City soldier who left recently, something happened to his family, reluctantly supports Wanderers because they alone can save the city. His tic is that he cannot believe you get XP for this. Keep the tic; let the rest leak out in the idle rotation after his second quest, when he has decided you are worth talking to.

| Hook | Current | Proposed |
|---|---|---|
| greeting | I can't believe we're really giving experience for just talking to me. | unchanged |
| lockedDialog | "What are you doing talking to me? You're supposed to talk to the Old Man west of here first." | unchanged |
| quest 001 completion | Wow, you can pick up a sword. I can't believe we're giving XP for this. | unchanged |
| quest 002 completion | Very well Wanderer. You're no longer just an adventurer with a weapon, you're one who knows how to use it. I think you're ready to explore this world." | Alright Wanderer. You can swing it and you came back. That's more than most. |
| idle, after 001 | Wow, you can pick up a sword. I can't believe we're giving XP for this. | unchanged |

### Idle rotation, after quest 002 (one shows per talk)

| Proposed lines |
|---|
| You proved yourself, Wanderer. Head east then north to Jack Lumber's cabin. He's got quests that'll open the way to the Forest. |
| I was Blue Guard. Was. Don't ask. |
| Star City is a long way up. |
| Born on Domus. Don't remember it. Star City I remember all of. |
| You are the only ones who can get in there. I don't love it either. |
| My family. No. Go talk to Jack. |

## Not in this slice

The Angel's greeting change touches the room's first impression, so say if you would rather keep the current one. Gates on another giver's quest are not possible yet (the Young Soldier cannot react to a grand quest), so anything like "after you save the Field, the Soldier says..." waits for a small engine change. Shout if you want it.
