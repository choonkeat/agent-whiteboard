ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))..

.PHONY: build clean

build: dist/whiteboard-mcp

dist/whiteboard-mcp: mcp-client-dist $(shell find . -name '*.go')
	@mkdir -p dist
	go build -o dist/whiteboard-mcp .

mcp-client-dist: $(shell find $(ROOT)/mcp-client -type f) $(shell find $(ROOT)/src -type f)
	cd $(ROOT) && npx vite build --config vite.mcp-client.config.ts

clean:
	rm -rf dist mcp-client-dist
