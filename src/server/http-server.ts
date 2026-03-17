/**
 * HTTP Server for claude-memd
 * Runs on port 27778 to avoid conflict with claude-mem (37777)
 */

import express, { Express, Request, Response } from 'express';
import { createServer } from 'http';
import { DatabaseStore } from '../db/database.js';
import { logger } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const DEFAULT_PORT = 27778;
const HOST = 'localhost';

// SSE clients for real-time updates
const sseClients: Set<Response> = new Set();

export interface HttpServerOptions {
  port?: number;
}

export class HttpServer {
  private app: Express;
  private server: ReturnType<typeof createServer>;
  private port: number;
  private db: DatabaseStore;
  private startTime: number;

  constructor(options: HttpServerOptions = {}) {
    this.port = options.port || parseInt(process.env.CLAUDE_MEMD_PORT || '', 10) || DEFAULT_PORT;
    this.startTime = Date.now();
    this.db = DatabaseStore.getInstance();

    // Create Express app
    this.app = express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // CORS for local development
    this.app.use((req: Request, res: Response, next: express.NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: express.NextFunction) => {
      logger.debug('HTTP', `${req.method} ${req.path}`);
      next();
    });

    // Setup routes
    this.setupRoutes();

    // Create HTTP server
    this.server = createServer(this.app);
  }

  private setupRoutes(): void {
    // ============ Health Check ============
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        port: this.port,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        timestamp: new Date().toISOString()
      });
    });

    // ============ Stats ============
    this.app.get('/api/stats', (req: Request, res: Response) => {
      try {
        const stats = this.db.getStats();
        res.json({
          worker: {
            version: '1.0.0',
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            port: this.port
          },
          database: stats
        });
      } catch (error) {
        logger.error('HTTP', 'Failed to get stats', error);
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    // ============ Projects ============
    this.app.get('/api/projects', (req: Request, res: Response) => {
      try {
        const projects = this.db.getProjects();
        res.json({ projects });
      } catch (error) {
        logger.error('HTTP', 'Failed to get projects', error);
        res.status(500).json({ error: 'Failed to get projects' });
      }
    });

    // ============ Observations ============
    this.app.get('/api/observations', (req: Request, res: Response) => {
      try {
        const offset = parseInt(req.query.offset as string, 10) || 0;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
        const project = req.query.project as string | undefined;

        const observations = this.db.getObservations(limit, offset, project);
        res.json(observations);
      } catch (error) {
        logger.error('HTTP', 'Failed to get observations', error);
        res.status(500).json({ error: 'Failed to get observations' });
      }
    });

    this.app.get('/api/observation/:id', (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid ID' });
          return;
        }

        const observation = this.db.getObservationById(id);
        if (!observation) {
          res.status(404).json({ error: `Observation #${id} not found` });
          return;
        }

        res.json(observation);
      } catch (error) {
        logger.error('HTTP', 'Failed to get observation', error);
        res.status(500).json({ error: 'Failed to get observation' });
      }
    });

    this.app.delete('/api/observation/:id', (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid ID' });
          return;
        }

        // Check if exists first
        const observation = this.db.getObservationById(id);
        if (!observation) {
          res.status(404).json({ error: `Observation #${id} not found` });
          return;
        }

        const deleted = this.db.deleteObservation(id);
        if (deleted) {
          // Broadcast deletion to SSE clients
          this.broadcastSSE({ type: 'observation_deleted', id });
          res.json({ success: true, id });
        } else {
          res.status(500).json({ error: 'Failed to delete observation' });
        }
      } catch (error) {
        logger.error('HTTP', 'Failed to delete observation', error);
        res.status(500).json({ error: 'Failed to delete observation' });
      }
    });

    this.app.post('/api/observations/batch-delete', (req: Request, res: Response) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          res.status(400).json({ error: 'ids must be a non-empty array' });
          return;
        }

        const deletedCount = this.db.deleteObservationsByIds(ids);
        this.broadcastSSE({ type: 'observations_batch_deleted', ids, count: deletedCount });
        res.json({ success: true, deletedCount, ids });
      } catch (error) {
        logger.error('HTTP', 'Failed to batch delete observations', error);
        res.status(500).json({ error: 'Failed to batch delete observations' });
      }
    });

    // ============ Summaries ============
    this.app.get('/api/summaries', (req: Request, res: Response) => {
      try {
        const offset = parseInt(req.query.offset as string, 10) || 0;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
        const project = req.query.project as string | undefined;

        const summaries = this.db.getSummaries(limit, offset, project);
        res.json(summaries);
      } catch (error) {
        logger.error('HTTP', 'Failed to get summaries', error);
        res.status(500).json({ error: 'Failed to get summaries' });
      }
    });

    this.app.get('/api/summary/:id', (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid ID' });
          return;
        }

        const summary = this.db.getSummaryById(id);
        if (!summary) {
          res.status(404).json({ error: `Summary #${id} not found` });
          return;
        }

        res.json(summary);
      } catch (error) {
        logger.error('HTTP', 'Failed to get summary', error);
        res.status(500).json({ error: 'Failed to get summary' });
      }
    });

    this.app.delete('/api/summary/:id', (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid ID' });
          return;
        }

        const summary = this.db.getSummaryById(id);
        if (!summary) {
          res.status(404).json({ error: `Summary #${id} not found` });
          return;
        }

        const deleted = this.db.deleteSummary(id);
        if (deleted) {
          this.broadcastSSE({ type: 'summary_deleted', id });
          res.json({ success: true, id });
        } else {
          res.status(500).json({ error: 'Failed to delete summary' });
        }
      } catch (error) {
        logger.error('HTTP', 'Failed to delete summary', error);
        res.status(500).json({ error: 'Failed to delete summary' });
      }
    });

    this.app.post('/api/summaries/batch-delete', (req: Request, res: Response) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          res.status(400).json({ error: 'ids must be a non-empty array' });
          return;
        }

        const deletedCount = this.db.deleteSummariesByIds(ids);
        this.broadcastSSE({ type: 'summaries_batch_deleted', ids, count: deletedCount });
        res.json({ success: true, deletedCount, ids });
      } catch (error) {
        logger.error('HTTP', 'Failed to batch delete summaries', error);
        res.status(500).json({ error: 'Failed to batch delete summaries' });
      }
    });

    // ============ Prompts ============
    this.app.get('/api/prompts', (req: Request, res: Response) => {
      try {
        const offset = parseInt(req.query.offset as string, 10) || 0;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
        const project = req.query.project as string | undefined;

        const prompts = this.db.getPrompts(limit, offset, project);
        res.json(prompts);
      } catch (error) {
        logger.error('HTTP', 'Failed to get prompts', error);
        res.status(500).json({ error: 'Failed to get prompts' });
      }
    });

    this.app.get('/api/prompt/:id', (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid ID' });
          return;
        }

        const prompt = this.db.getPromptById(id);
        if (!prompt) {
          res.status(404).json({ error: `Prompt #${id} not found` });
          return;
        }

        res.json(prompt);
      } catch (error) {
        logger.error('HTTP', 'Failed to get prompt', error);
        res.status(500).json({ error: 'Failed to get prompt' });
      }
    });

    this.app.delete('/api/prompt/:id', (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          res.status(400).json({ error: 'Invalid ID' });
          return;
        }

        const prompt = this.db.getPromptById(id);
        if (!prompt) {
          res.status(404).json({ error: `Prompt #${id} not found` });
          return;
        }

        const deleted = this.db.deletePrompt(id);
        if (deleted) {
          this.broadcastSSE({ type: 'prompt_deleted', id });
          res.json({ success: true, id });
        } else {
          res.status(500).json({ error: 'Failed to delete prompt' });
        }
      } catch (error) {
        logger.error('HTTP', 'Failed to delete prompt', error);
        res.status(500).json({ error: 'Failed to delete prompt' });
      }
    });

    this.app.post('/api/prompts/batch-delete', (req: Request, res: Response) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          res.status(400).json({ error: 'ids must be a non-empty array' });
          return;
        }

        const deletedCount = this.db.deletePromptsByIds(ids);
        this.broadcastSSE({ type: 'prompts_batch_deleted', ids, count: deletedCount });
        res.json({ success: true, deletedCount, ids });
      } catch (error) {
        logger.error('HTTP', 'Failed to batch delete prompts', error);
        res.status(500).json({ error: 'Failed to batch delete prompts' });
      }
    });

    // ============ Project Delete ============
    this.app.delete('/api/project/:name/records', (req: Request, res: Response) => {
      try {
        const project = decodeURIComponent(req.params.name);

        if (!project) {
          res.status(400).json({ error: 'Project name is required' });
          return;
        }

        const result = this.db.deleteAllByProject(project);

        // Broadcast deletion to SSE clients
        this.broadcastSSE({
          type: 'project_deleted',
          project,
          ...result
        });

        res.json({ success: true, project, ...result });
      } catch (error) {
        logger.error('HTTP', 'Failed to delete project records', error);
        res.status(500).json({ error: 'Failed to delete project records' });
      }
    });

    // ============ SSE Endpoint ============
    this.app.get('/api/sse', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send initial connected message
      res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

      // Add to clients set
      sseClients.add(res);

      // Handle client disconnect
      req.on('close', () => {
        sseClients.delete(res);
        logger.debug('SSE', 'Client disconnected');
      });
    });

    // ============ Viewer UI ============
    this.app.get('/', (req: Request, res: Response) => {
      try {
        // In development, read from viewer directory
        // In production, use embedded HTML
        const htmlPath = join(process.cwd(), 'viewer', 'index.html');
        const html = readFileSync(htmlPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
      } catch (error) {
        logger.error('HTTP', 'Failed to serve viewer', error);
        res.status(500).send('Failed to load viewer');
      }
    });
  }

  /**
   * Broadcast message to all SSE clients
   */
  private broadcastSSE(data: object): void {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(client => {
      try {
        client.write(message);
      } catch (error) {
        // Client might have disconnected
        sseClients.delete(client);
      }
    });
  }

  /**
   * Start the HTTP server
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, HOST, () => {
        logger.info('HTTP', `Server started on http://${HOST}:${this.port}`);
        logger.info('HTTP', `Viewer UI: http://${HOST}:${this.port}/`);
        logger.info('HTTP', `API docs: http://${HOST}:${this.port}/api/health`);
        resolve();
      }).on('error', reject);
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close all SSE clients
      sseClients.forEach(client => {
        try {
          client.end();
        } catch (e) {
          // Ignore
        }
      });
      sseClients.clear();

      this.server.close((error) => {
        if (error) {
          reject(error);
        } else {
          logger.info('HTTP', 'Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get the server port
   */
  getPort(): number {
    return this.port;
  }
}
