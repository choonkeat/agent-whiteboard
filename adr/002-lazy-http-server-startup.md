# ADR 002: Lazy HTTP Server Startup

## Status
Accepted

## Context
The agent-whiteboard MCP server provides drawing tools (`draw`, `clear`) that display on a browser-based UI. The server can operate in multiple modes:

1. **Stdio MCP mode** (default) — MCP protocol over stdin/stdout, HTTP server for browser UI
2. **HTTP-only mode** (`--no-stdio-mcp`) — No stdio, only HTTP/WebSocket
3. **Remote WebSocket mode** (`--ws`) — Connect to external whiteboard instance, no local HTTP

In stdio mode, the MCP client (e.g., Claude Desktop) connects immediately at startup. But the user may never call `draw` — they might only use other MCP tools, or the agent might decide drawing isn't needed.

Starting the HTTP server and opening a browser window eagerly would:
- Waste system resources (open port, spawn browser process)
- Annoy users with unwanted browser windows
- Potentially fail on headless systems where no browser is available

## Decision
Start the HTTP server lazily on first `draw` call, not at MCP server initialization:

```go
func ensureHTTPServer() error {
    if remoteMode {
        return nil  // Remote mode doesn't need local server
    }
    httpMu.Lock()
    defer httpMu.Unlock()
    if httpRunning {
        return nil  // Already running
    }
    // Start server and open browser only now
    url, ln, err := startHTTPServer(mcpServerRef)
    if err != nil {
        return err
    }
    httpRunning = true
    openBrowser(url)
    return nil
}
```

The `draw` tool handler calls `ensureHTTPServer()` before doing anything else.

Exception: In `--no-stdio-mcp` mode, start the server eagerly since that's the entire point of that mode (HTTP-only operation).

## Consequences

### Positive
- No wasted resources if drawing is never used
- No surprise browser windows during agent initialization
- Works on headless systems until drawing is actually needed
- Faster MCP server startup (no HTTP/browser latency)

### Negative
- First `draw` call has additional latency (~100-500ms for server start + browser launch)
- Browser opening on slide 1 may feel "delayed" compared to eager startup
- Slightly more complex error handling (server start can fail mid-session)

### Alternatives Considered
- **Always start eagerly** — Wastes resources, bad UX for non-drawing use cases
- **Configuration flag for eager/lazy** — Adds complexity, lazy is almost always better
- **Start server eagerly, open browser lazily** — Partial solution, still wastes the port
