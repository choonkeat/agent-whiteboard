# ADR 003: npm link in Makefile for Local Development

## Status
Accepted

## Context
When developing agent-whiteboard inside a swe-swe container, `npx -y @choonkeat/agent-whiteboard` fails because npx gets confused by the matching local `package.json` name and can't find the `agent-whiteboard` bin shim. This only happens when running npx from within the agent-whiteboard workspace — end users and swe-swe templates work fine since they run npx from a different directory.

The swe-swe templates (used by Codex, OpenCode, etc.) standardize on `npx -y @choonkeat/agent-whiteboard` as the MCP server command. We want to keep this consistent rather than hardcoding direct binary paths in per-tool config files.

## Decision
Add `npm link` to the Makefile `build` target so that the local build is globally available via the same `npx` command:

```makefile
build:
	$(MAKE) -C mcp-server-go build
	./scripts/build-platforms.sh
	npm config set prefix $(HOME)/.swe-swe 2>/dev/null; npm link 2>/dev/null || true
```

Key details:
- The prefix is set to `$(HOME)/.swe-swe`, whose `bin/` is already on PATH in swe-swe containers
- `npm link` creates a global symlink `agent-whiteboard` → `bin/agent-whiteboard.js`, which resolves to the freshly built binary via the `npm-platforms/` fallback
- `|| true` makes it a no-op outside swe-swe containers where the prefix directory may not exist
- Tool configs (`~/.codex/config.toml`, `~/.config/opencode/opencode.json`) use the standard `npx -y @choonkeat/agent-whiteboard` command, matching the swe-swe templates

## Consequences

### Positive
- `npx -y @choonkeat/agent-whiteboard` works identically inside and outside the workspace
- Tool configs match the swe-swe templates exactly — no divergence to maintain
- No manual setup step; `make build` handles everything
- Harmless no-op outside swe-swe containers

### Negative
- Depends on `$(HOME)/.swe-swe/bin` being on PATH (true in swe-swe containers by convention)
- `npm link` is a global side-effect, which could surprise developers if they have other versions installed globally (mitigated by the scoped prefix)

### Alternatives Considered
- **Hardcode direct binary path in tool configs** — Works but diverges from swe-swe templates, creating maintenance burden
- **Symlink manually in a setup script** — More moving parts, easy to forget
- **Use a wrapper script instead of npm link** — More indirection for the same result
