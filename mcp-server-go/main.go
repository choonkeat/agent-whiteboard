package main

import (
	"context"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strconv"
	"sync"
	"syscall"

	"github.com/gorilla/websocket"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

//go:embed mcp-client-dist
var staticFS embed.FS

var bus = NewEventBus()

var (
	viewportMu     sync.RWMutex
	viewportWidth  = 900
	viewportHeight = 450 // Conservative default; browser canvas is typically 55vh (~450px)
)

func getViewport() (int, int) {
	viewportMu.RLock()
	defer viewportMu.RUnlock()
	return viewportWidth, viewportHeight
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// uiURL is set once the HTTP server starts, used in tool results.
var uiURL string

// browserOpened tracks whether we've already opened a browser this session.
// This prevents opening multiple windows on retries after validation errors.
var browserOpened bool

// httpMu guards httpRunning and httpListener for crash-recovery restarts.
var httpMu sync.Mutex
var httpRunning bool
var httpListener net.Listener

// remoteMode is set when --ws is used (no local HTTP server needed).
var remoteMode bool

// mcpServerRef holds a reference to the MCP server for lazy HTTP startup.
var mcpServerRef *mcp.Server

// ensureHTTPServer lazily starts the HTTP server and opens the browser.
// If the server has crashed since the last call, it restarts automatically.
func ensureHTTPServer() error {
	if remoteMode {
		return nil
	}
	httpMu.Lock()
	defer httpMu.Unlock()
	if httpRunning {
		return nil
	}
	url, ln, err := startHTTPServer(mcpServerRef)
	if err != nil {
		return err
	}
	uiURL = url
	httpListener = ln
	httpRunning = true
	fmt.Fprintf(os.Stderr, "Agent Whiteboard UI: %s\n", uiURL)
	fmt.Fprintf(os.Stderr, "MCP endpoint: POST %s/mcp\n", uiURL)
	openBrowser(uiURL)
	browserOpened = true
	return nil
}

func main() {
	noStdio := flag.Bool("no-stdio-mcp", false, "disable stdio MCP transport (HTTP MCP is always available)")
	wsURL := flag.String("ws", "", "connect as WebSocket client to a remote whiteboard instance (e.g. ws://host:3005/ws)")
	flag.Parse()

	server := mcp.NewServer(&mcp.Implementation{
		Name:    "agent-whiteboard",
		Version: "0.3.2",
	}, nil)
	mcpServerRef = server
	registerTools(server, bus)

	if *wsURL != "" {
		// WebSocket client mode: connect to remote whiteboard
		remoteMode = true
		go connectRemoteWS(*wsURL, bus)
	} else if *noStdio {
		// HTTP-only mode: start server eagerly since that's the whole point
		if err := ensureHTTPServer(); err != nil {
			log.Fatalf("failed to start HTTP server: %v", err)
		}
	}
	// In normal stdio mode, HTTP server + browser are started lazily on first draw

	if !*noStdio {
		// Run MCP over stdio (blocks until client disconnects)
		if err := server.Run(context.Background(), &mcp.StdioTransport{}); err != nil {
			log.Fatalf("mcp server error: %v", err)
		}
	} else {
		// No stdio — block until signal
		fmt.Fprintf(os.Stderr, "Running in HTTP-only mode (no stdio MCP). Press Ctrl+C to stop.\n")
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
	}
}

// startHTTPServer starts the HTTP server with the browser UI, WebSocket endpoint,
// and StreamableHTTP MCP endpoint. Returns the base URL and the listener.
// When http.Serve returns (server stopped), httpRunning is set to false.
func startHTTPServer(mcpServer *mcp.Server) (string, net.Listener, error) {
	staticSub, err := fs.Sub(staticFS, "mcp-client-dist")
	if err != nil {
		return "", nil, fmt.Errorf("failed to create sub filesystem: %w", err)
	}
	fileServer := http.FileServer(http.FS(staticSub))

	// StreamableHTTP MCP handler
	mcpHandler := mcp.NewStreamableHTTPHandler(func(r *http.Request) *mcp.Server {
		return mcpServer
	}, &mcp.StreamableHTTPOptions{
		Stateless: true,
	})

	mux := http.NewServeMux()
	mux.Handle("/mcp", mcpHandler)
	mux.HandleFunc("/ws", handleWebSocket)
	mux.Handle("/", fileServer)

	port := 0
	if s := os.Getenv("PORT"); s != "" {
		port, _ = strconv.Atoi(s)
	}
	addr := "0.0.0.0:0"
	if port > 0 {
		addr = fmt.Sprintf("0.0.0.0:%d", port)
	}

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return "", nil, fmt.Errorf("listen error: %w", err)
	}
	actualPort := ln.Addr().(*net.TCPAddr).Port
	go func() {
		http.Serve(ln, mux)
		// Server stopped — mark as not running so next draw restarts it
		httpMu.Lock()
		httpRunning = false
		httpMu.Unlock()
	}()

	return fmt.Sprintf("http://localhost:%d", actualPort), ln, nil
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	default:
		cmd = exec.Command("cmd", "/c", "start", url)
	}
	cmd.Start() // fire and forget
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("websocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Send connected handshake
	conn.WriteJSON(map[string]string{"type": "connected"})

	// Subscribe to event bus
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	// Forward events to WebSocket client
	done := make(chan struct{})
	go func() {
		defer close(done)
		for event := range sub {
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		}
	}()

	// Read incoming messages (acks, viewport)
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var m struct {
			Type    string `json:"type"`
			ID      string `json:"id"`
			Message string `json:"message"`
			Width   int    `json:"width"`
			Height  int    `json:"height"`
		}
		if json.Unmarshal(msg, &m) != nil {
			continue
		}
		switch m.Type {
		case "ack":
			if m.ID != "" {
				result := "ack"
				if m.Message != "" {
					result = "ack:" + m.Message
				}
				bus.ResolveAck(m.ID, result)
			}
		case "viewport":
			if m.Width > 0 && m.Height > 0 {
				viewportMu.Lock()
				viewportWidth = m.Width
				viewportHeight = m.Height
				viewportMu.Unlock()
			}
		}
	}
}

// connectRemoteWS connects as a WebSocket client to a remote whiteboard instance.
// It subscribes to the local event bus and forwards events to the remote WS,
// and reads ack messages from the remote WS back to the bus.
func connectRemoteWS(url string, bus *EventBus) {
	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		log.Fatalf("failed to connect to remote whiteboard at %s: %v", url, err)
	}
	defer conn.Close()

	fmt.Fprintf(os.Stderr, "Connected to remote whiteboard: %s\n", url)

	// Signal that we have a "subscriber" (the remote WS acts as one)
	sub := bus.Subscribe()
	defer bus.Unsubscribe(sub)

	// Forward events to remote WS
	go func() {
		for event := range sub {
			data, err := json.Marshal(event)
			if err != nil {
				continue
			}
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				log.Printf("remote WS write error: %v", err)
				return
			}
		}
	}()

	// Read ack messages from remote WS
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			log.Printf("remote WS read error: %v", err)
			return
		}
		var m struct {
			Type    string `json:"type"`
			ID      string `json:"id"`
			Message string `json:"message"`
		}
		if json.Unmarshal(msg, &m) == nil && m.Type == "ack" && m.ID != "" {
			result := "ack"
			if m.Message != "" {
				result = "ack:" + m.Message
			}
			bus.ResolveAck(m.ID, result)
		}
	}
}
