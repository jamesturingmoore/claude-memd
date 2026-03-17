/**
 * Database layer for claude-memd
 * Connects to shared SQLite database at ~/.claude-mem/claude-mem.db
 * Provides query and delete operations (no insert/update)
 */

import { Database } from 'bun:sqlite';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, statSync } from 'fs';
import { logger } from '../utils/logger.js';

// Database path - shared with claude-mem
export const DATA_DIR = join(homedir(), '.claude-mem');
export const DB_PATH = join(DATA_DIR, 'claude-mem.db');

// Types
export interface ObservationRecord {
  id: number;
  memory_session_id: string;
  project: string;
  text: string | null;
  type: string;
  title?: string;
  subtitle?: string;
  facts?: string;
  narrative?: string;
  concepts?: string;
  files_read?: string;
  files_modified?: string;
  prompt_number?: number;
  discovery_tokens?: number;
  content_hash?: string;
  created_at: string;
  created_at_epoch: number;
}

export interface SessionSummaryRecord {
  id: number;
  memory_session_id: string;
  project: string;
  request?: string;
  investigated?: string;
  learned?: string;
  completed?: string;
  next_steps?: string;
  notes?: string;
  files_read?: string;
  files_edited?: string;
  discovery_tokens?: number;
  prompt_number?: number;
  created_at: string;
  created_at_epoch: number;
}

export interface UserPromptRecord {
  id: number;
  content_session_id: string;
  prompt_number: number;
  prompt_text: string;
  project?: string;
  created_at: string;
  created_at_epoch: number;
}

export interface SdkSessionRecord {
  id: number;
  content_session_id: string;
  memory_session_id?: string;
  project: string;
  user_prompt?: string;
  worker_port?: number;
  prompt_counter?: number;
  started_at: string;
  started_at_epoch: number;
  completed_at?: string;
  completed_at_epoch?: number;
  status: 'active' | 'completed' | 'failed';
}

export interface DatabaseStats {
  observations: number;
  summaries: number;
  prompts: number;
  sessions: number;
  dbSize: number;
  dbPath: string;
}

/**
 * Database store class
 * Read-only queries + delete operations
 */
export class DatabaseStore {
  private db: Database;
  private static instance: DatabaseStore | null;

  private constructor() {
    // Ensure data directory exists
    if (!existsSync(DATA_DIR)) {
      throw new Error(`claude-mem data directory not found: ${DATA_DIR}. Please install claude-mem first.`);
    }

    // Connect to database
    this.db = new Database(DB_PATH);

    // Enable WAL mode for concurrent access
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA foreign_keys = ON');

    logger.info('DATABASE', `Connected to claude-mem database: ${DB_PATH}`);
  }

  static getInstance(): DatabaseStore {
    if (!DatabaseStore.instance) {
      DatabaseStore.instance = new DatabaseStore();
    }
    return DatabaseStore.instance;
  }

  // ============ Query Methods ============

  /**
   * Get database statistics
   */
  getStats(): DatabaseStats {
    const observations = this.db.prepare('SELECT COUNT(*) as count FROM observations').get() as { count: number };
    const summaries = this.db.prepare('SELECT COUNT(*) as count FROM session_summaries').get() as { count: number };
    const prompts = this.db.prepare('SELECT COUNT(*) as count FROM user_prompts').get() as { count: number };
    const sessions = this.db.prepare('SELECT COUNT(*) as count FROM sdk_sessions').get() as { count: number };

    let dbSize = 0;
    if (existsSync(DB_PATH)) {
      dbSize = statSync(DB_PATH).size;
    }

    return {
      observations: observations.count,
      summaries: summaries.count,
      prompts: prompts.count,
      sessions: sessions.count,
      dbSize,
      dbPath: DB_PATH
    };
  }

  /**
   * Get all projects
   */
  getProjects(): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT project
      FROM observations
      WHERE project IS NOT NULL
      GROUP BY project
      ORDER BY MAX(created_at_epoch) DESC
    `).all() as Array<{ project: string }>;

    return rows.map(row => row.project);
  }

  /**
   * Get observations with pagination
   */
  getObservations(limit = 20, offset = 0, project?: string): ObservationRecord[] {
    let sql = `
      SELECT * FROM observations
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (project) {
      sql += ' AND project = ?';
      params.push(project);
    }

    sql += ' ORDER BY created_at_epoch DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params) as ObservationRecord[];
  }

  /**
   * Get observation by ID
   */
  getObservationById(id: number): ObservationRecord | null {
    const stmt = this.db.prepare('SELECT * FROM observations WHERE id = ? LIMIT 1');
    return stmt.get(id) as ObservationRecord | null;
  }

  /**
   * Get observations by IDs
   */
  getObservationsByIds(ids: number[]): ObservationRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`SELECT * FROM observations WHERE id IN (${placeholders}) ORDER BY created_at_epoch DESC`);
    return stmt.all(...ids) as ObservationRecord[];
  }

  /**
   * Get summaries with pagination
   */
  getSummaries(limit = 20, offset = 0, project?: string): SessionSummaryRecord[] {
    let sql = 'SELECT * FROM session_summaries WHERE 1=1';
    const params: (string | number)[] = [];

    if (project) {
      sql += ' AND project = ?';
      params.push(project);
    }

    sql += ' ORDER BY created_at_epoch DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params) as SessionSummaryRecord[];
  }

  /**
   * Get summary by ID
   */
  getSummaryById(id: number): SessionSummaryRecord | null {
    const stmt = this.db.prepare('SELECT * FROM session_summaries WHERE id = ? LIMIT 1');
    return stmt.get(id) as SessionSummaryRecord | null;
  }

  /**
   * Get prompts with pagination
   */
  getPrompts(limit = 20, offset = 0, project?: string): UserPromptRecord[] {
    let sql = `
      SELECT up.*, ss.project
      FROM user_prompts up
      LEFT JOIN sdk_sessions ss ON up.content_session_id = ss.content_session_id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (project) {
      sql += ' AND ss.project = ?';
      params.push(project);
    }

    sql += ' ORDER BY up.created_at_epoch DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return this.db.prepare(sql).all(...params) as UserPromptRecord[];
  }

  /**
   * Get prompt by ID
   */
  getPromptById(id: number): UserPromptRecord | null {
    const stmt = this.db.prepare(`
      SELECT up.*, ss.project
      FROM user_prompts up
      LEFT JOIN sdk_sessions ss ON up.content_session_id = ss.content_session_id
      WHERE up.id = ?
      LIMIT 1
    `);
    return stmt.get(id) as UserPromptRecord | null;
  }

  /**
   * Get prompts by IDs
   */
  getPromptsByIds(ids: number[]): UserPromptRecord[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT up.*, ss.project
      FROM user_prompts up
      LEFT JOIN sdk_sessions ss ON up.content_session_id = ss.content_session_id
      WHERE up.id IN (${placeholders})
      ORDER BY up.created_at_epoch DESC
    `);
    return stmt.all(...ids) as UserPromptRecord[];
  }

  // ============ Delete Methods ============

  /**
   * Delete an observation by ID
   * FTS5 trigger and observation_audit trigger automatically handle cascade deletes
   */
  deleteObservation(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM observations WHERE id = ?');
    const result = stmt.run(id);
    logger.info('DATABASE', `Deleted observation #${id}`, { changes: result.changes });
    return result.changes > 0;
  }

  /**
   * Delete a summary by ID
   */
  deleteSummary(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM session_summaries WHERE id = ?');
    const result = stmt.run(id);
    logger.info('DATABASE', `Deleted summary #${id}`, { changes: result.changes });
    return result.changes > 0;
  }

  /**
   * Delete a prompt by ID
   */
  deletePrompt(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM user_prompts WHERE id = ?');
    const result = stmt.run(id);
    logger.info('DATABASE', `Deleted prompt #${id}`, { changes: result.changes });
    return result.changes > 0;
  }

  /**
   * Batch delete observations by IDs
   */
  deleteObservationsByIds(ids: number[]): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM observations WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    logger.info('DATABASE', `Batch deleted ${result.changes} observations`);
    return result.changes;
  }

  /**
   * Batch delete summaries by IDs
   */
  deleteSummariesByIds(ids: number[]): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM session_summaries WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    logger.info('DATABASE', `Batch deleted ${result.changes} summaries`);
    return result.changes;
  }

  /**
   * Batch delete prompts by IDs
   */
  deletePromptsByIds(ids: number[]): number {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`DELETE FROM user_prompts WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    logger.info('DATABASE', `Batch deleted ${result.changes} prompts`);
    return result.changes;
  }

  /**
   * Delete all records for a project
   */
  deleteAllByProject(project: string): { observations: number; summaries: number; prompts: number; sessions: number } {
    const obsStmt = this.db.prepare('DELETE FROM observations WHERE project = ?');
    const sumStmt = this.db.prepare('DELETE FROM session_summaries WHERE project = ?');

    // user_prompts doesn't have project column, need to join with sdk_sessions
    const promptStmt = this.db.prepare(`
      DELETE FROM user_prompts
      WHERE content_session_id IN (
        SELECT content_session_id FROM sdk_sessions WHERE project = ?
      )
    `);

    // Also delete sdk_sessions to remove project from getAllProjects()
    const sessionStmt = this.db.prepare('DELETE FROM sdk_sessions WHERE project = ?');

    const observations = obsStmt.run(project).changes;
    const summaries = sumStmt.run(project).changes;
    const prompts = promptStmt.run(project).changes;
    const sessions = sessionStmt.run(project).changes;

    logger.info('DATABASE', `Deleted all records for project "${project}"`, { observations, summaries, prompts, sessions });

    return { observations, summaries, prompts, sessions };
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      logger.info('DATABASE', 'Database connection closed');
    }
  }
}
