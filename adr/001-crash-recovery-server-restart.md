# ADR 001: Crash Recovery with Mutex-Guarded Server Restart

## Status
Accepted

## Context
The MCP server lazily starts an HTTP server and opens a browser when the first `draw` tool is called. Initially, this used Go's `sync.Once` to ensure startup happens exactly once.

However, `sync.Once` has a critical limitation: it runs exactly once per process lifetime. If the HTTP server crashes, the browser tab is closed, or the WebSocket connection drops after that first call, subsequent `draw` calls cannot restart the server — `sync.Once.Do()` becomes a permanent no-op.

This caused the agent to hang indefinitely:
1. First draw succeeds, server starts, browser opens
2. User closes browser tab (or server crashes)
3. Agent calls draw again
4. `ensureHTTPServer()` returns immediately (sync.Once already fired)
5. `WaitForSubscriber()` blocks forever — no browser will ever connect

## Decision
Replace `sync.Once` with `sync.Mutex` plus an `httpRunning` boolean flag:

```go
var (
    httpMu       sync.Mutex
    httpRunning  bool
    httpListener net.Listener
)

func ensureHTTPServer() error {
    httpMu.Lock()
    defer httpMu.Unlock()
    if httpRunning {
        return nil
    }
    // start server...
    httpRunning = true
    return nil
}
```

When `http.Serve()` returns (server stopped), a goroutine sets `httpRunning = false`. The next `draw` call detects this and restarts the server.

Similarly, replace the one-shot `firstSubCh` channel in `WaitForSubscriber` with polling of `len(subscribers)`:

```go
func (eb *EventBus) WaitForSubscriber(ctx context.Context) error {
    for {
        eb.mu.RLock()
        n := len(eb.subscribers)
        eb.mu.RUnlock()
        if n > 0 {
            return nil
        }
        select {
        case <-ctx.Done():
            return ctx.Err()
        case <-time.After(30 * time.Second):
            return fmt.Errorf("timed out waiting for browser")
        case <-time.After(100 * time.Millisecond):
            // poll again
        }
    }
}
```

This allows detecting reconnection after all subscribers disconnect.

## Consequences

### Positive
- Agent recovers automatically from browser crashes, tab closes, or network disconnects
- Context cancellation is respected — MCP client can cancel stuck requests
- 30-second timeout prevents infinite hangs if browser never connects

### Negative
- Slightly more complex than `sync.Once`
- 100ms polling interval adds small latency on reconnection (acceptable)
- Multiple draw calls during server restart could race (mutex prevents actual issues)

### Alternatives Considered
- **Keep sync.Once, require user to restart MCP server** — Poor UX, agent appears broken
- **Use sync.Once with atomic "crashed" flag** — Still can't reset the Once, adds complexity without solving the problem
- **Use a channel that can be recreated** — More complex than a boolean flag, same outcome
