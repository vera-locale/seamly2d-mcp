# seamly2d-mcp

[![CI](https://github.com/vera-locale/seamly2d-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vera-locale/seamly2d-mcp/actions/workflows/ci.yml)

A production-grade **Model Context Protocol (MCP)** server in strict TypeScript that enables AI agents to programmatically draft parametric [Seamly2D](https://seamly.io/) sewing patterns (`.sm2d` `v0.7.0`), manage body measurement tables (`.smme` `<smis>` `v0.3.4`), inspect existing drafts, and compile/export patterns to **SVG**, **PDF**, and **DXF** via the headless Seamly2D CLI.

---

## Features

- **Symbolic Parametric AST Builder (`src/domain/`):** Agents draft using human-readable symbols (`"A"`, `"A1"`, `"back_neckline"`). `PatternAstBuilder` enforces chronological DAG ordering, validates reference kinds, allocates strictly sequential globally unique integer IDs (`1, 2, 3...`), and automatically projects `<modeling>` proxies and clockwise `<pieces>` cuttable contours.
- **Seamly2D XSD-Compliant XML Serializers & Inspector (`src/infrastructure/`):** Serializes Seamly2D `.sm2d` (`pattern/v0.7.0.xsd`) and `.smme` (`individual_size_measurements/v0.3.4.xsd`) files and round-trip parses both modern and legacy drafts back into clean JSON with resolved symbolic references.
- **Headless CLI Export Wrapper:** Invokes the local Seamly2D CLI via `execFile` (`-b <basename> -d <destination> -f <0|1|2> -m <measurements> <pattern>`) for SVG (`0`), PDF (`1`), and DXF (`2`) exports, mapping `qMuParser` and XML parser errors into structured diagnostics.
- **4 MCP Tools:**
  1. `manage_measurements` — Create, merge, or overwrite `.smme` measurement tables.
  2. `build_parametric_pattern` — Validate, resolve, serialize, and save `.sm2d` patterns.
  3. `inspect_pattern` — Inspect existing `.sm2d` or `.smme` files as structured JSON.
  4. `compile_and_export_pattern` — Compile and export `.sm2d` + `.smme` to SVG, PDF, or DXF.

---

## Documentation

- [Architecture Guide](./docs/ARCHITECTURE.md) — Clean Architecture layers, dependency rules, and AST pipeline.
- [MCP Tools & Formula Reference](./docs/TOOLS_REFERENCE.md) — All 4 tools, 11 `PointNode` types, `qMuParser` rules, and error codes.
- [Contributing Guide](./CONTRIBUTING.md) — Local setup, quality gates, and opt-in real Seamly2D CLI testing.

---

## Installation

```bash
git clone https://github.com/vera-locale/seamly2d-mcp.git
cd seamly2d-mcp
npm ci
npm run build
```

---

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SEAMLY_WORKSPACE` | No | `process.cwd()` | Root directory where `.smme`, `.sm2d`, and exported layouts are read and written. Path traversal outside this directory is blocked. |
| `SEAMLY2D_PATH` | No | macOS: `/Applications/Seamly2D.app/Contents/MacOS/Seamly2D`<br/>Linux: `seamly2d` | Path to the local Seamly2D CLI executable used by `compile_and_export_pattern`. |

---

## MCP Client Configuration

### Claude Code CLI

```bash
claude mcp add seamly2d \
  --scope user \
  -e SEAMLY_WORKSPACE=/absolute/path/to/your/patterns \
  -e SEAMLY2D_PATH=/Applications/Seamly2D.app/Contents/MacOS/Seamly2D \
  -- node /absolute/path/to/seamly2d-mcp/dist/index.js
```

### Claude Desktop / Antigravity (`mcp_config.json` / `claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "seamly2d": {
      "command": "node",
      "args": ["/absolute/path/to/seamly2d-mcp/dist/index.js"],
      "env": {
        "SEAMLY_WORKSPACE": "/absolute/path/to/your/patterns",
        "SEAMLY2D_PATH": "/Applications/Seamly2D.app/Contents/MacOS/Seamly2D"
      }
    }
  }
}
```

---

## End-to-End Example Workflow: Bodice Back Block

> **Note on measurement names:** Use Seamly2D standard measurement names (`bust_circ`, `waist_circ`, `neck_circ`, `neck_back_to_waist_b`, `shoulder_length`), or prefix any custom measurement name with `@` (e.g., `@back_waist_length`) for strict Seamly2D CLI validation.

### Step 1: Create Body Measurements (`manage_measurements`)

```json
{
  "filename": "standard_size_38.smme",
  "unit": "cm",
  "mode": "overwrite",
  "measurements": {
    "bust_circ": 92,
    "waist_circ": 74,
    "neck_circ": 36,
    "@back_waist_length": 41,
    "shoulder_length": 12.5
  }
}
```

### Step 2: Draft Parametric Pattern (`build_parametric_pattern`)

```json
{
  "filename": "bodice_back_base",
  "measurementsFile": "standard_size_38.smme",
  "increments": [
    { "name": "#ease_bust", "formula": "2", "description": "Quarter bust ease in cm" },
    { "name": "#ease_waist", "formula": "1.5", "description": "Quarter waist ease in cm" }
  ],
  "drawBlocks": [
    {
      "name": "Bodice_Back",
      "elements": [
        { "type": "single", "name": "A", "x": 1, "y": 1 },
        { "type": "endLine", "name": "A1", "basePoint": "A", "length": "@back_waist_length", "angle": 270 },
        { "type": "endLine", "name": "A2", "basePoint": "A", "length": "bust_circ / 4 + #ease_bust", "angle": 0 },
        { "type": "pointOfIntersection", "name": "A3", "firstPoint": "A2", "secondPoint": "A1" },
        { "type": "endLine", "name": "A4", "basePoint": "A", "length": "neck_circ / 6 + 0.5", "angle": 0 },
        { "type": "endLine", "name": "A5", "basePoint": "A", "length": "2", "angle": 270 },
        { "type": "spline", "name": "back_neckline", "point1": "A5", "point4": "A4", "angle1": 0, "angle2": 270, "length1": "Line_A_A4 * 0.55", "length2": "1.1" },
        { "type": "endLine", "name": "A6", "basePoint": "A2", "length": "@back_waist_length / 2 + 2", "angle": 270 },
        { "type": "endLine", "name": "A7", "basePoint": "A4", "length": "shoulder_length", "angle": 342 },
        { "type": "spline", "name": "back_armhole", "point1": "A7", "point4": "A6", "angle1": 252, "angle2": 180, "length1": "6.5", "length2": "5.5" },
        { "type": "endLine", "name": "A8", "basePoint": "A1", "length": "waist_circ / 4 + #ease_waist", "angle": 0 }
      ],
      "pieces": [
        {
          "name": "Back_Bodice_Cut1_OnFold",
          "seamAllowanceCm": 1.0,
          "grainlineAngle": 90,
          "grainlineLengthCm": 20,
          "contour": [
            { "refName": "A5", "kind": "point" },
            { "refName": "back_neckline", "kind": "spline", "reverse": false },
            { "refName": "A4", "kind": "point" },
            { "refName": "A7", "kind": "point" },
            { "refName": "back_armhole", "kind": "spline", "reverse": false },
            { "refName": "A6", "kind": "point" },
            { "refName": "A8", "kind": "point" },
            { "refName": "A1", "kind": "point" }
          ]
        }
      ]
    }
  ]
}
```

### Step 3: Inspect or Export (`inspect_pattern` / `compile_and_export_pattern`)

```json
{
  "patternFile": "bodice_back_base.sm2d",
  "measurementsFile": "standard_size_38.smme",
  "format": "svg",
  "exportDir": "exports"
}
```

---

## Development & Quality Gates

```bash
npm run check          # Biome lint + format check
npm run build          # Strict TypeScript build
npm test               # Vitest test suite
npm run test:coverage  # Vitest coverage report (>90% threshold)
```
