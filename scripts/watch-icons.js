#!/usr/bin/env node

const { execSync } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');

console.log('👀 Watching for SVG changes...\n');

// Watch the icons directory for changes
const iconsDir = path.join(__dirname, '../public/icons');
const watcher = chokidar.watch(iconsDir, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true, // Don't trigger on initial scan
  awaitWriteFinish: {
    stabilityThreshold: 1000, // Wait 1 second after file stops changing
    pollInterval: 100
  }
});

let isGenerating = false;
let debounceTimer = null;

const generateIcons = async () => {
  if (isGenerating) return;
  
  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Debounce the generation to prevent rapid rebuilds
  debounceTimer = setTimeout(async () => {
    if (isGenerating) return;
    
    isGenerating = true;
    console.log('🔄 SVG files changed, regenerating sprite sheet...');
    
    try {
      execSync('node scripts/generate-sprite-sheet.js', { stdio: 'inherit' });
      console.log('✅ Sprite sheet regenerated successfully\n');
    } catch (error) {
      console.error('❌ Failed to regenerate sprite sheet:', error.message);
    } finally {
      isGenerating = false;
    }
  }, 2000); // Wait 2 seconds after last change
};

// Watch for changes
watcher
  .on('add', (filePath) => {
    if (filePath.endsWith('.svg')) {
      console.log(`📁 New SVG added: ${path.relative(iconsDir, filePath)}`);
      generateIcons();
    }
  })
  .on('change', (filePath) => {
    if (filePath.endsWith('.svg')) {
      console.log(`📝 SVG modified: ${path.relative(iconsDir, filePath)}`);
      generateIcons();
    }
  })
  .on('unlink', (filePath) => {
    if (filePath.endsWith('.svg')) {
      console.log(`🗑️  SVG removed: ${path.relative(iconsDir, filePath)}`);
      generateIcons();
    }
  })
  .on('error', (error) => {
    console.error('❌ Watcher error:', error);
  });

console.log(`Watching: ${iconsDir}`);
console.log('Press Ctrl+C to stop watching\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Stopping icon watcher...');
  watcher.close();
  process.exit(0);
});
