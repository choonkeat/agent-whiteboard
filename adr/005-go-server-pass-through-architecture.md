# ADR 005: Go Server Pass-Through Architecture for Tool Parameters

## Status
Accepted

## Context
The whiteboard `draw` tool accepts a `previousCanvas` parameter (`'keep'` or `'discard'`) that controls whether the canvas should be cleared before drawing a new slide. 

Initially, the Go MCP server interpreted this parameter and sent a separate `reset` event when `previousCanvas === 'discard'`:

```go
// Old approach
if params.PreviousCanvas == PreviousCanvasDiscard {
    bus.Publish(Event{Type: "reset"})
}
bus.Publish(Event{Type: "draw", Instructions: params.Instructions})
```

This created a split architecture:
- Go server handled canvas clearing by sending `reset` events
- Client received `reset` event and called `board.reset()`
- The `previousCanvas` parameter was never sent to the client
- Recordings captured `previousCanvas: 'keep'` (default) even when agent passed `'discard'`
- Replays failed to clear canvas between slides

## Decision
**The Go MCP server should act as a pass-through proxy, forwarding tool parameters to the client without interpretation.**

Changed to include `previousCanvas` directly in the draw event:

```go
// New approach
bus.Publish(Event{Type: "caption", Text: params.Caption})
bus.Publish(Event{
    Type:           "draw",
    Instructions:   params.Instructions,
    PreviousCanvas: string(params.PreviousCanvas), // Pass through
    AckID:          ack.ID,
    Slide:          params.Slide,
    TotalSlides:    params.TotalSlides,
})
```

The client handles the parameter:

```typescript
case 'draw': {
    promoteCompletedSlide();
    
    // Client interprets previousCanvas
    if (data.previousCanvas === 'discard') {
        board.clear();
    }
    
    // Record for replay
    recordingsData.push({
        type: 'draw',
        data: {
            previousCanvas: data.previousCanvas || 'keep',
            instructions: valid,
            slide: data.slide || 0,
            totalSlides: data.totalSlides || 0,
        }
    });
}
```

## Rationale

### Why Pass-Through?

1. **Single Source of Truth**: Tool parameters are the contract with the agent. The client should receive exactly what the agent sent.

2. **Replay Consistency**: Recordings capture agent intent directly. When `previousCanvas: 'discard'` is sent, it's recorded, and replays can reproduce the same behavior.

3. **Client Autonomy**: The browser client is the rendering engine. It should decide how to interpret drawing directives, not the Go proxy.

4. **Simpler Architecture**: One event (`draw` with `previousCanvas`) instead of two events (`reset` + `draw`).

5. **Future Flexibility**: Adding new parameters doesn't require Go server changes—just add to Event struct and client handles it.

### What About the `clear` Tool?

The `clear` tool still sends a `reset` event because it's a different operation:
- `previousCanvas: 'discard'` = Clear canvas before drawing (part of drawing flow)
- `clear` tool = Full reset (canvas + turtle state + pending queue)

```go
// clear tool handler
bus.Publish(Event{Type: "reset"})
```

The client distinguishes:
- `data.previousCanvas === 'discard'` → `board.clear()` (just clear canvas)
- `type === 'reset'` → `board.reset()` (full reset)

## Consequences

### Positive
- ✅ Agent's `previousCanvas` parameter works correctly in live mode
- ✅ Recordings capture the parameter value
- ✅ Replays clear canvas between slides as expected
- ✅ Simpler architecture: one event instead of two
- ✅ Client has full drawing context in a single event
- ✅ Adding new parameters requires minimal Go server changes

### Negative
- Event struct grows with each new parameter (acceptable—it's a data transport)
- `reset` event still exists for `clear` tool (acceptable—different semantics)

### Alternatives Considered

**1. Keep separate `reset` event, record it for replay**
- ❌ Architectural mismatch: client has unused `previousCanvas` handling code
- ❌ Two mechanisms doing the same thing
- ❌ More confusing for future maintenance

**2. Go server interprets all parameters**
- ❌ Go server becomes rendering logic layer (wrong responsibility)
- ❌ Requires duplicating client logic in Go
- ❌ Recording/replay becomes complex
- ❌ Client can't evolve independently

**3. Client polls server state**
- ❌ Unnecessary complexity
- ❌ Breaks event-driven architecture
- ❌ Latency and race condition issues

## Implementation Notes

### Modified Files
- `mcp-server-go/eventbus.go`: Added `PreviousCanvas string` field to Event struct
- `mcp-server-go/tools.go`: Removed `reset` event for `previousCanvas`, added field to draw event
- `mcp-client/mcp-client.ts`: Already had handling code (just needed Go server to send it)

### Migration Path
No breaking changes for users:
- Old recordings (without `previousCanvas`) default to `'keep'` via `data.previousCanvas || 'keep'`
- Client always handled both approaches (reset event + previousCanvas parameter)
- Only improvement: new recordings now correctly capture canvas clearing

## Related ADRs
- ADR 004: Turtle-inspired, not pure turtle graphics (client autonomy in rendering)

## Date
2026-02-07
