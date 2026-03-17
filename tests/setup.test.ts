/**
 * Setup Test - Verify claude-mem is installed and claude-memd can start
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DATA_DIR = join(homedir(), '.claude-mem');
const DB_PATH = join(DATA_DIR, 'claude-mem.db');

describe('Setup Tests', () => {
  test('claude-mem data directory exists', () => {
    expect(existsSync(DATA_DIR)).toBe(true);
  });

  test('claude-mem database exists', () => {
    expect(existsSync(DB_PATH)).toBe(true);
  });

  test('can connect to database', async () => {
    const { DatabaseStore } = await import('../src/db/database.js');
    const db = DatabaseStore.getInstance();
    expect(db).toBeDefined();

    const stats = db.getStats();
    expect(stats).toBeDefined();
    expect(stats.dbPath).toBe(DB_PATH);

    console.log('Database stats:', stats);
  });

  test('HTTP server health check', async () => {
    const response = await fetch('http://localhost:27778/api/health');
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.port).toBe(27778);

    console.log('Health check:', data);
  });

  test('can get stats via API', async () => {
    const response = await fetch('http://localhost:27778/api/stats');
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.worker).toBeDefined();
    expect(data.database).toBeDefined();

    console.log('Stats:', data);
  });

  test('can get projects via API', async () => {
    const response = await fetch('http://localhost:27778/api/projects');
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data.projects)).toBe(true);

    console.log('Projects:', data.projects);
  });
});
