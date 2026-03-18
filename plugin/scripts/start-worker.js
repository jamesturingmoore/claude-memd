#!/usr/bin/env node
/**
 * Start Worker Script for claude-memd
 *
 * This script is called by Claude Code hooks to start the HTTP worker
 * if it's not already running.
 */

const http = require('http');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.CLAUDE_MEMD_PORT || 37778;
const PID_FILE = path.join(os.homedir(), '.claude-memd', 'worker.pid');
const LOG_DIR = path.join(os.homedir(), '.claude-memd', 'logs');

// Ensure directories exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Check if worker is already running
async function isWorkerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/health',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Get plugin root directory
function getPluginRoot() {
  // Try environment variable first
  if (process.env.CLAUDE_PLUGIN_ROOT) {
    return process.env.CLAUDE_PLUGIN_ROOT;
  }

  // Try to find from script location
  const scriptDir = path.dirname(__filename);
  const pluginRoot = path.join(scriptDir, '..');

  if (fs.existsSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'))) {
    return pluginRoot;
  }

  // Fallback to current directory
  return process.cwd();
}

// Start the worker
async function startWorker() {
  console.log('[claude-memd] Checking worker status...');

  // Check if already running
  if (await isWorkerRunning()) {
    console.log('[claude-memd] Worker already running on port', PORT);
    return;
  }

  console.log('[claude-memd] Starting worker on port', PORT);

  // Ensure directories
  ensureDir(LOG_DIR);
  ensureDir(path.dirname(PID_FILE));

  // Get paths
  const pluginRoot = getPluginRoot();
  const projectRoot = path.dirname(pluginRoot);
  const indexPath = path.join(projectRoot, 'src', 'index.ts');

  // Find bun executable
  let bunPath = 'bun';
  const bunPaths = [
    path.join(os.homedir(), '.bun', 'bin', 'bun'),
    '/usr/local/bin/bun',
    '/opt/homebrew/bin/bun'
  ];

  for (const p of bunPaths) {
    if (fs.existsSync(p)) {
      bunPath = p;
      break;
    }
  }

  // Create log file
  const date = new Date().toISOString().slice(0, 10);
  const logFile = path.join(LOG_DIR, `worker-${date}.log`);

  // Start worker process
  const worker = spawn(bunPath, [indexPath, 'http'], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')]
  });

  worker.unref();

  // Write PID
  fs.writeFileSync(PID_FILE, worker.pid.toString());

  console.log('[claude-memd] Worker started (PID:', worker.pid, ')');
  console.log('[claude-memd] Logs:', logFile);

  // Wait for worker to be ready
  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (await isWorkerRunning()) {
      console.log('[claude-memd] Worker is ready on port', PORT);
      return;
    }
    attempts++;
  }

  console.error('[claude-memd] Worker failed to start within timeout');
}

// Main
startWorker().catch(err => {
  console.error('[claude-memd] Failed to start worker:', err.message);
  process.exit(1);
});
