#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting optimized development server...\n');

// Clean up any existing processes
const cleanup = () => {
  console.log('\n🧹 Cleaning up processes...');
  exec('pkill -f "node.*server.js"', () => {});
  exec('pkill -f "chokidar"', () => {});
  process.exit(0);
};

// Handle cleanup on exit
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Check if we should watch icons
const shouldWatchIcons = process.argv.includes('--watch-icons');

// Generate icons first
console.log('📦 Generating icons...');
exec('node scripts/generate-sprite-sheet.js', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Failed to generate icons:', error);
    process.exit(1);
  }
  
  console.log('✅ Icons generated successfully\n');
  
  // Start the main server
  console.log('🌐 Starting development server...');
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  
  // Start icon watcher if requested
  let iconWatcher = null;
  if (shouldWatchIcons) {
    console.log('👀 Starting icon watcher...');
    iconWatcher = spawn('node', ['scripts/watch-icons.js'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
  }
  
  // Handle server exit
  server.on('exit', (code) => {
    console.log(`\n🛑 Development server exited with code ${code}`);
    if (iconWatcher) {
      iconWatcher.kill();
    }
    process.exit(code);
  });
  
  // Handle icon watcher exit
  if (iconWatcher) {
    iconWatcher.on('exit', (code) => {
      console.log(`\n🛑 Icon watcher exited with code ${code}`);
    });
  }
});

// Keep the process alive
process.stdin.resume();
