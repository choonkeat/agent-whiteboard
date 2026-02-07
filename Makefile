.PHONY: build publish publish-dry test

test:
	$(MAKE) -C mcp-server-go test

build:
	$(MAKE) -C mcp-server-go build
	./scripts/build-platforms.sh
	npm config set prefix $(HOME)/.swe-swe 2>/dev/null; npm link 2>/dev/null || true

publish-dry: build
	DRY_RUN=true ./scripts/publish.sh

publish: build
	DRY_RUN=false ./scripts/publish.sh
