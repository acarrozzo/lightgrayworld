// Light Gray Mini: quests and the people who talk.
//
// Every line here is lifted from Light Gray RPG (quests.json, quest-givers.json,
// talkers.js) unless it is marked DRAFT. Drafts are written to sound like the
// rest and are there for Anthony to rewrite.
//
// A quest needs one thing:
//   { item: [slug, n] }   hold n of it (taken on turn-in when `consume`)
//   { kills: [slug, n] }  have killed n of it
//   { equipped: slot }    wear something in that slot

export const QUESTS = {
  oldman_001: {
    giver: 'old_man', title: 'A Flower for my Wife',
    objective: 'Bring a Yellow Flower to the Old Man.',
    need: { item: ['flower', 1] }, consume: true,
    remind: 'Have you found that yellow flower yet? You can find them in the flower patch to the north. Just bring me one when you have it!',
    done: 'A yellow flower! Perfect! My wife loved flowers, I will put this on her grave later tonight.',
    reward: { gold: 10, xp: 5 },
  },
  soldier_001: {
    giver: 'young_soldier', title: 'Equip a Weapon',
    objective: 'Take a sword from the rack.',
    need: { equipped: 'sword' },
    remind: 'This is so easy. Just pick up and equip a weapon. The higher the STR the better.',
    done: "Wow, you can pick up a sword. I can't believe we're giving XP for this.",
    reward: { gold: 10, xp: 5 },
  },
  oldman_002: {
    giver: 'old_man', title: 'Rat Problem', after: ['oldman_001'],
    objective: 'Defeat 2 Giant Rats in the Cabin Basement.',
    need: { kills: ['giant-rat', 2] },
    remind: 'I got so many rats down there. Go on down and take out two of the giant ones, not the little ones.',
    done: "Excellent! Rats ain't got nothing on you. Now it's time to deal with the gator.",
    reward: { gold: 15, xp: 8, items: [['cooked-meat', 5]] },
  },
  soldier_002: {
    giver: 'young_soldier', title: 'Collect the Scorpion Tails', after: ['soldier_001'],
    objective: 'Collect 5 Scorpion Tails for the Young Soldier.',
    need: { item: ['scorpion-tail', 5] }, consume: true,
    remind: "Still short on tails? Bring me 5 Scorpion Tails and I'll know you're ready.",
    done: "Alright Wanderer. You can swing it and you came back. That's more than most.",
    reward: { gold: 100, xp: 50, items: [['gold-key', 1]] },
  },
  oldman_003: {
    giver: 'old_man', title: 'The Gator', after: ['oldman_002'],
    objective: 'Defeat the Gator in the Marsh behind the cabin.',
    need: { kills: ['gator', 1] },
    remind: "That gator is still out there in the swamp. Head west into the marsh and deal with it when you're ready.",
    done: "Nice work Wanderer! That gator had it comin'!",
    reward: { gold: 30, xp: 20 },
  },
};

// `idle` is what they say with nothing to ask of you. Lines cycle in order.
export const PEOPLE = {
  old_man: {
    name: 'Old Man', look: 'old_man',
    greeting: 'Hey! Another Wanderer! I love having you guys around. An old man like me could always use a hand. First, can you bring me a flower.',
    quests: ['oldman_001', 'oldman_002', 'oldman_003'],
    idle: [
      "The rats are gone, the gator is dealt with, and my wife got her flower. You've been a true blessing, traveler.",
      '"I\'m not THAT old"',
      '"See if you can get the Young Soldier to smile."',
      '"I lost her before the scorpions."',
      '"I was lucky enough to be in Pax\'s shield. Almost everyone else I knew, wasn\'t."',
      '"Wanderers don\'t stay dead. Good. Somebody around here shouldn\'t."',
      '"Man, what\'s with these rats"',
    ],
  },
  young_soldier: {
    name: 'Young Soldier', look: 'young_soldier',
    needsMet: 'old_man',
    locked: '"What are you doing talking to me? You\'re supposed to talk to the Old Man west of here first."',
    greeting: "I can't believe we're really giving experience for just talking to me.",
    quests: ['soldier_001', 'soldier_002'],
    idle: [
      'You proved yourself, Wanderer.',
      'I was Blue Guard. Was. Don\'t ask.',
      'Star City is a long way up.',
      'Born on Domus. Don\'t remember it. Star City I remember all of.',
      'You are the only ones who can get in there. I don\'t love it either.',
      '"The city has to fall. You\'re the only ones who can do it. Don\'t make me say it twice."',
    ],
  },
  shaman: {
    name: 'Pajama Shaman', look: 'shaman',
    idle: [
      '"The pajamas? Comfortable."',
      '"Am I asleep?"',
      '"What a weird vacation."',
      '"O right, they gave me a shop. Would you like some uhh... pajamas."',
    ],
    teaches: {
      first: 'The Pajama Shaman gives you a crash course in Magic! You can now cast Magic Missile.',
      free: 'missile',
      sells: [{ spell: 'heal', price: 100 }],
    },
  },
  guardian_angel: {
    name: 'Guardian Angel', look: 'angel',
    greeting: 'You might be the wanderer I\'m looking for. What I need lies deep under Star City. You are not ready, first help the people of this field.',
    idle: [
      'Help who you can. Come back when you have.',
      'The ones in Star City brought the dark. The dark brought the scorpions.',
    ],
  },
};

export const SHOPS = {
  basic: {
    name: 'Basic Shop',
    stock: ['red-potion', 'blue-potion', 'long-sword', 'kite-shield', 'padded-armor', 'basic-staff'],
  },
};

// ------------------------------------------------- the rest of the road
// Rewards here are the Mini's own sizes. Where a reward item differs from the
// main game's it says so.

Object.assign(QUESTS, {
  jack_001: {
    giver: 'jack', title: 'Boomerang Some Bats',
    objective: 'Collect 5 Bat Wings from the Bat Cave.',
    need: { item: ['bat-wing', 5] }, consume: true,
    remind: 'Remember, bats fly, you need a ranged weapon to hit them. Equip your boomerang and get back in there!',
    done: 'Five wings, nice haul! And remember, any enemy that flies is out of reach of a sword. Always keep a ranged weapon handy for those.',
    reward: { gold: 100, xp: 50, items: [['wooden-bow', 1]] },   // main game: Green Boots; the bow is his next lesson there
  },
  jack_000: {
    giver: 'jack', title: "The Chief's Cloak", after: ['jack_001'],
    objective: 'Defeat the Goblin Chief in the Bat Cave and bring his cloak to Jack Lumber.',
    need: { item: ['goblin-cloak', 1] }, consume: true,
    remind: "Still no cloak? The Goblin Chief's hiding somewhere deep in the Bat Cave. Go find him, take the cloak off his back, and bring it here. Simple as chopping a tree!",
    done: "Well I'll be! You actually got it! The Forest Path east of here is all yours now, Wanderer. Go see what's out there.",
    reward: { gold: 300, xp: 200, items: [['battle-axe', 1]] },
  },
  grand_field: {
    giver: 'guardian_angel', title: 'Savior of the Grassy Field',
    objective: 'Complete every quest in the Grassy Field, then return to the Guardian Angel.',
    need: { quests: ['oldman_003', 'soldier_002', 'jack_000'] },
    remind: 'The Field first.',
    done: 'The Field is safe. The Pillar noticed. Red Town and the Forest are next.',
    reward: { gold: 300, xp: 200 },
  },
  warriors_000: {
    giver: 'warriors_recruiter', title: 'Defeat the Ogre Lieutenant',
    objective: 'Defeat the Ogre Lieutenant.',
    need: { kills: ['ogre-lieutenant', 1] },
    remind: '"The Ogre Lieutenant is still breathing. His lair is in the Forest. Come back when that\'s no longer true."',
    done: '"Then you\'re one of us." The recruiter hauls a blade off the display rack and hands it over. "Signing bonus."',
    reward: { gold: 300, xp: 500, items: [['iron-sword', 1]] },   // main game: a bastard sword and a great sword
  },
  wizards_000: {
    giver: 'wizards_recruiter', title: 'Defeat the Kobold Master',
    objective: 'Defeat the Kobold Master.',
    need: { kills: ['kobold-master', 1] },
    remind: '"The Kobold Master still holds his chambers. In the Forest. Magic will serve you better than steel down there."',
    done: '"Then you are one of us." The recruiter hands you a wand with no ceremony whatsoever. "Signing bonus. The guild\'s spells are open to you."',
    reward: { gold: 300, xp: 500, items: [['wand', 1]] },         // main game: a Wizard Staff and a Wizard Hat
  },
  ranger_001: {
    giver: 'ranger_guard', title: 'Protect the Mountain Path',
    objective: 'Defeat a Bowman and a Highwayman.',
    need: { killsAll: ['bowman', 'highwayman'] },
    remind: '"They can be found patrolling the stone path to the mountains, and one of them is standing right at the toll."',
    done: 'DRAFT|"You have indeed defeated them." The Ranger Guard steps off the road. "The forest is yours. Mind the trolls."',
    reward: { gold: 400, xp: 600 },
  },
  rigel_001: {
    giver: 'rigel', title: 'Open the Gate',
    objective: 'Collect the Key of Greed, the Key of Wrath and the Key of Pride.',
    need: { killsAll: ['kraken', 'troll-king', 'giant-mountain-giant'] },
    remind: '"Greed, Wrath, Pride. A king holds each."',
    done: 'You hand Rigel the Keys of Greed, Wrath and Pride. He lifts them up to the sky and the gate\'s magic pulls them right from his hand. The three keys click in unison and the gate opens. "Welcome to Star City." Camp Hero waits just west of the gate.',
    reward: { gold: 1000, xp: 1500 },
  },
});

PEOPLE.guardian_angel.quests = ['grand_field'];

Object.assign(PEOPLE, {
  jack: {
    name: 'Jack Lumber', look: 'jack',
    needsFlag: 'chest1',
    locked: '"How\'d you get here? Go back and open that gold chest at the Crossroads first. Then we\'ll talk."',
    greeting: "Ha! You cracked the chest! I knew you had it in you. I'm Jack Lumber, get it? Like Lumberjack! Listen, I've got some work that needs doing around here, and you look like just the Wanderer for the job.",
    quests: ['jack_001', 'jack_000'],
    idle: [
      '"The Forest Path is open! Get out there and see what\'s beyond the Grassy Field."',
      '"I had a cabin in the Forest."',
      '"Beast Wars pushed me down here. Wanderers push the beasts back. That\'s the deal I want."',
      '"Gnome\'s my best friend. Don\'t tell him. He\'d be insufferable."',
      '"Get it? Lumberjack."',
      '"I\'ll keep saying it till somebody laughs."',
    ],
  },
  green_guard: {
    name: 'Green Guard', look: 'green_guard',
    idle: [
      '"I\'m the Green Guard."',
      '"One road out, one guard on it. Me."',
      '"Finish Jack\'s work. Then the Forest. Them\'s the rules."',
      '"Red Town\'s got like 50 guards. We\'ve got me. We\'re doing fine."',
      '"Wanderer? Good. Go help Jack."',
    ],
  },
  dwarf_guard: {
    name: 'Dwarf Guard', look: 'dwarf_guard',
    idle: [
      '"Badge."',
      '"Flats are south. Badge first."',
      '"Wanderers. Hm. Still need a badge."',
      '"Captain\'s orders. Nobody through without a guild. Not since the army came up this road."',
    ],
  },
  hunter_bill: {
    name: 'Hunter Bill', look: 'hunter',
    greeting: 'A wiry man looks up from a half-strung bow and grins. "Yo! I just love being in nature."',
    idle: ['"Still hunting? Good. The forest gives up what it owes eventually, just keep walking it."'],
  },
  red_guard: {
    name: 'Red Guard', look: 'red_guard',
    idle: ['DRAFT|"Red Town is south. Kill an Ogre first. Rules."', 'DRAFT|"Four of us on the gate. One of us talking. Me."'],
  },
  warriors_recruiter: {
    name: "Warrior's Guild Recruiter", look: 'warrior',
    greeting: 'The recruiter looks you up and down without much hurry. "Slay the Ogre Lieutenant and prove you\'re a true Warrior. Do that and this door is yours."',
    quests: ['warriors_000'],
    idle: [
      '"Welcome, member."',
      '"I was out on a forest job that day. Everyone who was here has their name on the wall over there."',
      '"Wanderers are the best thing that\'s walked through that door in years."',
      '"Be strong."',
    ],
  },
  wizards_recruiter: {
    name: "Wizard's Guild Recruiter", look: 'wizard',
    greeting: 'The recruiter\'s attention settles on you all at once. "Defeat the evil Kobold Master, at all costs. Then we can talk about what else you might learn here."',
    quests: ['wizards_000'],
    idle: [
      '"Welcome, member."',
      '"I kept Ill. I did not keep the oath. Those are different things, whatever they say up the mountain."',
      '"They made it a crime to say Sol\'s name in the city. That\'s when I left. Not before. I\'m not proud of the order."',
      '"Wanderers make excellent guild members."',
    ],
    // Members only, as in the main game. There they are spells you recast; here you keep them.
    teaches: { member: 'wizards_000', ask: 'Learn from the guild?', sells: [{ item: 'gills', price: 300 }, { item: 'wings', price: 600 }] },
  },
  warrior_pete: {
    name: 'Warrior Pete', look: 'warrior',
    idle: [
      '"You say you\'re a warrior, huh? I don\'t see it."',
      '"Wanderers. You die, you get up, you come back for more. Must be nice."',
      '"I\'d do it myself but somebody has to protect the guild."',
      '"Sol, Ill, whatever. Nobody up there stopped it."',
    ],
  },
  wizard_morty: {
    name: 'Wizard Morty', look: 'wizard',
    idle: [
      '"So you think you\'re a powerful wizard, huh."',
      '"Magic"',
      '"Wanderer, non-Wanderer, I don\'t care, as long as you can hold a wand the right way round."',
      '"The Chef says Fables had it worse. The Chef is correct. Don\'t tell him I said so."',
    ],
  },
  vinny: {
    name: 'Vinny', look: 'merchant',
    idle: ['"Chickens! You want one? No? Why doesn\'t anyone want my chickens."'],
  },
  todds: {
    name: "Todd's, overheard", look: 'innkeeper',
    idle: [
      '"We lost more." "No we lost more." "You don\'t know that." "Neither do you."',
      '"New Babylon." "Red Town." "It\'s on the gate." "I know what\'s on the gate."',
    ],
  },
  friendly_pirate: {
    name: 'Friendly Pirate', look: 'pirate',
    greeting: '"Aloha, matey! Welcome to my beautiful Oasis!"',
    idle: [
      '"Aloha, matey! The berries are still fresh and the spring is still cold. Stay a while."',
      'DRAFT|"The King under the Ocean? Find the whirlpool east of here. Breathe water first."',
    ],
  },
  ranger_guard: {
    name: 'Ranger Guard', look: 'ranger',
    greeting: '"These dang Highwaymen need to be stopped. They keep robbing the innocent."',
    quests: ['ranger_001'],
    idle: ['"Rest here whenever you like. The Guild is up in the trees, if you can find it."'],
  },
  dark_elf: {
    name: 'Dark Elf', look: 'dark_elf',
    idle: ['"Man this tea is good."', '"The fire is warm and the tea is hot. Sit."'],
  },
  hector: {
    name: 'Captain Hector', look: 'hector',
    idle: ['"The mountains are a most dangerous place. Be alert!"', '"Be alert."'],
  },
  master_trainer: {
    name: 'Master Trainer', look: 'shaman',
    idle: ['...'],
  },
  rigel: {
    name: 'Rigel the Brave', look: 'rigel',
    greeting: '"This is your greatest quest! Retrieve the three keys and unlock the Blue Gate!" Rigel the Knight stands tall by the gate.',
    quests: ['rigel_001'],
    idle: ['"The gate is open." Rigel steps aside. "Camp Hero is west of here, rest at the fountain."'],
  },
  // Pax has no lines in the main game yet. These are placeholders for Anthony.
  pax: {
    name: 'Pax', look: 'pax', ending: true,
    greeting: 'DRAFT|"You made it through the gate. Good. I am Pax."',
    idle: [
      'DRAFT|"Star City is right there. We take it back. Not today."',
      'DRAFT|"Rest at the fountain. You earned it."',
    ],
  },
});

// What the ending says. The three kings are named for the keys they hold.
// The reward card speaks as the Maker; every line is a placeholder for Anthony.
export const ENDING = {
  reached: ['DRAFT|You reached Camp Hero.', 'DRAFT|Star City is right there.'],
  kings: { kraken: 'Greed', 'troll-king': 'Wrath', 'giant-mountain-giant': 'Pride' },
  untimed: 'DRAFT|This save is older than the clock.',
  reward: [
    'DRAFT|This was supposed to give you something in Light Gray RPG.',
    'DRAFT|A title. A cloak. A pet.',
    'DRAFT|It is not hooked up yet.',
    'DRAFT|Tell Anthony to get on that.',
    'DRAFT|If you tell him, you get to decide the reward.',
  ],
  credits: ['LIGHT GRAY SUPER ADVENTURE', 'DRAFT|The rest of it is in Light Gray RPG.', 'Made by Anthony Carrozzo.'],
};

Object.assign(SHOPS, {
  michael: {
    name: "Michael's Weapon Shop", line: '"You wanderers really love swords."',
    stock: ['iron-sword', 'iron-bow', 'iron-staff', 'iron-shield', 'leather-armor', 'iron-armor'],
  },
  steel: {
    name: "Michael's Back Room", line: 'DRAFT|"The good stuff. Don\'t touch it unless you\'re buying it."',
    stock: ['steel-sword', 'steel-bow', 'steel-staff', 'steel-shield', 'steel-armor'],
  },
  adam: {
    name: "Adam's General Store",
    stock: ['red-potion', 'blue-potion', 'purple-potion'],
  },
});

/** The quest a giver is on: the first one not done whose `after` are all done. */
export function currentQuest(player, giverId) {
  const giver = PEOPLE[giverId];
  if (!giver || !giver.quests) return null;
  for (const id of giver.quests) {
    if (player.quests[id] === 'done') continue;
    const q = QUESTS[id];
    if ((q.after || []).every((a) => player.quests[a] === 'done')) return id;
    return null;
  }
  return null;
}

/** How far along a quest is: { have, want, met }. */
export function questProgress(player, id) {
  const q = QUESTS[id];
  if (q.need.item) {
    const [slug, n] = q.need.item;
    const have = Math.min(n, player.bag[slug] || 0);
    return { have, want: n, met: have >= n };
  }
  if (q.need.kills) {
    const [slug, n] = q.need.kills;
    const have = Math.min(n, player.kills[slug] || 0);
    return { have, want: n, met: have >= n };
  }
  if (q.need.killsAll) {
    const have = q.need.killsAll.filter((slug) => (player.kills[slug] || 0) > 0).length;
    return { have, want: q.need.killsAll.length, met: have >= q.need.killsAll.length };
  }
  if (q.need.quests) {
    const have = q.need.quests.filter((id2) => player.quests[id2] === 'done').length;
    return { have, want: q.need.quests.length, met: have >= q.need.quests.length };
  }
  if (q.need.equipped) {
    const met = !!player.gear[q.need.equipped];
    return { have: met ? 1 : 0, want: 1, met };
  }
  return { have: 0, want: 1, met: false };
}
