package main

import (
	"sync"
	"testing"
	"time"
)

func TestEnsureHTTPServerLazyStart(t *testing.T) {
	// Reset global state for test
	lazyStartOnce = sync.Once{}
	lazyStartErr = nil
	uiURL = ""
	remoteMode = false
	mcpServerRef = nil

	// In remote mode, ensureHTTPServer should be a no-op
	remoteMode = true
	if err := ensureHTTPServer(); err != nil {
		t.Fatalf("expected no error in remote mode, got: %v", err)
	}
	if uiURL != "" {
		t.Fatalf("expected empty uiURL in remote mode, got: %s", uiURL)
	}
}

func TestEventBusSubscribeUnblocks(t *testing.T) {
	eb := NewEventBus()

	done := make(chan struct{})
	go func() {
		eb.WaitForSubscriber()
		close(done)
	}()

	// Should not unblock yet
	select {
	case <-done:
		t.Fatal("WaitForSubscriber unblocked before any subscriber")
	case <-time.After(50 * time.Millisecond):
	}

	// Subscribe should unblock it
	sub := eb.Subscribe()
	defer eb.Unsubscribe(sub)

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("WaitForSubscriber did not unblock after Subscribe")
	}
}

func TestEventBusPublishAndReceive(t *testing.T) {
	eb := NewEventBus()
	sub := eb.Subscribe()
	defer eb.Unsubscribe(sub)

	eb.Publish(Event{Type: "reset"})
	eb.Publish(Event{Type: "caption", Text: "hello"})

	ev1 := <-sub
	if ev1.Type != "reset" {
		t.Fatalf("expected reset event, got %s", ev1.Type)
	}

	ev2 := <-sub
	if ev2.Type != "caption" || ev2.Text != "hello" {
		t.Fatalf("expected caption event with text 'hello', got type=%s text=%s", ev2.Type, ev2.Text)
	}
}

func TestEventBusAckResolve(t *testing.T) {
	eb := NewEventBus()
	ack := eb.CreateAck()

	go func() {
		time.Sleep(10 * time.Millisecond)
		eb.ResolveAck(ack.ID, "ack:clicked continue")
	}()

	select {
	case result := <-ack.Ch:
		if result != "ack:clicked continue" {
			t.Fatalf("expected 'ack:clicked continue', got '%s'", result)
		}
	case <-time.After(time.Second):
		t.Fatal("ack did not resolve in time")
	}
}

func TestEventBusMultipleSubscribers(t *testing.T) {
	eb := NewEventBus()
	sub1 := eb.Subscribe()
	sub2 := eb.Subscribe()
	defer eb.Unsubscribe(sub1)
	defer eb.Unsubscribe(sub2)

	eb.Publish(Event{Type: "draw", AckID: "test-123"})

	ev1 := <-sub1
	ev2 := <-sub2

	if ev1.Type != "draw" || ev1.AckID != "test-123" {
		t.Fatalf("subscriber 1 got unexpected event: %+v", ev1)
	}
	if ev2.Type != "draw" || ev2.AckID != "test-123" {
		t.Fatalf("subscriber 2 got unexpected event: %+v", ev2)
	}
}

func TestEventBusUnsubscribe(t *testing.T) {
	eb := NewEventBus()
	sub := eb.Subscribe()
	eb.Unsubscribe(sub)

	eb.Publish(Event{Type: "reset"})

	select {
	case <-sub:
		t.Fatal("unsubscribed channel should not receive events")
	case <-time.After(50 * time.Millisecond):
	}
}
