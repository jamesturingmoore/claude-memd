# claude-memd

<h3 align="center">Delete Companion for Claude-Mem</h3>

<p align="center">
  <strong>View and delete memory records on port 37778</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/version-1.0.1-green.svg" alt="Version"></a>
  <a href="https://github.com/jamesturingmoore/claude-memd"><img src="https://img.shields.io/badge/Claude%20Code-Plugin-purple.svg" alt="Claude Code Plugin"></a>
</p>

---

## Quick Start

### Prerequisites

> **⚠️ IMPORTANT:** claude-memd requires [claude-mem](https://github.com/thedotmack/claude-mem) to be installed first!

### Install claude-mem (if not already installed)

```bash
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```

### Install claude-memd

```bash
/plugin marketplace add jamesturingmoore/claude-memd
/plugin install claude-memd@jamesturingmoore
```

### Verify Installation

```bash
# Check claude-mem is running on port 37777
curl http://localhost:37777/api/health

# Check claude-memd is running on port 37778
curl http://localhost:37778/api/health

# Open web viewer
open http://localhost:37778
```

---

## Key Features

- 🗑️ **Delete Records** - Remove individual observations, summaries, or prompts
- 📦 **Batch Delete** - Delete multiple records at once
- 📁 **Project Delete** - Delete all records for a project
- 🖥️ **Web Viewer UI** - Browse and delete at http://localhost:37778
- 🔧 **MCP Tools** - Delete via Claude Code commands
- 🔄 **Auto-start** - Worker starts automatically via hooks
- 🔒 **Non-invasive** - Safe to install/uninstall without affecting claude-mem

---

## How It Works

**Architecture:**

```
claude-mem (37777)          claude-memd (37778)
      │                           │
      │     Shared Database       │
      └───────────┬───────────────┘
                  │
        ~/.claude-mem/claude-mem.db
```

- **Shared Database**: Uses same SQLite database as claude-mem
- **Independent Worker**: Runs on separate port 37778
- **Delete Sync**: Deletions sync to claude-mem immediately

---

## MCP Tools

claude-memd provides **3 MCP tools** for deletion:

| Tool | Description |
|------|-------------|
| **`mem-delete`** | Delete a single record by type and ID |
| **`mem-delete-project`** | Delete all records for a project |
| **`mem-delete-batch`** | Batch delete multiple records |

**Example Usage in Claude Code:**

```
> Delete observation #123
→ Uses mem-delete tool

> Delete all records for project "my-old-project"
→ Uses mem-delete-project tool

> Delete observations 101, 102, 103
→ Uses mem-delete-batch tool
```

---

## Web Viewer

Open **http://localhost:37778** in your browser to:

- Browse all observations, summaries, and prompts
- Filter by project
- Delete individual records (two-click confirmation)
- Delete entire projects

---

## Uninstall

```bash
/plugin uninstall claude-memd
```

> **Note:** Uninstalling claude-memd does NOT affect claude-mem or your data. The shared database remains intact.

---

## System Requirements

| Requirement | Version |
|-------------|---------|
| **claude-mem** | Any version |
| **Claude Code** | Latest with plugin support |
| **Bun** | ≥1.0.0 (auto-installed) |
| **Node.js** | ≥18.0.0 |

---

## Troubleshooting

### Worker not starting?

```bash
# Check if port 37778 is in use
lsof -i :37778

# Manual start
cd ~/.claude/plugins/marketplaces/jamesturingmoore/claude-memd
bun src/index.ts http
```

### Can't connect to claude-mem?

Make sure claude-mem is running:
```bash
curl http://localhost:37777/api/health
```

---

## License

MIT © James Moore

---

## Links

- **Repository**: https://github.com/jamesturingmoore/claude-memd
- **Issues**: https://github.com/jamesturingmoore/claude-memd/issues
- **claude-mem**: https://github.com/thedotmack/claude-mem
