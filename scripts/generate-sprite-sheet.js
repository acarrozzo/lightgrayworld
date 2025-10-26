const fs = require('fs');
const path = require('path');

// Function to recursively find all SVG files
function findSvgFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findSvgFiles(filePath, fileList);
    } else if (file.endsWith('.svg')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Function to extract SVG content and create symbol
function createSymbolFromSvg(svgPath, symbolId) {
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  // Extract viewBox from SVG
  const viewBoxMatch = svgContent.match(/viewBox="([^"]*)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
  
  // Extract the inner content (everything between <svg> tags)
  const innerContentMatch = svgContent.match(/<svg[^>]*>(.*)<\/svg>/s);
  const innerContent = innerContentMatch ? innerContentMatch[1] : '';
  
  // Clean up the content - remove fill and stroke attributes to allow CSS control
  const cleanedContent = innerContent
    .replace(/fill="[^"]*"/g, 'fill="currentColor"')
    .replace(/stroke="[^"]*"/g, 'stroke="currentColor"');
  
  return `  <symbol id="${symbolId}" viewBox="${viewBox}">
${cleanedContent}
  </symbol>`;
}

// Main function to generate sprite sheet
function generateSpriteSheet() {
  const svgDir = path.join(__dirname, '../public/icons');
  const outputPath = path.join(__dirname, '../public/sprite-sheet.svg');
  
  console.log('🔍 Finding SVG files...');
  const svgFiles = findSvgFiles(svgDir);
  console.log(`📁 Found ${svgFiles.length} SVG files`);
  
  const symbols = [];
  
  svgFiles.forEach(svgPath => {
    // Create symbol ID from file path
    const relativePath = path.relative(svgDir, svgPath);
    const symbolId = relativePath
      .replace(/\.svg$/, '')
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '');
    
    try {
      const symbol = createSymbolFromSvg(svgPath, symbolId);
      symbols.push(symbol);
      console.log(`✅ Processed: ${relativePath} -> ${symbolId}`);
    } catch (error) {
      console.error(`❌ Error processing ${svgPath}:`, error.message);
    }
  });
  
  // Create the sprite sheet SVG
  const spriteSheet = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: none;">
  <defs>
${symbols.join('\n\n')}
  </defs>
</svg>`;
  
  // Write the sprite sheet
  fs.writeFileSync(outputPath, spriteSheet);
  console.log(`🎉 Generated sprite sheet with ${symbols.length} icons at: ${outputPath}`);
  
  // Generate a TypeScript file with icon mappings
  const iconMappings = svgFiles.map(svgPath => {
    const relativePath = path.relative(svgDir, svgPath);
    const symbolId = relativePath
      .replace(/\.svg$/, '')
      .replace(/\//g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '');
    return `  '${symbolId}': '${symbolId}'`;
  });
  
  const mappingsContent = `// Auto-generated icon mappings
export const IconMappings = {
${iconMappings.join(',\n')}
} as const;

export type IconName = keyof typeof IconMappings;
`;
  
  fs.writeFileSync(path.join(__dirname, '../src/lib/icon-mappings.ts'), mappingsContent);
  console.log('📝 Generated icon mappings at: src/lib/icon-mappings.ts');
}

// Run the script
generateSpriteSheet();
