export type Formula = string | number;

export type MeasurementUnit = 'cm' | 'mm';

export interface BaseNode {
  name: string;
}

export type PointNode =
  | (BaseNode & { type: 'single'; x: number; y: number })
  | (BaseNode & { type: 'endLine'; basePoint: string; length: Formula; angle: Formula })
  | (BaseNode & {
      type: 'alongLine';
      firstPoint: string;
      secondPoint: string;
      length: Formula;
    })
  | (BaseNode & {
      type: 'normal';
      firstPoint: string;
      secondPoint: string;
      length: Formula;
      angle: Formula;
    })
  | (BaseNode & {
      type: 'bisector';
      firstPoint: string;
      secondPoint: string;
      thirdPoint: string;
      length: Formula;
    })
  | (BaseNode & { type: 'pointOfIntersection'; firstPoint: string; secondPoint: string })
  | (BaseNode & {
      type: 'lineIntersect';
      p1Line1: string;
      p2Line1: string;
      p1Line2: string;
      p2Line2: string;
    })
  | (BaseNode & {
      type: 'lineIntersectAxis';
      basePoint: string;
      p1Line: string;
      p2Line: string;
      angle: Formula;
    })
  | (BaseNode & { type: 'cutArc'; arc: string; length: Formula })
  | (BaseNode & { type: 'cutSpline'; spline: string; length: Formula })
  | (BaseNode & {
      type: 'shoulder';
      p1Line: string;
      p2Line: string;
      pShoulder: string;
      length: Formula;
    });

export type LineStyle = 'solidLine' | 'dashLine' | 'dotLine';

export interface LineNode {
  type: 'line';
  name: string;
  firstPoint: string;
  secondPoint: string;
  lineType?: LineStyle;
}

export interface SplineNode {
  type: 'spline';
  name: string;
  point1: string;
  point4: string;
  angle1: Formula;
  angle2: Formula;
  length1: Formula;
  length2: Formula;
}

export interface ArcNode {
  type: 'arc';
  name: string;
  center: string;
  radius: Formula;
  angle1: Formula;
  angle2: Formula;
}

export type CalculationElement = PointNode | LineNode | SplineNode | ArcNode;

export type ContourItemKind = 'point' | 'spline' | 'arc';

export interface DetailContourItem {
  refName: string;
  kind: ContourItemKind;
  reverse?: boolean;
  passmark?: boolean;
}

export interface DetailPiece {
  name: string;
  seamAllowanceCm: number;
  grainlineAngle: number;
  grainlineLengthCm: number;
  contour: DetailContourItem[];
}

export interface IncrementDefinition {
  name: string;
  formula: Formula;
  description?: string;
}

export interface DrawBlockInput {
  name: string;
  elements: CalculationElement[];
  pieces?: DetailPiece[];
}

export interface PatternInput {
  unit?: MeasurementUnit;
  description?: string;
  notes?: string;
  measurementsFile: string;
  increments?: IncrementDefinition[];
  drawBlocks: DrawBlockInput[];
}

export interface MeasurementEntry {
  name: string;
  value: number;
}

export interface MeasurementsDocument {
  version: '0.3.4';
  readOnly: boolean;
  notes: string;
  unit: MeasurementUnit;
  pmSystem: string;
  measurements: MeasurementEntry[];
}

export type SymbolKind = 'point' | 'line' | 'spline' | 'arc';

export interface SymbolMappingEntry {
  id: number;
  name: string;
  kind: SymbolKind;
  drawBlock: string;
}

export interface ResolvedIncrement {
  name: string;
  formula: string;
  description: string;
}

export type ResolvedPointNode =
  | { id: number; kind: 'point'; name: string; type: 'single'; x: number; y: number }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'endLine';
      basePointId: number;
      length: string;
      angle: string;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'alongLine';
      firstPointId: number;
      secondPointId: number;
      length: string;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'normal';
      firstPointId: number;
      secondPointId: number;
      length: string;
      angle: string;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'bisector';
      firstPointId: number;
      secondPointId: number;
      thirdPointId: number;
      length: string;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'pointOfIntersection';
      firstPointId: number;
      secondPointId: number;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'lineIntersect';
      p1Line1Id: number;
      p2Line1Id: number;
      p1Line2Id: number;
      p2Line2Id: number;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'lineIntersectAxis';
      basePointId: number;
      p1LineId: number;
      p2LineId: number;
      angle: string;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'cutArc';
      arcId: number;
      length: string;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'cutSpline';
      splineId: number;
      length: string;
    }
  | {
      id: number;
      kind: 'point';
      name: string;
      type: 'shoulder';
      p1LineId: number;
      p2LineId: number;
      pShoulderId: number;
      length: string;
    };

export interface ResolvedLineNode {
  id: number;
  kind: 'line';
  name: string;
  firstPointId: number;
  secondPointId: number;
  lineType: LineStyle;
}

export interface ResolvedSplineNode {
  id: number;
  kind: 'spline';
  name: string;
  point1Id: number;
  point4Id: number;
  angle1: string;
  angle2: string;
  length1: string;
  length2: string;
}

export interface ResolvedArcNode {
  id: number;
  kind: 'arc';
  name: string;
  centerId: number;
  radius: string;
  angle1: string;
  angle2: string;
}

export type ResolvedCalculationElement =
  | ResolvedPointNode
  | ResolvedLineNode
  | ResolvedSplineNode
  | ResolvedArcNode;

export type ResolvedModelingProxy =
  | { id: number; idObject: number; kind: 'point'; type: 'modeling'; refName: string }
  | { id: number; idObject: number; kind: 'spline'; type: 'modelingSpline'; refName: string }
  | { id: number; idObject: number; kind: 'arc'; type: 'modelingArc'; refName: string };

export type DetailNodeXmlType = 'NodePoint' | 'NodeSpline' | 'NodeArc';

export interface ResolvedDetailNode {
  id: number;
  idObject: number;
  type: DetailNodeXmlType;
  refName: string;
  reverse?: boolean;
  passmark?: boolean;
}

export interface ResolvedDetailPiece {
  id: number;
  name: string;
  seamAllowanceCm: number;
  grainlineAngle: number;
  grainlineLengthCm: number;
  nodes: ResolvedDetailNode[];
}

export interface ResolvedDrawBlock {
  name: string;
  calculation: ResolvedCalculationElement[];
  modeling: ResolvedModelingProxy[];
  details: ResolvedDetailPiece[];
}

export interface ResolvedPatternAst {
  version: '0.7.0';
  unit: MeasurementUnit;
  description: string;
  notes: string;
  measurementsFile: string;
  increments: ResolvedIncrement[];
  drawBlocks: ResolvedDrawBlock[];
  symbolTable: SymbolMappingEntry[];
  totalAllocatedIds: number;
}
