/**
 * MCP Server for claude-memd
 * Provides delete-only tools via Model Context Protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { DatabaseStore } from '../db/database.js';
import { logger } from '../utils/logger.js';

const SERVER_NAME = 'claude-memd';
const SERVER_VERSION = '1.0.0';

// Worker API URL (local)
const WORKER_API_URL = `http://localhost:${process.env.CLAUDE_MEMD_PORT || 37778}`;

/**
 * Call Worker HTTP API
 */
async function callWorkerAPI(endpoint: string, method: 'GET' | 'DELETE' | 'POST' = 'GET', body?: object): Promise<any> {
  const url = `${WORKER_API_URL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && (method === 'POST' || method === 'DELETE')) {
    options.body = JSON.stringify(body);
  }

  logger.debug('MCP', `Calling Worker API: ${method} ${endpoint}`);

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new McpError(
      ErrorCode.InternalError,
      `Worker API error: ${response.status} - ${errorText}`
    );
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return { success: true };
  }

  return JSON.parse(text);
}

/**
 * Create and configure MCP server
 */
export function createMcpServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'mem-delete',
          description: 'Delete a memory record (observation, summary, or prompt) by ID. Use this to remove incorrect or sensitive data.',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['observation', 'summary', 'prompt'],
                description: 'Type of record to delete',
              },
              id: {
                type: 'number',
                description: 'ID of the record to delete',
              },
            },
            required: ['type', 'id'],
          },
        },
        {
          name: 'mem-delete-project',
          description: 'Delete ALL memory records for a specific project. WARNING: This cannot be undone.',
          inputSchema: {
            type: 'object',
            properties: {
              project: {
                type: 'string',
                description: 'Name of the project to delete all records for',
              },
            },
            required: ['project'],
          },
        },
        {
          name: 'mem-delete-batch',
          description: 'Batch delete multiple memory records by IDs.',
          inputSchema: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['observation', 'summary', 'prompt'],
                description: 'Type of records to delete',
              },
              ids: {
                type: 'array',
                items: { type: 'number' },
                description: 'Array of IDs to delete',
              },
            },
            required: ['type', 'ids'],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info('MCP', `Tool called: ${name}`, args);

    try {
      switch (name) {
        case 'mem-delete': {
          const { type, id } = args as { type: 'observation' | 'summary' | 'prompt'; id: number };

          if (typeof id !== 'number') {
            throw new McpError(ErrorCode.InvalidParams, 'id must be a number');
          }

          if (!['observation', 'summary', 'prompt'].includes(type)) {
            throw new McpError(ErrorCode.InvalidParams, 'type must be observation, summary, or prompt');
          }

          const endpoint = `/api/${type}/${id}`;
          const result = await callWorkerAPI(endpoint, 'DELETE');

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'mem-delete-project': {
          const { project } = args as { project: string };

          if (!project || typeof project !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, 'project must be a non-empty string');
          }

          const encodedProject = encodeURIComponent(project);
          const endpoint = `/api/project/${encodedProject}/records`;
          const result = await callWorkerAPI(endpoint, 'DELETE');

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'mem-delete-batch': {
          const { type, ids } = args as { type: 'observation' | 'summary' | 'prompt'; ids: number[] };

          if (!Array.isArray(ids) || ids.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, 'ids must be a non-empty array');
          }

          if (!['observation', 'summary', 'prompt'].includes(type)) {
            throw new McpError(ErrorCode.InvalidParams, 'type must be observation, summary, or prompt');
          }

          const endpoint = `/api/${type}s/batch-delete`;
          const result = await callWorkerAPI(endpoint, 'POST', { ids });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      logger.error('MCP', `Tool ${name} failed`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  return server;
}

/**
 * Start MCP server with stdio transport
 */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info('MCP', `${SERVER_NAME} v${SERVER_VERSION} MCP server started`);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('MCP', 'Shutting down...');
    await server.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('MCP', 'Shutting down...');
    await server.close();
    process.exit(0);
  });
}
