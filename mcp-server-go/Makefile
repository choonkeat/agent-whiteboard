ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))..

.PHONY: build clean test

build: dist/whiteboard-mcp

dist/whiteboard-mcp: mcp-client-dist $(shell find . -name '*.go')
	@mkdir -p dist
	go build -o dist/whiteboard-mcp .

mcp-client-dist: $(shell find $(ROOT)/mcp-client -type f) $(shell find $(ROOT)/src -type f)
	cd $(ROOT) && node scripts/generate-version.js
	cd $(ROOT) && npx vite build --config vite.mcp-client.config.ts

test:
	go test -v ./...

clean:
	rm -rf dist mcp-client-dist
