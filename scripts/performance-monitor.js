#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('📊 Performance Monitor - Development Rebuild Tracker\n');

let rebuildCount = 0;
let totalRebuildTime = 0;
let maxRebuildTime = 0;
let minRebuildTime = Infinity;

// Monitor console output for Fast Refresh rebuilds
const monitorRebuilds = (output) => {
  const lines = output.split('\n');
  
  lines.forEach(line => {
    if (line.includes('[Fast Refresh] rebuilding')) {
      rebuildCount++;
      console.log(`🔄 Rebuild #${rebuildCount} started...`);
    }
    
    if (line.includes('[Fast Refresh] done in')) {
      const match = line.match(/done in (\d+)ms/);
      if (match) {
        const rebuildTime = parseInt(match[1]);
        totalRebuildTime += rebuildTime;
        maxRebuildTime = Math.max(maxRebuildTime, rebuildTime);
        minRebuildTime = Math.min(minRebuildTime, rebuildTime);
        
        const avgTime = Math.round(totalRebuildTime / rebuildCount);
        
        console.log(`✅ Rebuild #${rebuildCount} completed in ${rebuildTime}ms`);
        console.log(`📈 Stats: Avg: ${avgTime}ms | Max: ${maxRebuildTime}ms | Min: ${minRebuildTime}ms\n`);
        
        // Alert for slow rebuilds
        if (rebuildTime > 2000) {
          console.log(`⚠️  SLOW REBUILD ALERT: ${rebuildTime}ms (over 2 seconds)\n`);
        }
      }
    }
  });
};

// Start monitoring
const startMonitoring = () => {
  console.log('Starting development server with performance monitoring...\n');
  
  const server = spawn('node', ['server.js'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    cwd: path.join(__dirname, '..')
  });
  
  // Monitor stdout
  server.stdout.on('data', (data) => {
    const output = data.toString();
    process.stdout.write(output);
    monitorRebuilds(output);
  });
  
  // Monitor stderr
  server.stderr.on('data', (data) => {
    const output = data.toString();
    process.stderr.write(output);
    monitorRebuilds(output);
  });
  
  // Handle exit
  server.on('exit', (code) => {
    console.log(`\n📊 Final Performance Report:`);
    console.log(`   Total rebuilds: ${rebuildCount}`);
    console.log(`   Average time: ${Math.round(totalRebuildTime / rebuildCount)}ms`);
    console.log(`   Max time: ${maxRebuildTime}ms`);
    console.log(`   Min time: ${minRebuildTime}ms`);
    process.exit(code);
  });
  
  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping performance monitor...');
    server.kill();
    process.exit(0);
  });
};

startMonitoring();
