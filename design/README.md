# Design sources

Illustrator files the game's icon art is drawn from. They are **inputs to the
artist, not to the build**: the pipeline (`npm run generate-icons`) reads the
exported `.svg` files under `public/icons/` and `public/img/svg/`, never these.

They used to live inside `public/`, which meant ~31MB of Illustrator sources were
served to players at a public URL and shipped in every deployed image. They are
kept here instead — tracked, but outside the served tree and excluded from the
Docker build context.

`icons/` and `img-svg/` mirror where each file previously sat. The two
`SVG-ENEMIES.ai` and `SVG-ENVIRONMENT.ai` copies are byte-identical; the two
`SVG-WEAPONS.ai` copies differ, so both were kept rather than guessing which is
current.
