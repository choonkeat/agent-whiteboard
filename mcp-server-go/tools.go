package main

import (
	"context"
	_ "embed"
	"fmt"
	"reflect"
	"strings"

	"github.com/google/jsonschema-go/jsonschema"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

//go:embed instruction-reference.md
var instructionReferenceMD string

//go:embed diagramming-guide.md
var diagrammingGuideMD string

//go:embed quick-reference.md
var quickReferenceMD string

func instructionReference(w, h int) string {
	r := strings.NewReplacer(
		"{{W}}", fmt.Sprint(w),
		"{{H}}", fmt.Sprint(h),
		"{{CX}}", fmt.Sprint(w/2),
		"{{CY}}", fmt.Sprint(h/2),
	)
	return r.Replace(instructionReferenceMD)
}

func diagrammingGuide(w, h int) string {
	r := strings.NewReplacer(
		"{{W}}", fmt.Sprint(w),
		"{{H}}", fmt.Sprint(h),
		"{{IW}}", fmt.Sprint(w-60),
		"{{IH}}", fmt.Sprint(h-60),
	)
	return r.Replace(diagrammingGuideMD)
}

func quickReference(w, h int) string {
	r := strings.NewReplacer(
		"{{W}}", fmt.Sprint(w),
		"{{H}}", fmt.Sprint(h),
		"{{CX}}", fmt.Sprint(w/2),
		"{{CY}}", fmt.Sprint(h/2),
		"{{IW}}", fmt.Sprint(w-60),
		"{{IH}}", fmt.Sprint(h-60),
	)
	return r.Replace(quickReferenceMD)
}

// PreviousCanvas controls what happens to existing canvas content before drawing.
type PreviousCanvas string

const (
	PreviousCanvasKeep    PreviousCanvas = "keep"
	PreviousCanvasDiscard PreviousCanvas = "discard"
)

// DrawParams are the input parameters for the draw tool.
type DrawParams struct {
	PreviousCanvas PreviousCanvas `json:"previousCanvas" jsonschema:"What to do with existing canvas content. 'discard' clears the canvas before drawing (use for new diagrams or topic changes). 'keep' draws on top of existing content (use for gradual reveal, adding layers to a diagram)."`
	Caption        string         `json:"caption" jsonschema:"Text displayed below the canvas explaining this slide. Keep it short—one concept per slide. If your caption contains 'and', consider splitting into two slides."`
	Instructions   []any          `json:"instructions" jsonschema:"Array of drawing instructions. Each object MUST have a 'type' field (string) plus type-specific params. Common types: moveTo(x,y), lineTo(x,y), drawRect(x,y,width,height,fill?), drawCircle(x,y,radius,fill?), writeText(text,x,y,fontSize?), setColor(color). Example: [{\"type\":\"drawRect\",\"x\":100,\"y\":100,\"width\":200,\"height\":80,\"fill\":\"#E3F2FD\"},{\"type\":\"writeText\",\"text\":\"Client\",\"x\":140,\"y\":150}]. Full reference: whiteboard://instructions"`
	Slide          int            `json:"slide,omitempty" jsonschema:"Current slide number (1-based). Use with totalSlides to show progress like '2/5'."`
	TotalSlides    int            `json:"totalSlides,omitempty" jsonschema:"Total number of slides you plan to draw. Helps viewer know how much is left."`
}

// drawInputSchema returns a custom JSON schema for DrawParams with the
// PreviousCanvas enum properly defined.
func drawInputSchema() *jsonschema.Schema {
	schema, err := jsonschema.ForType(
		reflect.TypeFor[DrawParams](),
		&jsonschema.ForOptions{
			TypeSchemas: map[reflect.Type]*jsonschema.Schema{
				reflect.TypeFor[PreviousCanvas](): {
					Type: "string",
					Enum: []any{"keep", "discard"},
				},
			},
		},
	)
	if err != nil {
		panic(fmt.Sprintf("failed to build DrawParams schema: %v", err))
	}
	return schema
}

// ClearParams are the input parameters for the clear tool (none).
type ClearParams struct{}

// registerTools adds the draw and clear tools plus the instructions resource.
func registerTools(server *mcp.Server, bus *EventBus) {
	mcp.AddTool(server, &mcp.Tool{
		Name: "draw",
		Description: `Draw a diagram slide on the whiteboard and wait for viewer response.

USE THIS WHEN explaining concepts visually: architecture, data flow, processes, comparisons.

HOW IT WORKS:
• Each draw call = one slide. Build complex diagrams across multiple slides (gradual reveal).
• Viewer clicks Continue (or gives feedback like "Slower pace") before this tool returns.
• The result tells you what the viewer said—adjust your next slide accordingly.

CHOOSING A DIAGRAM TYPE:
• Box-and-arrow: static structure ("what are the pieces?")
• Sequence diagram: interactions over time ("how does X work?")
• Flowchart: decisions and branching logic
• Side-by-side: comparing approaches or before/after

INSTRUCTIONS FORMAT — JSON objects with "type" field:
  [{"type":"drawRect","x":100,"y":100,"width":150,"height":60,"fill":"#E3F2FD"},
   {"type":"writeText","text":"Client","x":130,"y":140,"fontSize":16},
   {"type":"moveTo","x":250,"y":130},{"type":"lineTo","x":350,"y":130}]

COMMON TYPES: moveTo, lineTo, drawRect, drawCircle, writeText, setColor, penUp, penDown, forward, turnLeft, turnRight

Read whiteboard://instructions for all 16 types with parameters.
Read whiteboard://diagramming-guide for layout rules and cognitive principles.`,
		InputSchema: drawInputSchema(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, params *DrawParams) (*mcp.CallToolResult, any, error) {
		// Lazily start HTTP server + open browser on first draw
		if err := ensureHTTPServer(); err != nil {
			return nil, nil, fmt.Errorf("failed to start whiteboard server: %w", err)
		}

		// Open browser on first slide if not already opened this session.
		// This prevents opening multiple windows on retries after validation errors.
		// Note: browserOpened is protected by httpMu in ensureHTTPServer.
		httpMu.Lock()
		shouldOpen := params.Slide <= 1 && uiURL != "" && !browserOpened
		if shouldOpen {
			openBrowser(uiURL)
			browserOpened = true
		}
		httpMu.Unlock()

		// Wait for at least one viewer (browser) to be connected
		if err := bus.WaitForSubscriber(ctx); err != nil {
			return nil, nil, fmt.Errorf("waiting for browser: %w", err)
		}

		ack := bus.CreateAck()

		if params.PreviousCanvas == PreviousCanvasDiscard {
			bus.Publish(Event{Type: "reset"})
		}
		bus.Publish(Event{Type: "caption", Text: params.Caption})
		bus.Publish(Event{
			Type:         "draw",
			Instructions: params.Instructions,
			AckID:        ack.ID,
			Slide:        params.Slide,
			TotalSlides:  params.TotalSlides,
		})

		var result string
		select {
		case result = <-ack.Ch:
		case <-ctx.Done():
			return nil, nil, fmt.Errorf("draw cancelled: %w", ctx.Err())
		}

		var text string
		isError := false
		switch {
		case result == "timeout":
			text = "Viewer timed out."
			isError = true
		case result == "ack":
			text = "Viewer acknowledged."
		default:
			// result is "ack:<message>"
			msg := result[len("ack:"):]
			if strings.HasPrefix(msg, "VALIDATION ERRORS") {
				text = msg
				isError = true
			} else {
				text = "Viewer responded: " + msg
			}
		}

		// Include actual viewport dimensions so agent can adjust future drawings
		w, h := getViewport()
		text += fmt.Sprintf(" Canvas: %d×%d pixels.", w, h)

		if uiURL != "" {
			text += " Whiteboard UI: " + uiURL
		}

		return &mcp.CallToolResult{
			Content: []mcp.Content{
				&mcp.TextContent{Text: text},
			},
			IsError: isError,
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

	// Prompt: plan-diagram — guides agents through choosing a diagram type and planning slides
	server.AddPrompt(&mcp.Prompt{
		Name:        "plan-diagram",
		Description: "Plan your diagram before drawing. Helps you choose the right diagram type and structure your slides.",
		Arguments: []*mcp.PromptArgument{
			{
				Name:        "topic",
				Description: "What are you explaining? (e.g., 'how authentication works', 'system architecture')",
				Required:    true,
			},
		},
	}, func(ctx context.Context, req *mcp.GetPromptRequest) (*mcp.GetPromptResult, error) {
		topic := req.Params.Arguments["topic"]
		return &mcp.GetPromptResult{
			Description: "Plan a diagram for: " + topic,
			Messages: []*mcp.PromptMessage{
				{
					Role: "user",
					Content: &mcp.TextContent{
						Text: "I want to explain: " + topic + "\n\nHelp me plan a whiteboard diagram.",
					},
				},
				{
					Role: "assistant",
					Content: &mcp.TextContent{
						Text: `I'll help you plan an effective diagram. Let me think through this:

**1. WHAT TYPE OF DIAGRAM?**

| If you're showing... | Use... |
|---------------------|--------|
| Static structure (components, relationships) | Box-and-arrow |
| Process over time (requests, messages, events) | Sequence diagram |
| Decision logic (if/else, state machine) | Flowchart |
| Comparing two approaches | Side-by-side |

**2. SLIDE BREAKDOWN**

For effective learning, build the diagram across 3-7 slides:
- Slide 1: Set the stage (title, one main element)
- Slides 2-N: Add one concept per slide
- Final slide: Complete picture

**3. LAYOUT PLANNING**

- Canvas: 900×450px (leave 30px margins)
- Keep elements in the same position across slides
- Use consistent colors per actor/component

Now let me plan the specific slides for "` + topic + `"...`,
					},
				},
			},
		}, nil
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

	server.AddResource(&mcp.Resource{
		URI:         "whiteboard://quick-reference",
		Name:        "quick-reference",
		Description: "Condensed cheat sheet: essential instructions, JSON format, colors, and arrows.",
		MIMEType:    "text/markdown",
	}, func(ctx context.Context, req *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
		w, h := getViewport()
		return &mcp.ReadResourceResult{
			Contents: []*mcp.ResourceContents{
				{
					URI:      "whiteboard://quick-reference",
					MIMEType: "text/markdown",
					Text:     quickReference(w, h),
				},
			},
		}, nil
	})
}
