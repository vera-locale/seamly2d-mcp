# Contributing to `seamly2d-mcp`

## Development Setup

```bash
git clone https://github.com/vera-locale/seamly2d-mcp.git
cd seamly2d-mcp
npm ci
npm run build
```

## Quality Gates

Every PR must pass all checks enforced in `.github/workflows/ci.yml`:

```bash
npm run check          # Biome lint & format check (zero errors/warnings)
npm run build          # Strict TypeScript compilation (tsc)
npm run test:coverage  # Vitest suite with >90% coverage thresholds
```

Auto-format and apply safe Biome fixes with:

```bash
npm run check:write
```

## Running the Real Seamly2D CLI Integration Test

Unit tests mock `execFile` so CI runs cleanly without Seamly2D installed. To also run the end-to-end SVG export test against your local Seamly2D binary:

```bash
SEAMLY2D_PATH=/Applications/Seamly2D.app/Contents/MacOS/Seamly2D npm test
```

## Architecture Guardrails

- Keep `src/domain/` **100% pure TypeScript** (no `node:fs`, `node:child_process`, or external I/O).
- Never use `any` or `console.log` in `src/`.
- Never hand-write raw `.sm2d` or `.smme` XML in tests; always go through `PatternAstBuilder` and the XML serializers.
- See [.AGENTS.md](./.AGENTS.md) for the full agent and contributor specification.
