---
name: agent-whiteboard-dev
description: Development workflow for agent-whiteboard project
---

# Agent Whiteboard Development Workflow

## Project Structure

- **mcp-client/** - Browser UI (TypeScript + Vite)
- **mcp-server-go/** - Go MCP server with embedded UI
- **src/** - Core drawing library (TypeScript)
- **npm-platforms/** - Platform-specific binaries

## Development Cycle

### Making Changes to Browser UI

1. Edit files in `mcp-client/`
2. Build: `npm run build:mcp-client` (quick) OR `make build` (full, recommended)
3. Stop the whiteboard server (see "Stopping the Server" below)
4. Reconnect MCP in Claude Code
5. Test with whiteboard draw tool

### Key Commands

- **Quick client rebuild**: `npm run build:mcp-client`
- **Full build** (client + Go server + all platforms): `make build`
- **Stop server safely**: See "Stopping the Server" section below

### Stopping the Server

The server listens on a port stored in the `PORT` environment variable. To stop it safely without killing other processes:

```bash
# Find whiteboard processes (exclude tsserver/typingsInstaller)
ps aux | grep whiteboard | grep -v grep | grep -v tsserver

# Kill only whiteboard processes
kill -9 <pids>
```

**IMPORTANT**: Only kill processes that are clearly whiteboard-related:
- `npm exec @choonkeat/agent-whiteboard`
- `sh -c "agent-whiteboard"`
- `node /home/app/.swe-swe/bin/agent-whiteboard`
- `/repos/agent-whiteboard/workspace/npm-platforms/linux-x64/bin/agent-whiteboard`

Do NOT kill TypeScript language server processes (tsserver, typingsInstaller).

### Important Notes

- Always run `make build` to embed the updated client into Go server
- Must reconnect MCP after rebuilding for changes to take effect
- Server uses **lazy startup** - HTTP starts on first draw call
- Built client is embedded in `mcp-server-go/mcp-client-dist/`

## Testing Workflow

1. Make changes to `mcp-client/mcp-client.ts` or CSS/HTML
2. Run `make build`
3. Stop existing whiteboard server (see "Stopping the Server")
4. Reconnect MCP server in Claude Code
5. Use `mcp_whiteboard_draw` tool to test changes

## Common Files

- `mcp-client/mcp-client.ts` - Main browser application logic
- `mcp-client/mcp-client.css` - UI styling
- `mcp-client/index.html` - HTML structure
- `mcp-server-go/main.go` - Go server orchestration
- `mcp-server-go/tools.go` - MCP tool definitions

## Architecture

- **2-canvas rendering** - Persist + Display canvases
- **Progressive animation** - Arc-length based smooth drawing
- **Event bus** - Pub/sub for WebSocket communication
- **Session recording** - Automatic slide history
