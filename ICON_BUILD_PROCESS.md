# 🎨 Icon Build Process

This project uses an automated SVG sprite sheet generation system that processes all 525+ icons from your original game assets.

## 📁 Generated Files

- `public/sprite-sheet.svg` - Single sprite sheet containing all icons
- `src/lib/icon-mappings.ts` - TypeScript mappings for all icon names

## 🚀 Available Scripts

### Development
```bash
# Generate icons and start dev server
npm run dev

# Generate icons, watch for changes, and start dev server
npm run dev:watch
```

### Build
```bash
# Generate icons and build for production
npm run build

# Generate icons only
npm run generate-icons

# Watch for SVG changes and auto-regenerate
npm run watch-icons
```

## 🔄 How It Works

1. **Icon Discovery**: Scans `public/icons/` directory recursively for all `.svg` files
2. **Processing**: Converts each SVG to a `<symbol>` element with proper `currentColor` attributes
3. **Sprite Generation**: Combines all symbols into a single sprite sheet
4. **TypeScript Mappings**: Generates type-safe icon name mappings
5. **Integration**: Icons are used via `<use href="#icon-name">` elements

## 📝 Adding New Icons

1. Add your new SVG file to `public/icons/` (or any subdirectory)
2. Run `npm run generate-icons` to update the sprite sheet
3. Use the icon with `<Icon name="your-icon-name" />`

## 🎯 Icon Usage

```tsx
import Icon from '@/components/Icon'

// Basic usage
<Icon name="attack" size={24} />

// With color
<Icon name="heal" size={32} color="green" />

// With custom styling
<Icon name="magic" size={16} color="blue" className="animate-pulse" />
```

## 🔧 Build Integration

The icon generation is automatically integrated into:

- **Development**: Icons are generated before starting the dev server
- **Production Build**: Icons are generated before building
- **Pre-commit Hook**: Icons are regenerated and added to commits
- **File Watching**: Icons auto-regenerate when SVG files change

## 📊 Performance Benefits

- **Single HTTP Request**: All icons load with one request
- **Instant Rendering**: No loading states or delays
- **Browser Caching**: Sprite sheet cached once, used everywhere
- **Type Safety**: Full TypeScript support with autocomplete
- **Tree Shaking**: Only used icons are included in builds

## 🛠️ Troubleshooting

### Icons Not Showing
1. Check if the sprite sheet exists: `public/sprite-sheet.svg`
2. Verify icon name in mappings: `src/lib/icon-mappings.ts`
3. Ensure SVG file is in `public/icons/` directory

### Build Failures
1. Check for SVG syntax errors in source files
2. Ensure all dependencies are installed: `npm install`
3. Try regenerating icons: `npm run generate-icons`

### Performance Issues
1. Use the watch mode for development: `npm run dev:watch`
2. Check if sprite sheet is being cached properly
3. Verify icons are using the sprite sheet, not individual files

## 📈 Icon Statistics

- **Total Icons**: 525+ SVG files processed
- **Categories**: 
  - Equipment (131 icons)
  - Enemies (182 icons)
  - NPCs (42 icons)
  - Environment (14 icons)
  - UI Elements (156+ icons)
- **File Size**: Optimized sprite sheet with minimal overhead
- **Load Time**: Instant (single cached request)
