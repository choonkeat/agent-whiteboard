# ADR 004: Turtle-Inspired, Not Pure Turtle Graphics

**Date**: 2026-02-07  
**Status**: Accepted

## Context

The project description initially called this a "turtle-graphics" whiteboard. However, the instruction set is not pure turtle graphics - it's a hybrid approach.

**Pure turtle graphics** consists of:
- Relative movement: `forward(distance)`
- Rotation: `turnLeft(angle)`, `turnRight(angle)`
- Pen control: `penUp()`, `penDown()`
- State-based drawing where the turtle's position and heading determine what gets drawn

**Our instruction set** includes:
- Turtle commands: `forward`, `turnLeft`, `turnRight`, `penUp`, `penDown`
- **AND** direct coordinate commands: `moveTo`, `lineTo`, `drawRect`, `drawCircle`, `writeText`

## Decision

We describe this as **"turtle-inspired"** rather than "turtle-graphics" because:

1. **We maintain turtle state** (position, heading, pen up/down)
2. **We support turtle commands** for when they make sense
3. **BUT we add convenient primitives** for common shapes and absolute positioning

## Rationale

### Why Not Pure Turtle Graphics?

Pure turtle graphics would make simple diagrams extremely verbose and harder for LLMs to generate correctly.

**Example: Drawing a labeled box**

Pure turtle (12 instructions):
```json
{"type": "penUp"}
{"type": "moveTo", "x": 100, "y": 100}
{"type": "penDown"}
{"type": "forward", "distance": 200}
{"type": "turnRight", "angle": 90}
{"type": "forward", "distance": 80}
{"type": "turnRight", "angle": 90}
{"type": "forward", "distance": 200}
{"type": "turnRight", "angle": 90}
{"type": "forward", "distance": 80}
{"type": "penUp"}
{"type": "writeText", "text": "Label", "x": 200, "y": 140}
```

Hybrid approach (2 instructions):
```json
{"type": "drawRect", "x": 100, "y": 100, "width": 200, "height": 80}
{"type": "writeText", "text": "Label", "x": 200, "y": 140}
```

### Benefits of Hybrid Approach

1. **Conciseness**: Fewer instructions mean less token usage and faster generation
2. **Clarity**: High-level primitives match how humans think about diagrams
3. **Reliability**: Simpler instructions reduce the chance of LLM errors
4. **Flexibility**: Agents can choose the right tool for the job

### When Turtle Commands Still Matter

Turtle commands (`forward`, `turnLeft`, `turnRight`) are useful for:
- Drawing paths where the angle is more natural than coordinates
- Creating patterns with rotation
- Educational/demonstration purposes

## Consequences

### Positive

- Clear, concise instruction set
- Better suited for LLM code generation
- Easier to draw common diagram elements
- Maintains the conceptual model of turtle state

### Neutral

- Not a "pure" implementation of any single paradigm
- Need to document both coordinate-based and turtle-based commands

### Negative

- None identified. The hybrid approach provides only benefits.

## Implementation

- Updated package.json description from "Turtle-graphics-inspired" to "Turtle-inspired"
- Updated README.md tagline
- Maintain both instruction types in the API

## References

- Classic turtle graphics: [Logo programming language](https://en.wikipedia.org/wiki/Logo_(programming_language))
- Instruction reference: `mcp-server-go/instruction-reference.md`
