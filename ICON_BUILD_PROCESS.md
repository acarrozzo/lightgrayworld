# Icons

Every icon in the game is one `<symbol>` in a single sprite sheet. The page loads it once and draws icons with `<use href="#name">`.

## Generated files

Both are gitignored and rebuilt by `npm run dev` and `npm run build`:

- `public/sprite-sheet.svg`, the sheet.
- `src/lib/icon-mappings.ts`, the type-safe list of icon names.

## Sources

`scripts/generate-sprite-sheet.js` scans two trees for `.svg` files:

- `public/icons/`, recursively. Loose files at the top level are UI and item glyphs; `equipment/`, `enemy/`, `npc/` and `environment/` hold the categories. Files under `environment/` get an `environment-` prefix.
- `public/img/svg/environment/`, also prefixed `environment-`.

Each SVG is converted to a symbol with `currentColor` fills so it takes the color of the text around it. The Illustrator sources the SVGs are exported from live in `design/` and are not read by the build.

## Adding or replacing an icon

1. Put the `.svg` in the right folder under `public/icons/`. The filename, without extension, is the icon's name.
2. Run `npm run generate-icons`, or `npm run watch-icons` to regenerate on every save while you work.
3. Use it: `<Icon name="your-icon" size={20} />`. `Icon` takes `name`, `size`, `color` and `className`; a `text-*` class in `className` overrides `color`.

Equipment icons are matched to items by slot and id; the World Tool's `/icons` page shows every slot's glyphs side by side and keeps a Backups tab of earlier picks.

## If an icon does not show

Check that `public/sprite-sheet.svg` exists and that the name is in `src/lib/icon-mappings.ts`. If not, the file is in the wrong folder or has an SVG syntax error; `npm run generate-icons` prints what it processed.
