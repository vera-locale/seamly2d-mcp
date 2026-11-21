import { z } from 'zod';

const QMUPARSER_FORMULA_DOC =
  'Seamly2D qMuParser formula string or finite number. ' +
  'Operators: +, -, *, /, ^, (...). Constant: pi. ' +
  'Functions (angles in DEGREES, NOT radians; use SEMICOLON ";" between arguments, NEVER comma): ' +
  'sin(x), cos(x), tan(x), asin(x), acos(x), atan(x), sqrt(x), abs(x), min(a; b), max(a; b). ' +
  'Ternary conditionals: (bust_circ > 100 ? 3 : 2). ' +
  'Variables: .smme measurement names (e.g. bust_circ), increments prefixed with # (e.g. #ease_bust), ' +
  'and auto-computed geometry values (Line_A_A1, AngleLine_A_A1, Spl_A2_A5, Arc_A_12).';

export const FormulaSchema = z
  .union([z.string().min(1), z.number().finite()])
  .describe(QMUPARSER_FORMULA_DOC);

export const MeasurementUnitSchema = z
  .enum(['cm', 'mm'])
  .describe('Measurement unit for the document ("cm" or "mm").');

const BaseNameField = z
  .string()
  .min(1)
  .describe('Unique human-readable symbolic name (e.g. "A", "A1", "back_neckline").');

const PointRefField = z
  .string()
  .min(1)
  .describe('Symbolic name of a previously declared point node.');

export const CalculationElementSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('single'),
      name: BaseNameField,
      x: z.number().finite().describe('Absolute X coordinate in pattern units.'),
      y: z.number().finite().describe('Absolute Y coordinate in pattern units.'),
    })
    .describe('Anchor/origin point at absolute (x, y) coordinates.'),
  z
    .object({
      type: z.literal('endLine'),
      name: BaseNameField,
      basePoint: PointRefField.describe('Starting point symbol.'),
      length: FormulaSchema.describe('Line length formula.'),
      angle: FormulaSchema.describe('Line angle in degrees (0=right, 90=up, 180=left, 270=down).'),
    })
    .describe('Point at distance `length` and `angle` (degrees) from `basePoint`.'),
  z
    .object({
      type: z.literal('alongLine'),
      name: BaseNameField,
      firstPoint: PointRefField,
      secondPoint: PointRefField,
      length: FormulaSchema.describe('Distance from firstPoint along the line toward secondPoint.'),
    })
    .describe('Point positioned along the line from `firstPoint` to `secondPoint`.'),
  z
    .object({
      type: z.literal('normal'),
      name: BaseNameField,
      firstPoint: PointRefField,
      secondPoint: PointRefField,
      length: FormulaSchema,
      angle: FormulaSchema.describe('Offset angle in degrees relative to the perpendicular.'),
    })
    .describe('Point along a normal (perpendicular) from `firstPoint` relative to `secondPoint`.'),
  z
    .object({
      type: z.literal('bisector'),
      name: BaseNameField,
      firstPoint: PointRefField,
      secondPoint: PointRefField.describe('Vertex point of the angle being bisected.'),
      thirdPoint: PointRefField,
      length: FormulaSchema,
    })
    .describe('Point along the angle bisector of (firstPoint, secondPoint, thirdPoint).'),
  z
    .object({
      type: z.literal('pointOfIntersection'),
      name: BaseNameField,
      firstPoint: PointRefField.describe('Point providing the X coordinate (vertical axis).'),
      secondPoint: PointRefField.describe('Point providing the Y coordinate (horizontal axis).'),
    })
    .describe('Axis-aligned intersection taking X from `firstPoint` and Y from `secondPoint`.'),
  z
    .object({
      type: z.literal('lineIntersect'),
      name: BaseNameField,
      p1Line1: PointRefField,
      p2Line1: PointRefField,
      p1Line2: PointRefField,
      p2Line2: PointRefField,
    })
    .describe('Intersection of line (p1Line1, p2Line1) and line (p1Line2, p2Line2).'),
  z
    .object({
      type: z.literal('lineIntersectAxis'),
      name: BaseNameField,
      basePoint: PointRefField,
      p1Line: PointRefField,
      p2Line: PointRefField,
      angle: FormulaSchema.describe('Axis ray angle in degrees originating from `basePoint`.'),
    })
    .describe('Intersection of a ray from `basePoint` at `angle` with line (p1Line, p2Line).'),
  z
    .object({
      type: z.literal('cutArc'),
      name: BaseNameField,
      arc: z.string().min(1).describe('Symbolic name of a previously declared arc.'),
      length: FormulaSchema.describe('Arc length from start of arc to the cut point.'),
    })
    .describe('Point that cuts an existing arc at the specified arc length.'),
  z
    .object({
      type: z.literal('cutSpline'),
      name: BaseNameField,
      spline: z.string().min(1).describe('Symbolic name of a previously declared spline.'),
      length: FormulaSchema.describe('Curve length from start of spline to the cut point.'),
    })
    .describe('Point that cuts an existing spline at the specified curve length.'),
  z
    .object({
      type: z.literal('shoulder'),
      name: BaseNameField,
      p1Line: PointRefField,
      p2Line: PointRefField,
      pShoulder: PointRefField,
      length: FormulaSchema,
    })
    .describe(
      'Point on line (p1Line, p2Line) at distance `length` from `pShoulder` (shoulder tip construction).',
    ),
  z
    .object({
      type: z.literal('line'),
      name: BaseNameField,
      firstPoint: PointRefField,
      secondPoint: PointRefField,
      lineType: z
        .enum(['solidLine', 'dashLine', 'dotLine'])
        .optional()
        .describe('Visual construction line style (default: "solidLine").'),
    })
    .describe('Drafting construction line connecting two previously declared points.'),
  z
    .object({
      type: z.literal('spline'),
      name: BaseNameField,
      point1: PointRefField.describe('Start point of the cubic Bezier spline.'),
      point4: PointRefField.describe('End point of the cubic Bezier spline.'),
      angle1: FormulaSchema.describe('Outgoing tangent angle in degrees at point1.'),
      angle2: FormulaSchema.describe('Incoming tangent angle in degrees at point4.'),
      length1: FormulaSchema.describe('Control handle length at point1.'),
      length2: FormulaSchema.describe('Control handle length at point4.'),
    })
    .describe('Cubic Bezier curve (simpleInteractive spline) between `point1` and `point4`.'),
  z
    .object({
      type: z.literal('arc'),
      name: BaseNameField,
      center: PointRefField.describe('Center point of the circular arc.'),
      radius: FormulaSchema.describe('Arc radius formula.'),
      angle1: FormulaSchema.describe('Start angle in degrees.'),
      angle2: FormulaSchema.describe('End angle in degrees.'),
    })
    .describe('Circular arc centered at `center` from `angle1` to `angle2`.'),
]);

export const DetailContourItemSchema = z.object({
  refName: z
    .string()
    .min(1)
    .describe('Symbolic name of a previously declared point, spline, or arc in this draw block.'),
  kind: z.enum(['point', 'spline', 'arc']).describe('Element kind matching the referenced symbol.'),
  reverse: z
    .boolean()
    .optional()
    .describe(
      'For splines/arcs: set true if the curve must be traversed in reverse to maintain clockwise contour order.',
    ),
  passmark: z
    .boolean()
    .optional()
    .describe('For points: set true to emit a Seamly2D notch/passmark at this contour point.'),
});

export const DetailPieceSchema = z.object({
  name: z.string().min(1).describe('Cuttable pattern piece name (e.g. "Back_Bodice_Cut1_OnFold").'),
  seamAllowanceCm: z
    .number()
    .min(0)
    .finite()
    .describe('Uniform seam allowance width in cm (0 disables seam allowance).'),
  grainlineAngle: z
    .number()
    .finite()
    .describe('Grainline orientation angle in degrees (90 = vertical).'),
  grainlineLengthCm: z
    .number()
    .positive()
    .finite()
    .describe('Visible grainline arrow length in cm.'),
  contour: z
    .array(DetailContourItemSchema)
    .min(1)
    .describe(
      'Clockwise sequence of points, splines, and arcs forming the cuttable piece perimeter.',
    ),
});

export const IncrementSchema = z.object({
  name: z
    .string()
    .regex(
      /^#\S+$/,
      'Increment name must start with "#" and contain no whitespace (e.g. "#ease_bust").',
    )
    .describe('Custom increment variable name prefixed with "#" (e.g. "#ease_bust").'),
  formula: FormulaSchema.describe('qMuParser formula or numeric value for the increment.'),
  description: z.string().optional().describe('Human-readable description of the increment.'),
});

export const DrawBlockSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe('Unique name for the Seamly2D <draw> block (e.g. "Bodice_Back").'),
  elements: z
    .array(CalculationElementSchema)
    .min(1)
    .describe(
      'Chronologically ordered geometric construction elements. Every element may ONLY reference symbols declared earlier in this array.',
    ),
  pieces: z
    .array(DetailPieceSchema)
    .optional()
    .describe('Cuttable detail pieces projected from the calculation elements.'),
});

export const ManageMeasurementsInputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .describe(
      'Target measurement filename in SEAMLY_WORKSPACE (".smme" extension appended automatically if omitted).',
    ),
  unit: MeasurementUnitSchema.default('cm'),
  mode: z
    .enum(['merge', 'overwrite'])
    .default('merge')
    .describe(
      '"merge" preserves existing measurements in the file and updates/adds provided entries; "overwrite" replaces the entire file.',
    ),
  notes: z.string().optional().describe('Optional notes stored inside <notes>.'),
  pmSystem: z.string().optional().describe('Optional patternmaking system code (default: "998").'),
  measurements: z
    .record(
      z.string().min(1),
      z.number().finite().positive().describe('Positive measurement value in the chosen unit.'),
    )
    .describe(
      'Map of Seamly2D measurement names to numeric values (e.g. { "bust_circ": 92, "waist_circ": 74 }).',
    ),
});

export const BuildParametricPatternInputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .describe(
      'Output pattern filename in SEAMLY_WORKSPACE (".sm2d" extension appended automatically if omitted).',
    ),
  measurementsFile: z
    .string()
    .min(1)
    .describe('Relative filename of the .smme measurement table referenced by <measurements>.'),
  unit: MeasurementUnitSchema.default('cm'),
  description: z.string().optional().describe('Optional pattern description.'),
  notes: z.string().optional().describe('Optional pattern notes.'),
  increments: z
    .array(IncrementSchema)
    .optional()
    .describe('Optional custom increments (#variable) available in all qMuParser formulas.'),
  drawBlocks: z
    .array(DrawBlockSchema)
    .min(1)
    .describe(
      'One or more parametric drafting blocks with calculation elements and optional cuttable detail pieces.',
    ),
});

export const InspectPatternInputSchema = z.object({
  filename: z
    .string()
    .min(1)
    .describe(
      'Relative path to an existing .sm2d pattern or .smme measurement file inside SEAMLY_WORKSPACE.',
    ),
});

export const CompileAndExportPatternInputSchema = z.object({
  patternFile: z
    .string()
    .min(1)
    .describe('Relative path to the .sm2d pattern file inside SEAMLY_WORKSPACE.'),
  measurementsFile: z
    .string()
    .min(1)
    .describe('Relative path to the .smme measurements file inside SEAMLY_WORKSPACE.'),
  format: z
    .enum(['svg', 'pdf', 'dxf'])
    .describe('Export file format: "svg" (code 0), "pdf" (code 1), or "dxf" (code 2).'),
  exportDir: z
    .string()
    .default('exports')
    .describe('Output directory relative to SEAMLY_WORKSPACE (created automatically if missing).'),
  outputName: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Base name for exported layout files (defaults to pattern filename without extension).',
    ),
});

export type ManageMeasurementsInput = z.infer<typeof ManageMeasurementsInputSchema>;
export type BuildParametricPatternInput = z.infer<typeof BuildParametricPatternInputSchema>;
export type InspectPatternInput = z.infer<typeof InspectPatternInputSchema>;
export type CompileAndExportPatternInput = z.infer<typeof CompileAndExportPatternInputSchema>;
