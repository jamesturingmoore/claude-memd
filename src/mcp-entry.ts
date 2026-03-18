/**
 * MCP Server Entry Point for bundling
 */

import { startMcpServer } from './server/mcp-server.js';

startMcpServer().catch((error) => {
  console.error('MCP server failed:', error);
  process.exit(1);
});
