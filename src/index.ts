#!/usr/bin/env node
/**
 * claude-memd - Delete companion for claude-mem
 *
 * Entry point - starts HTTP server and/or MCP server based on arguments
 */

import { HttpServer } from './server/http-server.js';
import { startMcpServer } from './server/mcp-server.js';
import { logger } from './utils/logger.js';

const MODE = process.argv[2] || 'http';

async function main(): Promise<void> {
  logger.info('MAIN', 'claude-memd starting...');
  logger.info('MAIN', `Mode: ${MODE}`);

  if (MODE === 'mcp') {
    // MCP mode - for Claude Code integration via stdio
    await startMcpServer();
  } else {
    // HTTP mode - for web viewer
    const httpServer = new HttpServer();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('MAIN', 'Shutting down HTTP server...');
      await httpServer.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('MAIN', 'Shutting down HTTP server...');
      await httpServer.stop();
      process.exit(0);
    });

    await httpServer.start();
  }
}

main().catch((error) => {
  logger.error('MAIN', 'Fatal error', { message: error?.message, stack: error?.stack });
  console.error('Full error:', error);
  process.exit(1);
});
