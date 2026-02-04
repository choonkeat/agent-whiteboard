package main

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func instructionReference(w, h int) string {
	return fmt.Sprintf(`# Agent Whiteboard — Instruction Reference

All instructions are JSON objects with a `+"`type`"+` field plus type-specific parameters.

## Movement
| type | params | description |
|------|--------|-------------|
| moveTo | x, y | Move turtle to absolute position (no drawing) |
| lineTo | x, y | Draw a line from current position to (x, y) |
| forward | distance | Move forward in the current heading direction |
| turnLeft | angle | Rotate heading counter-clockwise (degrees) |
| turnRight | angle | Rotate heading clockwise (degrees) |

## Pen State
| type | params | description |
|------|--------|-------------|
| penUp | *(none)* | Lift pen — movement won't draw |
| penDown | *(none)* | Lower pen — movement will draw |
| setColor | color | Set stroke color (CSS color string, e.g. "#ff0000") |
| setStrokeWidth | width | Set stroke width in pixels |

## Shapes
| type | params | description |
|------|--------|-------------|
| drawRect | x, y, width, height, fill?, fillStyle? | Draw rectangle (fill is optional CSS color) |
| drawCircle | x, y, radius, fill?, fillStyle? | Draw circle |
| drawEllipse | x, y, width, height, fill?, fillStyle? | Draw ellipse |

**fillStyle** (optional, default "solid"): "solid", "hachure", "zigzag", "cross-hatch", "dots", "dashed", "zigzag-line"

## Text
| type | params | description |
|------|--------|-------------|
| writeText | text, x, y, fontSize?, font? | Draw text at absolute position |
| label | text, offsetX?, offsetY?, fontSize? | Draw text near current turtle position |

## Control
| type | params | description |
|------|--------|-------------|
| clear | *(none)* | Clear the canvas |
| wait | duration | Pause animation for duration milliseconds |

## Canvas
Default canvas size is **%d × %d** pixels. Origin (0,0) is top-left.
Turtle starts at center (%d, %d) heading up (0°).
`, w, h, w/2, h/2)
}

func diagrammingGuide(w, h int) string {
	return fmt.Sprintf(`# Agent Whiteboard — Diagramming Guide

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

## Choosing a diagram type

Pick the diagram type that best fits **what you're explaining**, not what feels easiest to draw:

| Situation | Diagram type | When to use |
|-----------|-------------|-------------|
| How components connect | **Box-and-arrow** (architecture) | Static structure — what exists and how parts relate. Use when the viewer asks "what are the pieces?" |
| Interactions over time | **Sequence diagram** (lifelines + arrows) | Dynamic behavior — messages, requests, and responses between actors in order. Use when explaining "how does X work?" or "what happens when Y?" |
| Decision / branching process | **Flowchart** (boxes + diamonds) | Logic and control flow — if/else paths, state machines, algorithms |
| Comparing two things | **Side-by-side** (split canvas) | Contrasting approaches, before/after, trade-offs |
| Explaining one concept | **Annotated shape** (shape + callouts) | Zooming into a single component with labeled parts |

**Important:** When explaining how a system works (the flow of data, requests, or events between components), use a **sequence diagram**, not a box-and-arrow diagram. Box-and-arrow shows structure; sequence diagrams show behavior. Most "how does it work?" questions need a sequence diagram.

## Layout rules

**Canvas:** %d × %d pixels. Leave 30px margins. Work within %d × %d.

**Text:** 25px minimum vertical gap between lines. Font size 14-16 for body, 18+ for titles, 11-12 for annotations. Place labels *above* the line they describe (offset Y by -12).

**Colors:** 2-4 max. One color per actor/component, stay consistent.
- Blue #2196F3 (primary) / fill #E3F2FD
- Green #4CAF50 (success) / fill #E8F5E9
- Orange #FF9800 (warnings) / fill #FFF3E0
- Red #F44336 (errors) / fill #FFEBEE
- Gray #666666 for annotations

## Drawing arrows

No arrow primitive — draw arrowheads as two short lines from the tip. Rightward arrow ending at (ex, ey):

`+"```"+`json
{"type": "moveTo", "x": sx, "y": sy},
{"type": "lineTo", "x": ex, "y": ey},
{"type": "moveTo", "x": ex, "y": ey},
{"type": "lineTo", "x": ex-10, "y": ey-6},
{"type": "moveTo", "x": ex, "y": ey},
{"type": "lineTo", "x": ex-10, "y": ey+6}
`+"```"+`

**Leftward**: `+"`ex+10, ey-6`"+` and `+"`ex+10, ey+6`"+`.
**Downward**: `+"`ex-6, ey-10`"+` and `+"`ex+6, ey-10`"+`.
**Upward**: `+"`ex-6, ey+10`"+` and `+"`ex+6, ey+10`"+`.
**Diagonal**: offset ~10px back along the line, ~6px perpendicular.

## Common mistakes
- **Too much at once**: split across multiple draw calls, one concept each
- **Overlapping text**: calculate positions; no two labels at the same Y
- **Missing arrowheads**: every directed line needs two short arrowhead lines
- **Tiny text**: never below fontSize 11; prefer 13+
- **No whitespace**: leave breathing room between elements
- **Inconsistent positions**: keep elements in the same place across slides
`, w, h, w-60, h-60)
}

// DrawParams are the input parameters for the draw tool.
type DrawParams struct {
	Caption      string `json:"caption" jsonschema:"Caption text to display below the whiteboard"`
	Instructions []any  `json:"instructions" jsonschema:"Drawing instruction objects with a type field and type-specific parameters. Read the whiteboard://instructions resource for the full reference."`
	Slide        int    `json:"slide,omitempty" jsonschema:"Current slide number (1-based). Shown as progress in the viewer."`
	TotalSlides  int    `json:"totalSlides,omitempty" jsonschema:"Total number of slides. Shown as progress in the viewer."`
}

// ClearParams are the input parameters for the clear tool (none).
type ClearParams struct{}

// registerTools adds the draw and clear tools plus the instructions resource.
func registerTools(server *mcp.Server, bus *EventBus) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        "draw",
		Description: "Set a caption and queue drawing instructions on the whiteboard, then wait for the viewer to click Continue before returning.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, params *DrawParams) (*mcp.CallToolResult, any, error) {
		// Wait for at least one viewer (browser) to be connected
		bus.WaitForSubscriber()

		ack := bus.CreateAck()

		bus.Publish(Event{Type: "reset"})
		bus.Publish(Event{Type: "caption", Text: params.Caption})
		bus.Publish(Event{
			Type:         "draw",
			Instructions: params.Instructions,
			AckID:        ack.ID,
			Slide:        params.Slide,
			TotalSlides:  params.TotalSlides,
		})

		result := <-ack.Ch

		var text string
		switch {
		case result == "timeout":
			text = "Viewer timed out."
		case result == "ack":
			text = "Viewer acknowledged."
		default:
			// result is "ack:<message>"
			text = "Viewer responded: " + result[len("ack:"):]
		}
		if uiURL != "" {
			text += " Whiteboard UI: " + uiURL
		}

		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: text},
			},
		}, nil, nil
	})

	mcp.AddTool(server, &mcp.Tool{
		Name:        "clear",
		Description: "Reset the whiteboard canvas and clear the caption.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, params *ClearParams) (*mcp.CallToolResult, any, error) {
		bus.Publish(Event{Type: "reset"})
		text := "Whiteboard cleared."
		if uiURL != "" {
			text += " Whiteboard UI: " + uiURL
		}
		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: text},
			},
		}, nil, nil
	})

	server.AddResource(&mcp.Resource{
		URI:         "whiteboard://instructions",
		Name:        "instruction-reference",
		Description: "Complete reference of all 16 drawing instruction types with their fields and parameters.",
		MIMEType:    "text/markdown",
	}, func(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
		w, h := getViewport()
		return &mcp.ReadResourceResult{
			Contents: []*mcp.ResourceContents{
				{
					URI:      "whiteboard://instructions",
					MIMEType: "text/markdown",
					Text:     instructionReference(w, h),
				},
			},
		}, nil
	})

	server.AddResource(&mcp.Resource{
		URI:         "whiteboard://diagramming-guide",
		Name:        "diagramming-guide",
		Description: "Read this before drawing: how to draw so humans can understand.",
		MIMEType:    "text/markdown",
	}, func(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
		w, h := getViewport()
		return &mcp.ReadResourceResult{
			Contents: []*mcp.ResourceContents{
				{
					URI:      "whiteboard://diagramming-guide",
					MIMEType: "text/markdown",
					Text:     diagrammingGuide(w, h),
				},
			},
		}, nil
	})
}
