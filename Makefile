.PHONY: build publish publish-dry test bump

test:
	$(MAKE) -C mcp-server-go test

build:
	@# Stop running MCP servers if they exist (using exact binary paths)
	@./scripts/stop-servers.sh
	$(MAKE) -C mcp-server-go build
	./scripts/build-platforms.sh
	npm config set prefix $(HOME)/.swe-swe 2>/dev/null; npm link 2>/dev/null || true
	@echo "✓ Build complete. Reconnect MCP in Claude Code to use the new version."

publish-dry: build
	DRY_RUN=true ./scripts/publish.sh

publish: build
	DRY_RUN=false ./scripts/publish.sh

bump:
	@if [ -z "$(VERSION)" ]; then \
		echo "Usage: make bump VERSION=x.y.z"; \
		exit 1; \
	fi
	@echo "Bumping version to $(VERSION)..."
	@# Update package.json
	@sed -i 's/"version": "[^"]*"/"version": "$(VERSION)"/' package.json
	@# Update Go server version
	@sed -i 's/Version: "[^"]*"/Version: "$(VERSION)"/' mcp-server-go/main.go
	@# Commit the changes
	@git add package.json mcp-server-go/main.go
	@git commit -m "Bump version to $(VERSION)"
	@echo "Version bumped to $(VERSION) and committed"
