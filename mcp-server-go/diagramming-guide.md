# Agent Whiteboard — Diagramming Guide

Read this before drawing. These principles help humans actually understand your diagrams.

## Cognitive principles

### 1. Gradual reveal (chunking)
Never dump an entire diagram at once. Build concepts layer by layer across **multiple draw calls**. Each call adds one idea on top of what the viewer already sees. The viewer clicks Continue to advance, so they control the pace.

Example — explaining a client-server architecture:
- Draw call 1: Just the client box and a title
- Draw call 2: Add the server box and the request arrow
- Draw call 3: Add the database and the server→DB arrow
- Draw call 4: Add response arrows and labels

### 2. One concept per slide
Each draw call should communicate exactly one idea. If you need a caption that contains "and", you probably need two draw calls. Short captions beat long ones.

### 3. Spatial consistency
Place elements in consistent locations across draw calls. If the "Client" box is at the top-left in slide 1, keep it there in slide 2. Humans build spatial memory — moving things around forces them to re-orient.

### 4. Viewer controls
The viewer has quick-reply buttons and can also type free-form messages:
- **Repeat slower**: viewer didn't follow the last slide — repeat the same concept but broken into smaller, simpler steps with fewer elements per draw call
- **Slower pace**: viewer understood, but wants future slides to cover fewer concepts per draw call — simplify, break into smaller steps
- **Faster pace**: viewer wants future slides to cover more concepts per draw call — combine steps, show more at once
- **Continue**: viewer understood, advance to the next draw call at the current pace

The draw tool result tells you what the viewer said. Adjust your next draw call accordingly. "Pace" always refers to how many concepts or elements you put in a single draw call, not animation speed.

## Planning before drawing

Before you start drawing, follow these steps:

1. **Analyze context.** Understand the specific system, components, and processes involved in what you need to explain. Identify the key elements and relationships.
2. **Select the right diagram type.** Choose based on what best communicates the concept — prioritize clarity and conciseness over what's easiest to draw. See the table below.
3. **Plan for clear visualization.** When showing changes (e.g. a code change, config update, migration), use side-by-side "before and after" diagrams where unchanged parts are drawn identically in the same positions. **Highlight the differences** — use a distinct fill color (e.g. red fill `#FFEBEE` for removed/old behavior, green fill `#E8F5E9` for added/new behavior) on the sections that changed, while keeping unchanged sections in a neutral color. This lets the viewer instantly spot what changed.

## Choosing a diagram type

Pick the diagram type that best fits **what you're explaining**, not what feels easiest to draw:

| Situation | Diagram type | When to use |
|-----------|-------------|-------------|
| How components connect | **Box-and-arrow** (architecture) | Static structure — what exists and how parts relate. Use when the viewer asks "what are the pieces?" |
| Interactions over time | **Sequence diagram** (lifelines + arrows) | Dynamic behavior — messages, requests, and responses between actors in order. Use when explaining "how does X work?" or "what happens when Y?" |
| Decision / branching process | **Flowchart** (boxes + diamonds) | Logic and control flow — if/else paths, state machines, algorithms |
| Comparing two things | **Side-by-side** (split canvas) | Contrasting approaches, before/after, trade-offs. Draw unchanged parts identically on the same axis and use distinct fill colors to highlight the sections that differ (e.g. red for "before", green for "after"). |
| Explaining one concept | **Annotated shape** (shape + callouts) | Zooming into a single component with labeled parts |
| Overlapping categories | **Venn diagram** (overlapping circles) | Showing shared vs. distinct properties between 2-3 groups |
| Lifecycle or transitions | **State diagram** (states + labeled arrows) | Showing how an entity moves between states over time |

**Important:** When explaining how a system works (the flow of data, requests, or events between components), use a **sequence diagram**, not a box-and-arrow diagram. Box-and-arrow shows structure; sequence diagrams show behavior. Most "how does it work?" questions need a sequence diagram.

## Layout rules

**Canvas:** {{W}} × {{H}} pixels. Leave 30px margins. Work within {{IW}} × {{IH}}.

**Text:** 25px minimum vertical gap between lines. Font size 14-16 for body, 18+ for titles, 11-12 for annotations. Place labels *above* the line they describe (offset Y by -12).

**Colors:** 2-4 max. One color per actor/component, stay consistent.
- Blue #2196F3 (primary) / fill #E3F2FD
- Green #4CAF50 (success) / fill #E8F5E9
- Orange #FF9800 (warnings) / fill #FFF3E0
- Red #F44336 (errors) / fill #FFEBEE
- Gray #666666 for annotations

## Drawing arrows

No arrow primitive — draw arrowheads as two short lines from the tip. Rightward arrow ending at (ex, ey):

```json
{"type": "moveTo", "x": sx, "y": sy},
{"type": "lineTo", "x": ex, "y": ey},
{"type": "moveTo", "x": ex, "y": ey},
{"type": "lineTo", "x": ex-10, "y": ey-6},
{"type": "moveTo", "x": ex, "y": ey},
{"type": "lineTo", "x": ex-10, "y": ey+6}
```

**Leftward**: `ex+10, ey-6` and `ex+10, ey+6`.
**Downward**: `ex-6, ey-10` and `ex+6, ey-10`.
**Upward**: `ex-6, ey+10` and `ex+6, ey+10`.
**Diagonal**: offset ~10px back along the line, ~6px perpendicular.

## Common mistakes
- **Too much at once**: split across multiple draw calls, one concept each
- **Overlapping text**: calculate positions; no two labels at the same Y
- **Missing arrowheads**: every directed line needs two short arrowhead lines
- **Tiny text**: never below fontSize 11; prefer 13+
- **No whitespace**: leave breathing room between elements
- **Inconsistent positions**: keep elements in the same place across slides
