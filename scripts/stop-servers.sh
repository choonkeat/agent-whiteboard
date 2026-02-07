#!/bin/bash
# Stop running whiteboard MCP servers

WORKSPACE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Find and kill Go MCP server by exact binary path
GO_MCP_BIN="$WORKSPACE_DIR/mcp-server-go/dist/whiteboard-mcp"
if [ -f "$GO_MCP_BIN" ]; then
    GO_PIDS=$(ps aux | grep "$GO_MCP_BIN" | grep -v grep | awk '{print $2}')
    if [ -n "$GO_PIDS" ]; then
        echo "→ Stopping Go MCP server..."
        echo "$GO_PIDS" | xargs kill -9 2>/dev/null || true
        sleep 0.3
    fi
fi

# Find and kill npm-based agent-whiteboard by exact binary path
NPM_BIN="$WORKSPACE_DIR/npm-platforms/linux-x64/bin/agent-whiteboard"
if [ -f "$NPM_BIN" ]; then
    NPM_PIDS=$(ps aux | grep "$NPM_BIN" | grep -v grep | awk '{print $2}')
    if [ -n "$NPM_PIDS" ]; then
        echo "→ Stopping npm-based agent-whiteboard..."
        echo "$NPM_PIDS" | xargs kill -9 2>/dev/null || true
        sleep 0.3
    fi
fi

# Also kill the wrapper processes
ps aux | grep "npm exec.*agent-whiteboard" | grep -v grep | awk '{print $2}' | xargs kill -9 2>/dev/null || true
ps aux | grep "node.*agent-whiteboard" | grep -v grep | grep -v tsserver | awk '{print $2}' | xargs kill -9 2>/dev/null || true

exit 0
