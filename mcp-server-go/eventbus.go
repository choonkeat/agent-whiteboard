package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

const ackTimeout = 5 * time.Minute

// Event represents a whiteboard event sent to browser clients.
type Event struct {
	Type           string `json:"type"`
	Text           string `json:"text,omitempty"`           // caption
	Instructions   []any  `json:"instructions,omitempty"`   // draw
	PreviousCanvas string `json:"previousCanvas,omitempty"` // draw: 'keep' or 'discard'
	AckID          string `json:"ack_id,omitempty"`         // draw
	Slide          int    `json:"slide,omitempty"`          // draw
	TotalSlides    int    `json:"totalSlides,omitempty"`    // draw
}

// AckHandle is returned by CreateAck. Read from Ch to wait for ack or timeout.
type AckHandle struct {
	ID string
	Ch chan string // receives "ack" or "timeout"
}

// EventBus fans out events to WebSocket subscribers and tracks pending acks.
type EventBus struct {
	mu          sync.RWMutex
	subscribers map[chan Event]struct{}

	ackMu   sync.Mutex
	pending map[string]chan string // ack_id → channel
}

// NewEventBus creates a new EventBus.
func NewEventBus() *EventBus {
	return &EventBus{
		subscribers: make(map[chan Event]struct{}),
		pending:     make(map[string]chan string),
	}
}

// Subscribe returns a buffered channel that receives all published events.
// Call Unsubscribe when done.
func (eb *EventBus) Subscribe() chan Event {
	ch := make(chan Event, 64)
	eb.mu.Lock()
	eb.subscribers[ch] = struct{}{}
	eb.mu.Unlock()
	return ch
}

// WaitForSubscriber polls until at least one subscriber is connected,
// or the context is cancelled, or 30 seconds elapse.
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
			return fmt.Errorf("timed out waiting for browser to connect")
		case <-time.After(100 * time.Millisecond):
			// poll again
		}
	}
}

// Unsubscribe removes a subscriber channel.
func (eb *EventBus) Unsubscribe(ch chan Event) {
	eb.mu.Lock()
	delete(eb.subscribers, ch)
	eb.mu.Unlock()
}

// Publish sends an event to all subscribers.
func (eb *EventBus) Publish(event Event) {
	eb.mu.RLock()
	defer eb.mu.RUnlock()
	for ch := range eb.subscribers {
		select {
		case ch <- event:
		default:
			// drop if subscriber is full
		}
	}
}

// CreateAck creates a pending acknowledgment with a 5-minute timeout.
func (eb *EventBus) CreateAck() AckHandle {
	id := uuid.New().String()
	ch := make(chan string, 1)

	eb.ackMu.Lock()
	eb.pending[id] = ch
	eb.ackMu.Unlock()

	go func() {
		time.Sleep(ackTimeout)
		eb.ackMu.Lock()
		if _, ok := eb.pending[id]; ok {
			delete(eb.pending, id)
			eb.ackMu.Unlock()
			select {
			case ch <- "timeout":
			default:
			}
		} else {
			eb.ackMu.Unlock()
		}
	}()

	return AckHandle{ID: id, Ch: ch}
}

// ResolveAck resolves a pending ack. The result string is sent through the
// channel (e.g. "ack" or "ack:slower"). Returns true if the ack existed.
func (eb *EventBus) ResolveAck(id, result string) bool {
	eb.ackMu.Lock()
	ch, ok := eb.pending[id]
	if ok {
		delete(eb.pending, id)
	}
	eb.ackMu.Unlock()

	if !ok {
		return false
	}
	select {
	case ch <- result:
	default:
	}
	return true
}
