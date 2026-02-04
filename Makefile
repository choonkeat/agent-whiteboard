.PHONY: build publish publish-dry

build:
	./scripts/build-platforms.sh

publish-dry: build
	DRY_RUN=true ./scripts/publish.sh

publish: build
	DRY_RUN=false ./scripts/publish.sh
