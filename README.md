# claude-memd

A lightweight companion plugin for [claude-mem](https://github.com/thedotmack/claude-mem) that provides **view and delete functionality** on port **27778**.

## Features

- **View Memory Records**: Browse observations, summaries, and prompts
- **Delete Functionality**: Delete individual records, batch delete, or delete entire projects
- **Web UI**: Built-in viewer interface at http://localhost:27778
- **MCP Tools**: Delete tools for Claude Code integration
- **Non-invasive**: Independent installation, doesn't modify claude-mem

## Requirements

- [claude-mem](https://github.com/thedotmack/claude-mem) must be installed first
- [Bun](https://bun.sh/) runtime

## Installation

```bash
# Clone the repository
git clone https://github.com/jamesturingmoore/claude-memd.git
cd claude-memd

# Install dependencies
bun install

# Start HTTP server (for web viewer)
bun start http

# Or start MCP server (for Claude Code integration)
bun start mcp
```

## Usage

### Web Viewer

Start the HTTP server and open http://localhost:27778 in your browser:

```bash
bun src/index.ts http
```

Features:
- Browse observations, summaries, and prompts
- Filter by project
- Delete individual records (two-click confirmation)
- Delete entire projects

### MCP Tools

Configure in your Claude Code settings:

```json
{
  "mcpServers": {
    "claude-memd": {
      "command": "bun",
      "args": ["run", "/path/to/claude-memd/src/index.ts", "mcp"]
    }
  }
}
```

Available tools:
- `mem-delete`: Delete a record by type and ID
- `mem-delete-project`: Delete all records for a project
- `mem-delete-batch`: Batch delete multiple records

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/stats` | GET | Database statistics |
| `/api/projects` | GET | List all projects |
| `/api/observations` | GET | List observations |
| `/api/observation/:id` | GET | Get observation by ID |
| `/api/observation/:id` | DELETE | Delete observation |
| `/api/observations/batch-delete` | POST | Batch delete observations |
| `/api/summaries` | GET | List summaries |
| `/api/summary/:id` | DELETE | Delete summary |
| `/api/summaries/batch-delete` | POST | Batch delete summaries |
| `/api/prompts` | GET | List prompts |
| `/api/prompt/:id` | DELETE | Delete prompt |
| `/api/prompts/batch-delete` | POST | Batch delete prompts |
| `/api/project/:name/records` | DELETE | Delete all project records |
| `/api/sse` | GET | Server-Sent Events |

## Testing

```bash
# Run all tests
bun test

# Run specific test suites
bun test tests/setup.test.ts
bun test tests/api.test.ts
bun test tests/integration.test.ts
```

## Architecture

```
claude-memd (Port 27778)
├── HTTP Server (Express)
│   ├── REST API endpoints
│   ├── Viewer UI
│   └── SSE for real-time updates
├── MCP Server (stdio)
│   └── Delete tools only
└── Database Layer
    └── Shared SQLite (~/.claude-mem/claude-mem.db)
```

## License

MIT
