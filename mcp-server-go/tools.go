package main

import (
	"context"
	_ "embed"
	"fmt"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

//go:embed instruction-reference.md
var instructionReferenceMD string

//go:embed diagramming-guide.md
var diagrammingGuideMD string

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
		// Lazily start HTTP server + open browser on first draw
		if err := ensureHTTPServer(); err != nil {
			return nil, nil, fmt.Errorf("failed to start whiteboard server: %w", err)
		}

		// Re-open browser on new presentation (slide 1)
		if params.Slide <= 1 && uiURL != "" {
			openBrowser(uiURL)
		}

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
