import { XMLParser } from 'fast-xml-parser';
import type { MeasurementEntry, MeasurementUnit } from '../../domain/index.js';

export class XmlInspectionError extends Error {
  public readonly code: 'INVALID_XML' | 'UNSUPPORTED_DOCUMENT';

  public constructor(code: 'INVALID_XML' | 'UNSUPPORTED_DOCUMENT', message: string) {
    super(message);
    this.name = 'XmlInspectionError';
    this.code = code;
  }
}

export interface InspectedMeasurements {
  documentType: 'smme';
  version: string;
  unit: MeasurementUnit;
  readOnly: boolean;
  pmSystem: string;
  notes: string;
  measurements: MeasurementEntry[];
}

export interface InspectedCalculationNode {
  id: number;
  tag: 'point' | 'line' | 'spline' | 'arc';
  name: string;
  type: string;
  references: Record<string, string>;
  formulas: Record<string, string>;
}

export interface InspectedDetailNode {
  id: number | undefined;
  modelingProxyId: number;
  targetId: number | undefined;
  targetName: string | undefined;
  type: string;
  reverse?: boolean;
  passmark?: boolean;
}

export interface InspectedDetailPiece {
  id: number;
  name: string;
  seamAllowanceCm: number;
  grainlineAngle: number | undefined;
  grainlineLengthCm: number | undefined;
  nodes: InspectedDetailNode[];
}

export interface InspectedDrawBlock {
  name: string;
  calculation: InspectedCalculationNode[];
  pieces: InspectedDetailPiece[];
}

export interface InspectedIncrement {
  name: string;
  formula: string;
  description: string;
}

export interface InspectedPattern {
  documentType: 'sm2d';
  version: string;
  unit: MeasurementUnit;
  description: string;
  notes: string;
  measurementsFile: string;
  increments: InspectedIncrement[];
  drawBlocks: InspectedDrawBlock[];
}

export type InspectedDocument = InspectedMeasurements | InspectedPattern;

type XmlRecord = Record<string, unknown>;

function isRecord(value: unknown): value is XmlRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function asUnit(value: unknown): MeasurementUnit {
  const str = asString(value, 'cm').trim();
  return str === 'mm' ? 'mm' : 'cm';
}

const REFERENCE_ATTRS: ReadonlyArray<string> = [
  'basePoint',
  'firstPoint',
  'secondPoint',
  'thirdPoint',
  'p1Line1',
  'p2Line1',
  'p1Line2',
  'p2Line2',
  'p1Line',
  'p2Line',
  'pShoulder',
  'point1',
  'point4',
  'center',
  'arc',
  'spline',
];

const FORMULA_ATTRS: ReadonlyArray<string> = [
  'length',
  'angle',
  'angle1',
  'angle2',
  'length1',
  'length2',
  'radius',
  'x',
  'y',
];

function createParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    isArray: (tagName: string): boolean =>
      [
        'm',
        'increment',
        'variable',
        'draw',
        'draftBlock',
        'point',
        'line',
        'spline',
        'arc',
        'detail',
        'piece',
        'node',
      ].includes(tagName),
  });
}

function parseSmmeRoot(vit: XmlRecord): InspectedMeasurements {
  const version = asString(vit.version, '0.3.4');
  const unit = asUnit(vit.unit);
  const readOnly = asString(vit['read-only'], 'false') === 'true';
  const pmSystem = asString(vit.pm_system, '998');
  const notes = asString(vit.notes, '');

  const measurements: MeasurementEntry[] = [];
  const bodyMeasurements = vit['body-measurements'];
  if (isRecord(bodyMeasurements)) {
    const entries = asArray(bodyMeasurements.m);
    for (const raw of entries) {
      if (!isRecord(raw)) {
        continue;
      }
      const name = asString(raw['@_name']).trim();
      const value = asNumber(raw['@_value']);
      if (name.length > 0 && value !== undefined) {
        measurements.push({ name, value });
      }
    }
  }

  return {
    documentType: 'smme',
    version,
    unit,
    readOnly,
    pmSystem,
    notes,
    measurements,
  };
}

function extractCalculationNodes(
  calculation: unknown,
  idToName: Map<number, string>,
): InspectedCalculationNode[] {
  if (!isRecord(calculation)) {
    return [];
  }

  const rawItems: Array<{ tag: 'point' | 'line' | 'spline' | 'arc'; record: XmlRecord }> = [];
  const tags: ReadonlyArray<'point' | 'line' | 'spline' | 'arc'> = [
    'point',
    'line',
    'spline',
    'arc',
  ];

  for (const tag of tags) {
    for (const entry of asArray(calculation[tag])) {
      if (isRecord(entry)) {
        rawItems.push({ tag, record: entry });
      }
    }
  }

  // Sort by numeric ID to reconstruct exact chronological drafting order.
  rawItems.sort((a, b) => {
    const idA = asNumber(a.record['@_id']) ?? 0;
    const idB = asNumber(b.record['@_id']) ?? 0;
    return idA - idB;
  });

  // First pass: populate idToName map.
  for (const item of rawItems) {
    const id = asNumber(item.record['@_id']);
    if (id === undefined) {
      continue;
    }
    const rawName = asString(item.record['@_name']).trim();
    const resolvedName = rawName.length > 0 ? rawName : `${item.tag}_${id}`;
    idToName.set(id, resolvedName);
  }

  const nodes: InspectedCalculationNode[] = [];
  for (const item of rawItems) {
    const id = asNumber(item.record['@_id']) ?? 0;
    const name = idToName.get(id) ?? `${item.tag}_${id}`;
    const type = asString(
      item.record['@_type'],
      item.tag === 'line'
        ? asString(item.record['@_lineType'] ?? item.record['@_typeLine'], 'solidLine')
        : item.tag,
    );

    const references: Record<string, string> = {};
    for (const refAttr of REFERENCE_ATTRS) {
      const rawVal = item.record[`@_${refAttr}`];
      const refId = asNumber(rawVal);
      if (refId !== undefined) {
        references[refAttr] = idToName.get(refId) ?? `#${refId}`;
      }
    }

    const formulas: Record<string, string> = {};
    for (const formulaAttr of FORMULA_ATTRS) {
      const rawVal = item.record[`@_${formulaAttr}`];
      if (rawVal !== undefined && asString(rawVal).length > 0) {
        formulas[formulaAttr] = asString(rawVal);
      }
    }

    nodes.push({
      id,
      tag: item.tag,
      name,
      type,
      references,
      formulas,
    });
  }

  return nodes;
}

function buildModelingProxyMap(modeling: unknown): Map<number, number> {
  const proxyToCalc = new Map<number, number>();
  if (!isRecord(modeling)) {
    return proxyToCalc;
  }

  for (const tag of ['point', 'spline', 'arc'] as const) {
    for (const entry of asArray(modeling[tag])) {
      if (!isRecord(entry)) {
        continue;
      }
      const proxyId = asNumber(entry['@_id']);
      const targetId = asNumber(entry['@_idObject']);
      if (proxyId !== undefined && targetId !== undefined) {
        proxyToCalc.set(proxyId, targetId);
      }
    }
  }

  return proxyToCalc;
}

function extractDetailPieces(
  details: unknown,
  proxyToCalc: ReadonlyMap<number, number>,
  idToName: ReadonlyMap<number, string>,
): InspectedDetailPiece[] {
  if (!isRecord(details)) {
    return [];
  }

  const pieces: InspectedDetailPiece[] = [];
  const rawPieces = [...asArray(details.piece), ...asArray(details.detail)];
  for (const rawDetail of rawPieces) {
    if (!isRecord(rawDetail)) {
      continue;
    }

    const id = asNumber(rawDetail['@_id']) ?? 0;
    const name = asString(rawDetail['@_name'], `detail_${id}`);
    const seamAllowanceEnabled = asString(rawDetail['@_seamAllowance'], 'false') === 'true';
    const seamAllowanceWidth = asNumber(rawDetail['@_width']) ?? 0;
    const seamAllowanceCm = seamAllowanceEnabled ? seamAllowanceWidth : 0;

    let grainlineAngle: number | undefined;
    let grainlineLengthCm: number | undefined;
    if (isRecord(rawDetail.grainline)) {
      grainlineAngle = asNumber(rawDetail.grainline['@_rotation']);
      grainlineLengthCm = asNumber(rawDetail.grainline['@_length']);
    }

    const nodes: InspectedDetailNode[] = [];
    if (isRecord(rawDetail.nodes)) {
      for (const rawNode of asArray(rawDetail.nodes.node)) {
        if (!isRecord(rawNode)) {
          continue;
        }
        const nodeId = asNumber(rawNode['@_id']);
        const modelingProxyId = asNumber(rawNode['@_idObject']) ?? 0;
        const targetId = proxyToCalc.get(modelingProxyId);
        const targetName = targetId !== undefined ? idToName.get(targetId) : undefined;
        const nodeType = asString(rawNode['@_type'], 'NodePoint');

        const inspectedNode: InspectedDetailNode = {
          id: nodeId,
          modelingProxyId,
          targetId,
          targetName,
          type: nodeType,
        };

        const rawReverse = rawNode['@_reverse'];
        if (rawReverse !== undefined) {
          inspectedNode.reverse = asString(rawReverse) === '1' || asString(rawReverse) === 'true';
        }

        const rawPassmark = rawNode['@_notch'] ?? rawNode['@_passmark'];
        if (rawPassmark !== undefined) {
          inspectedNode.passmark =
            asString(rawPassmark) === 'true' || asString(rawPassmark) === '1';
        }

        nodes.push(inspectedNode);
      }
    }

    pieces.push({
      id,
      name,
      seamAllowanceCm,
      grainlineAngle,
      grainlineLengthCm,
      nodes,
    });
  }

  return pieces;
}

function parseSm2dRoot(pattern: XmlRecord): InspectedPattern {
  const version = asString(pattern.version, '0.7.0');
  const unit = asUnit(pattern.unit);
  const description = asString(pattern.description, '');
  const notes = asString(pattern.notes, '');
  const measurementsFile = asString(pattern.measurements, '');

  const increments: InspectedIncrement[] = [];
  const variablesContainer = isRecord(pattern.variables)
    ? pattern.variables
    : isRecord(pattern.increments)
      ? pattern.increments
      : undefined;
  if (variablesContainer !== undefined) {
    const rawVars = [
      ...asArray(variablesContainer.variable),
      ...asArray(variablesContainer.increment),
    ];
    for (const rawInc of rawVars) {
      if (!isRecord(rawInc)) {
        continue;
      }
      const name = asString(rawInc['@_name']).trim();
      const formula = asString(rawInc['@_formula']).trim();
      const incDesc = asString(rawInc['@_description'], '');
      if (name.length > 0) {
        increments.push({ name, formula, description: incDesc });
      }
    }
  }

  const drawBlocks: InspectedDrawBlock[] = [];
  const globalIdToName = new Map<number, string>();
  const rawBlocks = [...asArray(pattern.draftBlock), ...asArray(pattern.draw)];

  for (const rawDraw of rawBlocks) {
    if (!isRecord(rawDraw)) {
      continue;
    }
    const blockName = asString(rawDraw['@_name'], 'Unnamed_Block');
    const calculation = extractCalculationNodes(rawDraw.calculation, globalIdToName);
    const proxyToCalc = buildModelingProxyMap(rawDraw.modeling);
    const pieces = extractDetailPieces(
      rawDraw.pieces ?? rawDraw.details,
      proxyToCalc,
      globalIdToName,
    );

    drawBlocks.push({
      name: blockName,
      calculation,
      pieces,
    });
  }

  return {
    documentType: 'sm2d',
    version,
    unit,
    description,
    notes,
    measurementsFile,
    increments,
    drawBlocks,
  };
}

export function inspectXmlContent(xmlContent: string): InspectedDocument {
  if (xmlContent.trim().length === 0) {
    throw new XmlInspectionError('INVALID_XML', 'XML content is empty.');
  }

  let parsed: unknown;
  try {
    const parser = createParser();
    parsed = parser.parse(xmlContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new XmlInspectionError('INVALID_XML', `Failed to parse XML: ${msg}`);
  }

  if (!isRecord(parsed)) {
    throw new XmlInspectionError('INVALID_XML', 'Parsed XML did not produce an object root.');
  }

  if (isRecord(parsed.smis)) {
    return parseSmmeRoot(parsed.smis);
  }

  if (isRecord(parsed.vit)) {
    return parseSmmeRoot(parsed.vit);
  }

  if (isRecord(parsed.pattern)) {
    return parseSm2dRoot(parsed.pattern);
  }

  throw new XmlInspectionError(
    'UNSUPPORTED_DOCUMENT',
    'XML document must have a <smis>/<vit> (.smme) or <pattern> (.sm2d) root element.',
  );
}
