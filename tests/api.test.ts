/**
 * API Tests - Test all API endpoints
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

const API_BASE = 'http://localhost:37778';

describe('API Tests', () => {
  describe('Health & Stats', () => {
    test('GET /api/health', async () => {
      const response = await fetch(`${API_BASE}/api/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.port).toBe(37778);
    });

    test('GET /api/stats', async () => {
      const response = await fetch(`${API_BASE}/api/stats`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.worker).toBeDefined();
      expect(data.database).toBeDefined();
      expect(typeof data.database.observations).toBe('number');
      expect(typeof data.database.summaries).toBe('number');
      expect(typeof data.database.prompts).toBe('number');
    });

    test('GET /api/projects', async () => {
      const response = await fetch(`${API_BASE}/api/projects`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data.projects)).toBe(true);
    });
  });

  describe('Observations API', () => {
    test('GET /api/observations', async () => {
      const response = await fetch(`${API_BASE}/api/observations?limit=5`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(5);
    });

    test('GET /api/observations with offset', async () => {
      const response1 = await fetch(`${API_BASE}/api/observations?limit=2&offset=0`);
      const data1 = await response1.json();

      const response2 = await fetch(`${API_BASE}/api/observations?limit=2&offset=2`);
      const data2 = await response2.json();

      // Different pages should have different data (unless DB has < 4 records)
      if (data1.length === 2 && data2.length > 0) {
        expect(data1[0].id).not.toBe(data2[0].id);
      }
    });

    test('GET /api/observation/:id - 404 for non-existent', async () => {
      const response = await fetch(`${API_BASE}/api/observation/999999999`);
      expect(response.status).toBe(404);
    });

    test('GET /api/observation/:id - 400 for invalid ID', async () => {
      const response = await fetch(`${API_BASE}/api/observation/invalid`);
      expect(response.status).toBe(400);
    });
  });

  describe('Summaries API', () => {
    test('GET /api/summaries', async () => {
      const response = await fetch(`${API_BASE}/api/summaries?limit=5`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(5);
    });

    test('GET /api/summary/:id - 404 for non-existent', async () => {
      const response = await fetch(`${API_BASE}/api/summary/999999999`);
      expect(response.status).toBe(404);
    });
  });

  describe('Prompts API', () => {
    test('GET /api/prompts', async () => {
      const response = await fetch(`${API_BASE}/api/prompts?limit=5`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeLessThanOrEqual(5);
    });

    test('GET /api/prompt/:id - 404 for non-existent', async () => {
      const response = await fetch(`${API_BASE}/api/prompt/999999999`);
      expect(response.status).toBe(404);
    });
  });

  describe('Delete Operations', () => {
    // Note: These tests require actual data and will modify the database
    // We'll use a test project or find an existing record to test with

    test('DELETE /api/observation/:id - 404 for non-existent', async () => {
      const response = await fetch(`${API_BASE}/api/observation/999999999`, {
        method: 'DELETE'
      });
      expect(response.status).toBe(404);
    });

    test('DELETE /api/summary/:id - 404 for non-existent', async () => {
      const response = await fetch(`${API_BASE}/api/summary/999999999`, {
        method: 'DELETE'
      });
      expect(response.status).toBe(404);
    });

    test('DELETE /api/prompt/:id - 404 for non-existent', async () => {
      const response = await fetch(`${API_BASE}/api/prompt/999999999`, {
        method: 'DELETE'
      });
      expect(response.status).toBe(404);
    });

    test('POST /api/observations/batch-delete - 400 for empty ids', async () => {
      const response = await fetch(`${API_BASE}/api/observations/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [] })
      });
      expect(response.status).toBe(400);
    });

    test('POST /api/summaries/batch-delete - 400 for empty ids', async () => {
      const response = await fetch(`${API_BASE}/api/summaries/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [] })
      });
      expect(response.status).toBe(400);
    });

    test('POST /api/prompts/batch-delete - 400 for empty ids', async () => {
      const response = await fetch(`${API_BASE}/api/prompts/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [] })
      });
      expect(response.status).toBe(400);
    });
  });

  describe('Viewer UI', () => {
    test('GET / returns HTML', async () => {
      const response = await fetch(`${API_BASE}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');

      const html = await response.text();
      expect(html).toContain('claude-memd');
    });
  });
});
