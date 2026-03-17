/**
 * Integration Tests - Test delete functionality with real database
 * WARNING: These tests will CREATE and DELETE records in the real database!
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

const API_BASE = 'http://localhost:27778';
const TEST_PROJECT = `__test_claude_memd_${Date.now()}`;

describe('Integration Tests', () => {
  // Get initial stats to track changes
  let initialStats: any;

  beforeAll(async () => {
    const response = await fetch(`${API_BASE}/api/stats`);
    initialStats = await response.json();
    console.log('Initial stats:', initialStats);
  });

  describe('Read Operations', () => {
    test('can list observations', async () => {
      const response = await fetch(`${API_BASE}/api/observations?limit=10`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log(`Found ${data.length} observations`);
    });

    test('can list summaries', async () => {
      const response = await fetch(`${API_BASE}/api/summaries?limit=10`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log(`Found ${data.length} summaries`);
    });

    test('can list prompts', async () => {
      const response = await fetch(`${API_BASE}/api/prompts?limit=10`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log(`Found ${data.length} prompts`);
    });
  });

  describe('Delete Operations with Real Data', () => {
    test('can delete an observation', async () => {
      // First, get an observation
      const listResponse = await fetch(`${API_BASE}/api/observations?limit=1`);
      const observations = await listResponse.json();

      if (observations.length === 0) {
        console.log('No observations to test delete');
        return;
      }

      const obs = observations[0];
      const obsId = obs.id;

      // Verify it exists
      const getResponse = await fetch(`${API_BASE}/api/observation/${obsId}`);
      expect(getResponse.status).toBe(200);

      // Delete it
      const deleteResponse = await fetch(`${API_BASE}/api/observation/${obsId}`, {
        method: 'DELETE'
      });
      expect(deleteResponse.status).toBe(200);

      const deleteData = await deleteResponse.json();
      expect(deleteData.success).toBe(true);
      expect(deleteData.id).toBe(obsId);

      // Verify it's gone
      const verifyResponse = await fetch(`${API_BASE}/api/observation/${obsId}`);
      expect(verifyResponse.status).toBe(404);

      console.log(`Successfully deleted observation #${obsId}`);
    });

    test('can delete a summary', async () => {
      // First, get a summary
      const listResponse = await fetch(`${API_BASE}/api/summaries?limit=1`);
      const summaries = await listResponse.json();

      if (summaries.length === 0) {
        console.log('No summaries to test delete');
        return;
      }

      const sum = summaries[0];
      const sumId = sum.id;

      // Delete it
      const deleteResponse = await fetch(`${API_BASE}/api/summary/${sumId}`, {
        method: 'DELETE'
      });
      expect(deleteResponse.status).toBe(200);

      const deleteData = await deleteResponse.json();
      expect(deleteData.success).toBe(true);

      // Verify it's gone
      const verifyResponse = await fetch(`${API_BASE}/api/summary/${sumId}`);
      expect(verifyResponse.status).toBe(404);

      console.log(`Successfully deleted summary #${sumId}`);
    });

    test('can delete a prompt', async () => {
      // First, get a prompt
      const listResponse = await fetch(`${API_BASE}/api/prompts?limit=1`);
      const prompts = await listResponse.json();

      if (prompts.length === 0) {
        console.log('No prompts to test delete');
        return;
      }

      const prompt = prompts[0];
      const promptId = prompt.id;

      // Delete it
      const deleteResponse = await fetch(`${API_BASE}/api/prompt/${promptId}`, {
        method: 'DELETE'
      });
      expect(deleteResponse.status).toBe(200);

      const deleteData = await deleteResponse.json();
      expect(deleteData.success).toBe(true);

      // Verify it's gone
      const verifyResponse = await fetch(`${API_BASE}/api/prompt/${promptId}`);
      expect(verifyResponse.status).toBe(404);

      console.log(`Successfully deleted prompt #${promptId}`);
    });

    test('can batch delete observations', async () => {
      // Get multiple observations
      const listResponse = await fetch(`${API_BASE}/api/observations?limit=5`);
      const observations = await listResponse.json();

      if (observations.length < 2) {
        console.log('Not enough observations for batch delete test');
        return;
      }

      const ids = observations.slice(0, 2).map((o: any) => o.id);

      // Batch delete
      const deleteResponse = await fetch(`${API_BASE}/api/observations/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      expect(deleteResponse.status).toBe(200);

      const deleteData = await deleteResponse.json();
      expect(deleteData.success).toBe(true);
      expect(deleteData.deletedCount).toBeGreaterThan(0);

      console.log(`Successfully batch deleted ${deleteData.deletedCount} observations`);
    });
  });

  describe('Project Delete Operations', () => {
    test('can delete project records (if project exists)', async () => {
      // Get a project from the list
      const projectsResponse = await fetch(`${API_BASE}/api/projects`);
      const projectsData = await projectsResponse.json();
      const projects = projectsData.projects || [];

      if (projects.length === 0) {
        console.log('No projects to test delete');
        return;
      }

      // Use the last project (probably least important)
      const projectToDelete = projects[projects.length - 1];

      // Get initial count for this project
      const obsResponse = await fetch(`${API_BASE}/api/observations?limit=100&project=${encodeURIComponent(projectToDelete)}`);
      const observations = await obsResponse.json();
      const initialCount = observations.length;

      if (initialCount === 0) {
        console.log(`Project "${projectToDelete}" has no observations, skipping`);
        return;
      }

      console.log(`Deleting project "${projectToDelete}" (${initialCount} observations)`);

      // Delete the project
      const deleteResponse = await fetch(`${API_BASE}/api/project/${encodeURIComponent(projectToDelete)}/records`, {
        method: 'DELETE'
      });
      expect(deleteResponse.status).toBe(200);

      const deleteData = await deleteResponse.json();
      expect(deleteData.success).toBe(true);
      expect(deleteData.project).toBe(projectToDelete);

      console.log('Delete result:', deleteData);

      // Verify project is gone from list
      const verifyProjectsResponse = await fetch(`${API_BASE}/api/projects`);
      const verifyProjectsData = await verifyProjectsResponse.json();
      expect(verifyProjectsData.projects).not.toContain(projectToDelete);
    });
  });

  describe('Concurrent Access', () => {
    test('can handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        fetch(`${API_BASE}/api/observations?limit=5`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.ok).toBe(true);
      });

      console.log('Handled 10 concurrent requests successfully');
    });

    test('database is still accessible after operations', async () => {
      const response = await fetch(`${API_BASE}/api/stats`);
      expect(response.ok).toBe(true);

      const stats = await response.json();
      console.log('Final stats:', stats);
    });
  });

  afterAll(async () => {
    const response = await fetch(`${API_BASE}/api/stats`);
    const finalStats = await response.json();
    console.log('Final stats:', finalStats);
    console.log('Change:', {
      observations: finalStats.database.observations - initialStats.database.observations,
      summaries: finalStats.database.summaries - initialStats.database.summaries,
      prompts: finalStats.database.prompts - initialStats.database.prompts
    });
  });
});
