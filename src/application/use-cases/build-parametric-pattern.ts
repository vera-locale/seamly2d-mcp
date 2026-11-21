import {
  type CalculationElement,
  type DetailContourItem,
  type DetailPiece,
  type DrawBlockInput,
  type IncrementDefinition,
  PatternAstBuilder,
  type PatternInput,
  type SymbolMappingEntry,
} from '../../domain/index.js';
import { serializeSm2d, type WorkspaceRepository } from '../../infrastructure/index.js';
import type { BuildParametricPatternInput } from '../schemas.js';

export interface BuildParametricPatternResult {
  filePath: string;
  relativePath: string;
  version: '0.7.0';
  unit: 'cm' | 'mm';
  measurementsFile: string;
  drawBlockCount: number;
  totalAllocatedIds: number;
  symbolTable: SymbolMappingEntry[];
}

function ensureSm2dExtension(filename: string): string {
  const trimmed = filename.trim();
  return trimmed.endsWith('.sm2d') ? trimmed : `${trimmed}.sm2d`;
}

function toDomainElement(
  el: BuildParametricPatternInput['drawBlocks'][number]['elements'][number],
): CalculationElement {
  if (el.type === 'line') {
    const line: CalculationElement = {
      type: 'line',
      name: el.name,
      firstPoint: el.firstPoint,
      secondPoint: el.secondPoint,
    };
    if (el.lineType !== undefined) {
      line.lineType = el.lineType;
    }
    return line;
  }
  return el;
}

function toDomainContourItem(
  item: NonNullable<
    BuildParametricPatternInput['drawBlocks'][number]['pieces']
  >[number]['contour'][number],
): DetailContourItem {
  const result: DetailContourItem = {
    refName: item.refName,
    kind: item.kind,
  };
  if (item.reverse !== undefined) {
    result.reverse = item.reverse;
  }
  if (item.passmark !== undefined) {
    result.passmark = item.passmark;
  }
  return result;
}

function toDomainPiece(
  piece: NonNullable<BuildParametricPatternInput['drawBlocks'][number]['pieces']>[number],
): DetailPiece {
  return {
    name: piece.name,
    seamAllowanceCm: piece.seamAllowanceCm,
    grainlineAngle: piece.grainlineAngle,
    grainlineLengthCm: piece.grainlineLengthCm,
    contour: piece.contour.map(toDomainContourItem),
  };
}

function toDomainPatternInput(input: BuildParametricPatternInput): PatternInput {
  const increments: IncrementDefinition[] = (input.increments ?? []).map((inc) => {
    const def: IncrementDefinition = {
      name: inc.name,
      formula: inc.formula,
    };
    if (inc.description !== undefined) {
      def.description = inc.description;
    }
    return def;
  });

  const drawBlocks: DrawBlockInput[] = input.drawBlocks.map((block) => {
    const drawBlock: DrawBlockInput = {
      name: block.name,
      elements: block.elements.map(toDomainElement),
    };
    if (block.pieces !== undefined) {
      drawBlock.pieces = block.pieces.map(toDomainPiece);
    }
    return drawBlock;
  });

  const patternInput: PatternInput = {
    unit: input.unit,
    measurementsFile: input.measurementsFile,
    increments,
    drawBlocks,
  };
  if (input.description !== undefined) {
    patternInput.description = input.description;
  }
  if (input.notes !== undefined) {
    patternInput.notes = input.notes;
  }
  return patternInput;
}

export async function executeBuildParametricPattern(
  input: BuildParametricPatternInput,
  workspace: WorkspaceRepository,
  builder: PatternAstBuilder = new PatternAstBuilder(),
): Promise<BuildParametricPatternResult> {
  const domainInput = toDomainPatternInput(input);
  const ast = builder.build(domainInput);
  const xml = serializeSm2d(ast);

  const relativePath = ensureSm2dExtension(input.filename);
  const filePath = await workspace.writeText(relativePath, xml);

  return {
    filePath,
    relativePath,
    version: ast.version,
    unit: ast.unit,
    measurementsFile: ast.measurementsFile,
    drawBlockCount: ast.drawBlocks.length,
    totalAllocatedIds: ast.totalAllocatedIds,
    symbolTable: ast.symbolTable,
  };
}
