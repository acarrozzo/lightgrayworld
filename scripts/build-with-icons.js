#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting build process with icon generation...\n');

try {
  // Step 1: Generate sprite sheet
  console.log('📦 Step 1: Generating sprite sheet...');
  execSync('node scripts/generate-sprite-sheet.js', { stdio: 'inherit' });
  console.log('✅ Sprite sheet generated successfully\n');

  // Step 2: Verify sprite sheet exists
  const spritePath = path.join(__dirname, '../public/sprite-sheet.svg');
  const mappingsPath = path.join(__dirname, '../src/lib/icon-mappings.ts');
  
  if (!fs.existsSync(spritePath)) {
    throw new Error('Sprite sheet was not generated');
  }
  
  if (!fs.existsSync(mappingsPath)) {
    throw new Error('Icon mappings were not generated');
  }
  
  console.log('✅ Generated files verified\n');

  // Step 3: Run Next.js build
  console.log('🏗️  Step 2: Building Next.js application...');
  execSync('next build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully\n');

  console.log('🎉 Build process completed successfully!');
  console.log('📁 Generated files:');
  console.log('   - public/sprite-sheet.svg');
  console.log('   - src/lib/icon-mappings.ts');
  console.log('   - .next/ (Next.js build output)');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
