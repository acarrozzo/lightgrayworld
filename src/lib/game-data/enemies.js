const ENEMIES = [
  {
    slug: 'rat',
    name: 'Rat',
    description: 'A scraggly vermin with yellowed teeth.',
    icon: 'rat',
    level: 1,
    hp: 3,
    att: 1,
    def: 1,
    isAggressive: false,
    isFriendly: false,
    xpReward: 1,
    goldMin: 1,
    goldMax: 3,
    drops: [{ itemSlug: 'dagger', chance: 0.50 }],
  },
  {
    slug: 'giant-rat',
    name: 'Giant Rat',
    description: 'A massive, foul-smelling rodent with red eyes.',
    icon: 'rat',
    level: 3,
    hp: 6,
    att: 3,
    def: 1,
    isAggressive: true,
    isFriendly: false,
    xpReward: 3,
    goldMin: 3,
    goldMax: 8,
    drops: [{ itemSlug: 'dagger', chance: 0.65 }],
  },
  {
    slug: 'sand-crab',
    name: 'Sand Crab',
    description: 'A large crab with a hardened shell, scuttling sideways across the sand.',
    icon: 'crab',
    level: 2,
    hp: 3,
    att: 2,
    def: 2,
    isAggressive: false,
    isFriendly: false,
    xpReward: 2,
    goldMin: 1,
    goldMax: 2,
    drops: [{ itemSlug: 'dagger', chance: 0.60 }],
  },
]

function getEnemy(slug) {
  return ENEMIES.find((e) => e.slug === slug) || null
}

module.exports = { ENEMIES, getEnemy }
