.PHONY: build publish publish-dry test

test:
	$(MAKE) -C mcp-server-go test

build:
	$(MAKE) -C mcp-server-go build
	./scripts/build-platforms.sh

publish-dry: build
	DRY_RUN=true ./scripts/publish.sh

publish: build
	DRY_RUN=false ./scripts/publish.sh
