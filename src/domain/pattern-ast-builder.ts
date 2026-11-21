import { DomainValidationError } from './errors.js';
import { IdRegistry } from './id-registry.js';
import type {
  CalculationElement,
  DetailContourItem,
  DetailNodeXmlType,
  DetailPiece,
  DrawBlockInput,
  Formula,
  IncrementDefinition,
  PatternInput,
  ResolvedCalculationElement,
  ResolvedDetailNode,
  ResolvedDetailPiece,
  ResolvedDrawBlock,
  ResolvedIncrement,
  ResolvedModelingProxy,
  ResolvedPatternAst,
  SymbolKind,
} from './types.js';

function normalizeFormula(formula: Formula, fieldName: string, contextName: string): string {
  if (typeof formula === 'number') {
    if (!Number.isFinite(formula)) {
      throw new DomainValidationError(
        'INVALID_FORMULA',
        `Formula field "${fieldName}" on "${contextName}" must be a finite number.`,
        { fieldName, contextName },
      );
    }
    return String(formula);
  }

  const trimmed = formula.trim();
  if (trimmed.length === 0) {
    throw new DomainValidationError(
      'INVALID_FORMULA',
      `Formula field "${fieldName}" on "${contextName}" cannot be empty.`,
      { fieldName, contextName },
    );
  }
  return trimmed;
}

function assertFiniteNumber(value: number, fieldName: string, contextName: string): number {
  if (!Number.isFinite(value)) {
    throw new DomainValidationError(
      'INVALID_VALUE',
      `Numeric field "${fieldName}" on "${contextName}" must be finite.`,
      { fieldName, contextName },
    );
  }
  return value;
}

function getElementKind(element: CalculationElement): SymbolKind {
  switch (element.type) {
    case 'line':
      return 'line';
    case 'spline':
      return 'spline';
    case 'arc':
      return 'arc';
    default:
      return 'point';
  }
}

function getDetailNodeType(kind: DetailContourItem['kind']): DetailNodeXmlType {
  switch (kind) {
    case 'point':
      return 'NodePoint';
    case 'spline':
      return 'NodeSpline';
    case 'arc':
      return 'NodeArc';
  }
}

export class PatternAstBuilder {
  public build(input: PatternInput): ResolvedPatternAst {
    if (input.drawBlocks.length === 0) {
      throw new DomainValidationError(
        'EMPTY_DRAW_BLOCKS',
        'Pattern must contain at least one draw block.',
      );
    }

    const measurementsFile = input.measurementsFile.trim();
    if (measurementsFile.length === 0) {
      throw new DomainValidationError('INVALID_VALUE', 'measurementsFile cannot be empty.');
    }

    const increments = this.resolveIncrements(input.increments ?? []);
    const registry = new IdRegistry();
    const seenDrawBlocks = new Set<string>();
    const resolvedDrawBlocks: ResolvedDrawBlock[] = [];

    for (const block of input.drawBlocks) {
      const blockName = block.name.trim();
      if (blockName.length === 0) {
        throw new DomainValidationError('INVALID_VALUE', 'Draw block name cannot be empty.');
      }
      if (seenDrawBlocks.has(blockName)) {
        throw new DomainValidationError(
          'DUPLICATE_DRAW_BLOCK',
          `Duplicate draw block name "${blockName}".`,
          { drawBlock: blockName },
        );
      }
      seenDrawBlocks.add(blockName);

      resolvedDrawBlocks.push(this.resolveDrawBlock(block, blockName, registry));
    }

    return {
      version: '0.7.0',
      unit: input.unit ?? 'cm',
      description: input.description ?? '',
      notes: input.notes ?? '',
      measurementsFile,
      increments,
      drawBlocks: resolvedDrawBlocks,
      symbolTable: registry.getSymbolTable(),
      totalAllocatedIds: registry.getTotalAllocatedIds(),
    };
  }

  private resolveIncrements(increments: IncrementDefinition[]): ResolvedIncrement[] {
    const seen = new Set<string>();
    const resolved: ResolvedIncrement[] = [];

    for (const inc of increments) {
      const name = inc.name.trim();
      if (!name.startsWith('#') || name.length < 2 || /\s/.test(name)) {
        throw new DomainValidationError(
          'INVALID_INCREMENT_NAME',
          `Increment name "${inc.name}" must start with "#" and contain no whitespace (e.g. "#ease_bust").`,
          { increment: inc.name },
        );
      }
      if (seen.has(name)) {
        throw new DomainValidationError(
          'DUPLICATE_INCREMENT_NAME',
          `Duplicate increment name "${name}".`,
          { increment: name },
        );
      }
      seen.add(name);

      resolved.push({
        name,
        formula: normalizeFormula(inc.formula, 'formula', name),
        description: inc.description ?? '',
      });
    }

    return resolved;
  }

  private resolveDrawBlock(
    block: DrawBlockInput,
    blockName: string,
    registry: IdRegistry,
  ): ResolvedDrawBlock {
    const remainingNames = new Set<string>(block.elements.map((el) => el.name.trim()));
    const calculation: ResolvedCalculationElement[] = [];

    for (const element of block.elements) {
      const elementName = element.name.trim();
      remainingNames.delete(elementName);

      const resolvedElement = this.resolveCalculationElement(
        element,
        elementName,
        blockName,
        registry,
        remainingNames,
      );
      calculation.push(resolvedElement);
    }

    const modeling: ResolvedModelingProxy[] = [];
    const details: ResolvedDetailPiece[] = [];
    const seenPieces = new Set<string>();

    for (const piece of block.pieces ?? []) {
      const pieceName = piece.name.trim();
      if (pieceName.length === 0) {
        throw new DomainValidationError(
          'INVALID_VALUE',
          `Detail piece name cannot be empty in draw block "${blockName}".`,
          { drawBlock: blockName },
        );
      }
      if (seenPieces.has(pieceName)) {
        throw new DomainValidationError(
          'DUPLICATE_SYMBOL',
          `Duplicate detail piece name "${pieceName}" in draw block "${blockName}".`,
          { piece: pieceName, drawBlock: blockName },
        );
      }
      seenPieces.add(pieceName);

      const resolvedPiece = this.resolveDetailPiece(
        piece,
        pieceName,
        blockName,
        registry,
        modeling,
      );
      details.push(resolvedPiece);
    }

    return {
      name: blockName,
      calculation,
      modeling,
      details,
    };
  }

  private resolveCalculationElement(
    element: CalculationElement,
    elementName: string,
    blockName: string,
    registry: IdRegistry,
    futureSymbols: ReadonlySet<string>,
  ): ResolvedCalculationElement {
    const resolveRef = (refName: string, expectedKind: SymbolKind): number =>
      registry.resolveSymbol(refName, expectedKind, elementName, blockName, futureSymbols).id;

    const kind = getElementKind(element);

    switch (element.type) {
      case 'single': {
        const x = assertFiniteNumber(element.x, 'x', elementName);
        const y = assertFiniteNumber(element.y, 'y', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return { id: entry.id, kind: 'point', name: entry.name, type: 'single', x, y };
      }
      case 'endLine': {
        const basePointId = resolveRef(element.basePoint, 'point');
        const length = normalizeFormula(element.length, 'length', elementName);
        const angle = normalizeFormula(element.angle, 'angle', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'endLine',
          basePointId,
          length,
          angle,
        };
      }
      case 'alongLine': {
        const firstPointId = resolveRef(element.firstPoint, 'point');
        const secondPointId = resolveRef(element.secondPoint, 'point');
        const length = normalizeFormula(element.length, 'length', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'alongLine',
          firstPointId,
          secondPointId,
          length,
        };
      }
      case 'normal': {
        const firstPointId = resolveRef(element.firstPoint, 'point');
        const secondPointId = resolveRef(element.secondPoint, 'point');
        const length = normalizeFormula(element.length, 'length', elementName);
        const angle = normalizeFormula(element.angle, 'angle', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'normal',
          firstPointId,
          secondPointId,
          length,
          angle,
        };
      }
      case 'bisector': {
        const firstPointId = resolveRef(element.firstPoint, 'point');
        const secondPointId = resolveRef(element.secondPoint, 'point');
        const thirdPointId = resolveRef(element.thirdPoint, 'point');
        const length = normalizeFormula(element.length, 'length', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'bisector',
          firstPointId,
          secondPointId,
          thirdPointId,
          length,
        };
      }
      case 'pointOfIntersection': {
        const firstPointId = resolveRef(element.firstPoint, 'point');
        const secondPointId = resolveRef(element.secondPoint, 'point');
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'pointOfIntersection',
          firstPointId,
          secondPointId,
        };
      }
      case 'lineIntersect': {
        const p1Line1Id = resolveRef(element.p1Line1, 'point');
        const p2Line1Id = resolveRef(element.p2Line1, 'point');
        const p1Line2Id = resolveRef(element.p1Line2, 'point');
        const p2Line2Id = resolveRef(element.p2Line2, 'point');
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'lineIntersect',
          p1Line1Id,
          p2Line1Id,
          p1Line2Id,
          p2Line2Id,
        };
      }
      case 'lineIntersectAxis': {
        const basePointId = resolveRef(element.basePoint, 'point');
        const p1LineId = resolveRef(element.p1Line, 'point');
        const p2LineId = resolveRef(element.p2Line, 'point');
        const angle = normalizeFormula(element.angle, 'angle', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'lineIntersectAxis',
          basePointId,
          p1LineId,
          p2LineId,
          angle,
        };
      }
      case 'cutArc': {
        const arcId = resolveRef(element.arc, 'arc');
        const length = normalizeFormula(element.length, 'length', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'cutArc',
          arcId,
          length,
        };
      }
      case 'cutSpline': {
        const splineId = resolveRef(element.spline, 'spline');
        const length = normalizeFormula(element.length, 'length', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'cutSpline',
          splineId,
          length,
        };
      }
      case 'shoulder': {
        const p1LineId = resolveRef(element.p1Line, 'point');
        const p2LineId = resolveRef(element.p2Line, 'point');
        const pShoulderId = resolveRef(element.pShoulder, 'point');
        const length = normalizeFormula(element.length, 'length', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'point',
          name: entry.name,
          type: 'shoulder',
          p1LineId,
          p2LineId,
          pShoulderId,
          length,
        };
      }
      case 'line': {
        const firstPointId = resolveRef(element.firstPoint, 'point');
        const secondPointId = resolveRef(element.secondPoint, 'point');
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'line',
          name: entry.name,
          firstPointId,
          secondPointId,
          lineType: element.lineType ?? 'solidLine',
        };
      }
      case 'spline': {
        const point1Id = resolveRef(element.point1, 'point');
        const point4Id = resolveRef(element.point4, 'point');
        const angle1 = normalizeFormula(element.angle1, 'angle1', elementName);
        const angle2 = normalizeFormula(element.angle2, 'angle2', elementName);
        const length1 = normalizeFormula(element.length1, 'length1', elementName);
        const length2 = normalizeFormula(element.length2, 'length2', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'spline',
          name: entry.name,
          point1Id,
          point4Id,
          angle1,
          angle2,
          length1,
          length2,
        };
      }
      case 'arc': {
        const centerId = resolveRef(element.center, 'point');
        const radius = normalizeFormula(element.radius, 'radius', elementName);
        const angle1 = normalizeFormula(element.angle1, 'angle1', elementName);
        const angle2 = normalizeFormula(element.angle2, 'angle2', elementName);
        const entry = registry.registerSymbol(elementName, kind, blockName);
        return {
          id: entry.id,
          kind: 'arc',
          name: entry.name,
          centerId,
          radius,
          angle1,
          angle2,
        };
      }
    }
  }

  private resolveDetailPiece(
    piece: DetailPiece,
    pieceName: string,
    blockName: string,
    registry: IdRegistry,
    modelingOut: ResolvedModelingProxy[],
  ): ResolvedDetailPiece {
    if (piece.contour.length === 0) {
      throw new DomainValidationError(
        'EMPTY_CONTOUR',
        `Detail piece "${pieceName}" in draw block "${blockName}" must contain at least one contour item.`,
        { piece: pieceName, drawBlock: blockName },
      );
    }

    const seamAllowanceCm = assertFiniteNumber(piece.seamAllowanceCm, 'seamAllowanceCm', pieceName);
    if (seamAllowanceCm < 0) {
      throw new DomainValidationError(
        'INVALID_VALUE',
        `Detail piece "${pieceName}" seamAllowanceCm cannot be negative.`,
        { piece: pieceName, seamAllowanceCm },
      );
    }

    const grainlineAngle = assertFiniteNumber(piece.grainlineAngle, 'grainlineAngle', pieceName);
    const grainlineLengthCm = assertFiniteNumber(
      piece.grainlineLengthCm,
      'grainlineLengthCm',
      pieceName,
    );
    if (grainlineLengthCm <= 0) {
      throw new DomainValidationError(
        'INVALID_VALUE',
        `Detail piece "${pieceName}" grainlineLengthCm must be positive.`,
        { piece: pieceName, grainlineLengthCm },
      );
    }

    const proxyIds: { proxyId: number; item: DetailContourItem }[] = [];

    for (const item of piece.contour) {
      const target = registry.resolveSymbol(item.refName, item.kind, pieceName, blockName);
      const proxyId = registry.allocateId();

      if (item.kind === 'point') {
        modelingOut.push({
          id: proxyId,
          idObject: target.id,
          kind: 'point',
          type: 'modeling',
          refName: target.name,
        });
      } else if (item.kind === 'spline') {
        modelingOut.push({
          id: proxyId,
          idObject: target.id,
          kind: 'spline',
          type: 'modelingSpline',
          refName: target.name,
        });
      } else {
        modelingOut.push({
          id: proxyId,
          idObject: target.id,
          kind: 'arc',
          type: 'modelingArc',
          refName: target.name,
        });
      }

      proxyIds.push({ proxyId, item });
    }

    const detailId = registry.allocateId();
    const nodes: ResolvedDetailNode[] = [];

    for (const { proxyId, item } of proxyIds) {
      const nodeId = registry.allocateId();
      const node: ResolvedDetailNode = {
        id: nodeId,
        idObject: proxyId,
        type: getDetailNodeType(item.kind),
        refName: item.refName.trim(),
      };
      if (item.reverse !== undefined) {
        node.reverse = item.reverse;
      }
      if (item.passmark !== undefined) {
        node.passmark = item.passmark;
      }
      nodes.push(node);
    }

    return {
      id: detailId,
      name: pieceName,
      seamAllowanceCm,
      grainlineAngle,
      grainlineLengthCm,
      nodes,
    };
  }
}
