#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Trading Bot Server...');
console.log('📁 Working directory:', __dirname);

// Check if .env exists
import { existsSync } from 'fs';
const envPath = join(__dirname, '.env');

if (!existsSync(envPath)) {
  console.log('⚠️  .env file not found. Please copy env.example to .env and configure it.');
  console.log('📝 Run: cp env.example .env');
  process.exit(1);
}

// Create logs directory if it doesn't exist
import { mkdirSync } from 'fs';
const logsPath = join(__dirname, 'logs');
if (!existsSync(logsPath)) {
  mkdirSync(logsPath);
  console.log('📁 Created logs directory');
}

// Start the server
const server = spawn('node', ['src/index.js'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, NODE_ENV: 'development' }
});

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`);
    process.exit(code);
  }
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  server.kill('SIGTERM');
});
