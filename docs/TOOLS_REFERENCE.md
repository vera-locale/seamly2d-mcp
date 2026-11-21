# MCP Tools & Formula Reference

## Tools Overview

| Tool | Purpose | Input File(s) | Output |
| --- | --- | --- | --- |
| `manage_measurements` | Create, merge, or overwrite `.smme` (`<smis>` v0.3.4) measurement tables | `filename`, `measurements`, `unit`, `mode` | File path + merged measurement list |
| `build_parametric_pattern` | Validate DAG, resolve symbolic IDs, serialize `.sm2d` (`v0.7.0`) | `filename`, `measurementsFile`, `increments`, `drawBlocks` | File path + symbol-to-ID mapping table |
| `inspect_pattern` | Parse existing `.sm2d` or `.smme` XML into clean JSON | `filename` | Structured document summary with resolved names |
| `compile_and_export_pattern` | Run Seamly2D headless CLI to export SVG/PDF/DXF | `patternFile`, `measurementsFile`, `format` | CLI stdout/stderr + export metadata |

---

## Supported Calculation Elements (`build_parametric_pattern`)

Every element requires a unique `name` and may **only** reference symbols declared earlier in the same `drawBlock`.

### Point Types (`PointNode`)
| `type` | Required Fields | Description |
| --- | --- | --- |
| `single` | `x`, `y` | Absolute origin/anchor point |
| `endLine` | `basePoint`, `length`, `angle` | Point at distance `length` and `angle` (degrees) from `basePoint` |
| `alongLine` | `firstPoint`, `secondPoint`, `length` | Point along segment `(firstPoint -> secondPoint)` |
| `normal` | `firstPoint`, `secondPoint`, `length`, `angle` | Point along perpendicular from `firstPoint` relative to `secondPoint` |
| `bisector` | `firstPoint`, `secondPoint`, `thirdPoint`, `length` | Point on the angle bisector at vertex `secondPoint` |
| `pointOfIntersection` | `firstPoint`, `secondPoint` | Axis-aligned XY intersection (`X` from `firstPoint`, `Y` from `secondPoint`; serialized as `intersectXY`) |
| `lineIntersect` | `p1Line1`, `p2Line1`, `p1Line2`, `p2Line2` | Intersection of two lines |
| `lineIntersectAxis` | `basePoint`, `p1Line`, `p2Line`, `angle` | Intersection of a ray from `basePoint` at `angle` with line `(p1Line, p2Line)` |
| `cutArc` | `arc`, `length` | Point cutting an existing arc at arc length `length` |
| `cutSpline` | `spline`, `length` | Point cutting an existing spline at curve length `length` |
| `shoulder` | `p1Line`, `p2Line`, `pShoulder`, `length` | Shoulder tip point on line `(p1Line, p2Line)` at distance `length` from `pShoulder` |

### Lines, Curves & Detail Pieces
- **`line`**: `firstPoint`, `secondPoint`, optional `lineType` (`"solidLine" | "dashLine" | "dotLine"`).
- **`spline`**: `point1`, `point4`, `angle1`, `angle2`, `length1`, `length2` (`simpleInteractive` cubic Bezier).
- **`arc`**: `center`, `radius`, `angle1`, `angle2`.
- **`pieces[]`**: `name`, `seamAllowanceCm`, `grainlineAngle`, `grainlineLengthCm`, and clockwise `contour[]` items (`{ refName, kind: "point" | "spline" | "arc", reverse?, passmark? }`).

---

## `qMuParser` Formula Rules

- **Operators:** `+`, `-`, `*`, `/`, `^`, parentheses `(...)`
- **Constant:** `pi`
- **Angles:** Always in **degrees** (`0` = right, `90` = up, `180` = left, `270` = down).
- **Functions:** `sin(x)`, `cos(x)`, `tan(x)`, `asin(x)`, `acos(x)`, `atan(x)`, `sqrt(x)`, `abs(x)`, `min(a; b)`, `max(a; b)`
  - Always use **semicolon `;`** between function arguments (never comma `,`).
- **Conditionals:** `(bust_circ > 100 ? 3 : 2)`
- **Variables:**
  - Standard Seamly2D measurements (e.g., `bust_circ`, `waist_circ`, `neck_circ`, `neck_back_to_waist_b`, `shoulder_length`)
  - Custom measurements in `.smme` **must** be prefixed with `@` (e.g., `@back_waist_length`) for Seamly2D CLI compatibility
  - Custom pattern variables (`increments`) **must** be prefixed with `#` (e.g., `#ease_bust`)
  - Auto-computed geometry: `Line_A_A1`, `AngleLine_A_A1`, `Spl_A2_A5`, `Arc_A_12`

---

## Structured Error Codes

All tool errors return `isError: true` with a JSON payload:

```json
{
  "ok": false,
  "errorType": "DOMAIN_VALIDATION_ERROR",
  "code": "FORWARD_REFERENCE",
  "message": "...",
  "details": {}
}
```

| `errorType` | Codes |
| --- | --- |
| `DOMAIN_VALIDATION_ERROR` | `DUPLICATE_SYMBOL`, `UNDECLARED_SYMBOL`, `FORWARD_REFERENCE`, `SELF_REFERENCE`, `INVALID_SYMBOL_KIND`, `INVALID_INCREMENT_NAME`, `DUPLICATE_INCREMENT_NAME`, `DUPLICATE_DRAW_BLOCK`, `EMPTY_DRAW_BLOCKS`, `EMPTY_CONTOUR`, `INVALID_FORMULA`, `INVALID_VALUE` |
| `WORKSPACE_ERROR` | `PATH_TRAVERSAL`, `FILE_NOT_FOUND`, `IO_ERROR` |
| `XML_INSPECTION_ERROR` | `INVALID_XML`, `UNSUPPORTED_DOCUMENT` |
| `SEAMLY_CLI_ERROR` | `BINARY_NOT_FOUND`, `FORMULA_ERROR`, `XML_PARSE_ERROR`, `CLI_EXECUTION_ERROR` |
| `SCHEMA_VALIDATION_ERROR` | `INVALID_ARGUMENTS` |
