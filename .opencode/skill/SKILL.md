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
2. Run `make build` in the workspace root (automatically stops old server)
3. Reconnect MCP in Claude Code (server will auto-restart)
4. Test with whiteboard draw tool

### Key Commands

- **Build**: `make build` (in workspace root) - Automatically stops old server

### Why Only `make build`

The Go MCP server embeds the HTML/CSS/JS files at compile time. Running `make build` does everything:
1. Stops any running MCP server
2. Builds the TypeScript client 
3. Rebuilds the Go server with embedded files

Don't use `npm run build:mcp-client` or other partial build commands - always use `make build`.

### Important Notes

- **CRITICAL**: Always use `make build` - it's the only build command you need
- `make build` automatically stops any running MCP server
- The Go server embeds static files at compile time
- Must reconnect MCP after building for changes to take effect
- Server uses **lazy startup** - HTTP starts on first draw call

## Testing Workflow

1. Make changes to `mcp-client/mcp-client.ts` or CSS/HTML
2. Run `make build` (automatically stops old server)
3. Reconnect MCP server in Claude Code
4. Use `mcp_whiteboard_draw` tool to test changes

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
