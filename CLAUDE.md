# seamly2d-mcp Agent Governance Guide

## Project Overview

`seamly2d-mcp` is a production-grade Model Context Protocol (MCP) server in TypeScript (strict ESM) that enables AI agents to programmatically draft parametric Seamly2D sewing patterns (`.sm2d` v0.7.0), manage body measurement tables (`.smme` v0.5.0), inspect existing XML drafts, and compile/export patterns to SVG, PDF, and DXF via the headless Seamly2D CLI.

## Directory Map & Clean Architecture Rules

```text
src/
├── domain/          # 100% pure TypeScript: AST builder, geometric discriminated unions, ID registry, DAG validator
├── infrastructure/  # XML serializers (.sm2d/.smme), XML inspector, workspace FS repository, Seamly2D CLI wrapper
├── application/     # Zod schemas, MCP tool handlers, use cases, structured error mapper
└── index.ts         # Composition root & MCP stdio server entrypoint
tests/
├── domain/          # Pure unit tests for AST validation, ID allocation, and XML serialization
├── infrastructure/  # Mocked CLI tests, round-trip inspector tests, workspace repository tests
├── application/     # End-to-end MCP tool tests via InMemoryTransport
└── fixtures/        # Canonical test fixtures (Bodice Back Block)
```

### Strict Dependency Direction
- `src/domain/` **MUST remain 100% pure TypeScript**. Never import Node built-ins (`node:fs`, `node:child_process`, `node:path`), external I/O libraries, or anything from `src/infrastructure/` or `src/application/`.
- `src/infrastructure/` may import from `src/domain/` and Node/external libraries.
- `src/application/` orchestrates `src/domain/` and `src/infrastructure/`.
- `src/index.ts` is the sole composition root binding `StdioServerTransport`.

## Seamly2D Domain Invariants

1. **Symbolic-to-Numeric ID Resolution:** Agents never author raw integer IDs or raw XML. `PatternAstBuilder` assigns strictly sequential, globally unique integer IDs (`1, 2, 3, ...`) across ALL `<point>`, `<line>`, `<spline>`, `<arc>`, `<modeling>` proxies, `<detail>`, and `<node>` elements.
2. **Chronological DAG Ordering:** Every calculation element may ONLY reference points, splines, or arcs declared earlier in the draw block. Undeclared, self-referencing, or forward-referenced symbols throw `DomainValidationError`.
3. **Modeling & Detail Piece Projection:** Construction elements inside `<calculation>` are draft-only. For every item in a cuttable `DetailPiece`, `PatternAstBuilder` automatically emits:
   - A proxy element in `<modeling>` (`type="modeling"`, `"modelingSpline"`, or `"modelingArc"`) referencing the calculation element via `idObject`.
   - A `<node id="..." idObject="<modeling_id>" type="NodePoint|NodeSpline|NodeArc" .../>` in clockwise order inside `<details><detail><nodes>`.

### Supported `PointNode` Types
- `single` (`x`, `y`)
- `endLine` (`basePoint`, `length`, `angle`)
- `alongLine` (`firstPoint`, `secondPoint`, `length`)
- `normal` (`firstPoint`, `secondPoint`, `length`, `angle`)
- `bisector` (`firstPoint`, `secondPoint`, `thirdPoint`, `length`)
- `pointOfIntersection` (`firstPoint`, `secondPoint`)
- `lineIntersect` (`p1Line1`, `p2Line1`, `p1Line2`, `p2Line2`)
- `lineIntersectAxis` (`basePoint`, `p1Line`, `p2Line`, `angle`)
- `cutArc` (`arc`, `length`)
- `cutSpline` (`spline`, `length`)
- `shoulder` (`p1Line`, `p2Line`, `pShoulder`, `length`)

## `qMuParser` Math Engine Rules

- **Operators:** `+`, `-`, `*`, `/`, `^`, parentheses `(...)`.
- **Constants:** `pi`.
- **Functions (angles in DEGREES, NEVER radians):** `sin(x)`, `cos(x)`, `tan(x)`, `asin(x)`, `acos(x)`, `atan(x)`, `sqrt(x)`, `abs(x)`, `min(a; b)`, `max(a; b)`.
- **Argument Separator:** Always use semicolon `;` (e.g., `min(a; b)`), **NEVER** comma `,`.
- **Ternary Conditionals:** `(bust_circ > 100 ? 3 : 2)`.
- **Variables:**
  - Body measurements from `.smme` (e.g., `bust_circ`, `back_waist_length`)
  - Custom increments prefixed with `#` (e.g., `#ease_bust`, `#ease_waist`)
  - Auto-computed geometry values: `Line_A_A1`, `AngleLine_A_A1`, `Spl_A2_A5`, `Arc_A_12`

## Commands Cheat Sheet

```bash
npm run check          # Biome lint + format check (zero warnings/errors)
npm run check:write    # Auto-fix formatting and safe Biome rules
npm run build          # TypeScript strict compilation (tsc)
npm test               # Run Vitest unit & integration suite
npm run test:coverage  # Run Vitest with V8 coverage thresholds (>90%)
```

## Explicit Guardrails

- **Never use `any`** anywhere in `src/` or `tests/`.
- **Never bypass Biome** (`biome-ignore` is disallowed unless justified in review; zero warnings tolerated).
- **Never use `console.log`** in `src/` (it corrupts the MCP stdio JSON-RPC stream).
- **Never hand-write raw `.sm2d` or `.smme` XML in tests**; always construct documents via `PatternAstBuilder` and `serializeSm2d` / `serializeSmme`.
- **Always mock `execFileFn` in unit tests** for `Seamly2DCli`. Keep real binary tests opt-in and gated by `process.env.SEAMLY2D_PATH`.
