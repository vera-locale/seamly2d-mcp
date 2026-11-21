import { describe, expect, it } from 'vitest';
import {
  DomainValidationError,
  PatternAstBuilder,
  type PatternInput,
} from '../../src/domain/index.js';
import { BODICE_BACK_FIXTURE } from '../fixtures/bodice-back.js';

function expectDomainError(fn: () => unknown, expectedCode: string): void {
  try {
    fn();
    expect.unreachable(`Expected DomainValidationError with code ${expectedCode}`);
  } catch (err: unknown) {
    expect(err).toBeInstanceOf(DomainValidationError);
    if (err instanceof DomainValidationError) {
      expect(err.code).toBe(expectedCode);
    }
  }
}

describe('PatternAstBuilder', () => {
  it('assigns strictly sequential globally unique IDs across calculation, modeling, details, and nodes', () => {
    const builder = new PatternAstBuilder();
    const ast = builder.build({
      measurementsFile: BODICE_BACK_FIXTURE.measurementsFile,
      increments: BODICE_BACK_FIXTURE.increments ?? [],
      drawBlocks: BODICE_BACK_FIXTURE.drawBlocks.map((b) => ({
        name: b.name,
        elements: b.elements.map((e) => e),
        ...(b.pieces !== undefined ? { pieces: b.pieces } : {}),
      })),
    });

    const allIds: number[] = [];
    for (const block of ast.drawBlocks) {
      for (const el of block.calculation) {
        allIds.push(el.id);
      }
      for (const proxy of block.modeling) {
        allIds.push(proxy.id);
      }
      for (const detail of block.details) {
        allIds.push(detail.id);
        for (const node of detail.nodes) {
          allIds.push(node.id);
        }
      }
    }

    // 11 calculation elements + 8 modeling proxies + 1 detail + 8 detail nodes = 28 sequential IDs
    expect(allIds).toHaveLength(28);
    expect(ast.totalAllocatedIds).toBe(28);
    expect(allIds).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));

    const block = ast.drawBlocks[0];
    expect(block).toBeDefined();
    expect(block?.modeling).toHaveLength(8);
    expect(block?.details[0]?.nodes).toHaveLength(8);

    // Verify modeling proxy links to calculation ID and detail node links to modeling proxy ID
    const firstProxy = block?.modeling[0];
    const firstNode = block?.details[0]?.nodes[0];
    expect(firstProxy?.refName).toBe('A5');
    expect(firstProxy?.idObject).toBe(6); // A=1, A1=2, A2=3, A3=4, A4=5, A5=6
    expect(firstNode?.idObject).toBe(firstProxy?.id);
    expect(firstNode?.type).toBe('NodePoint');
  });

  it('supports all 11 PointNode types, LineNode, SplineNode, and ArcNode', () => {
    const builder = new PatternAstBuilder();
    const input: PatternInput = {
      measurementsFile: 'test.smme',
      drawBlocks: [
        {
          name: 'All_Geometry',
          elements: [
            { type: 'single', name: 'P0', x: 0, y: 0 },
            { type: 'endLine', name: 'P1', basePoint: 'P0', length: 10, angle: 0 },
            { type: 'alongLine', name: 'P2', firstPoint: 'P0', secondPoint: 'P1', length: 5 },
            {
              type: 'normal',
              name: 'P3',
              firstPoint: 'P0',
              secondPoint: 'P1',
              length: 8,
              angle: 0,
            },
            {
              type: 'bisector',
              name: 'P4',
              firstPoint: 'P1',
              secondPoint: 'P0',
              thirdPoint: 'P3',
              length: 4,
            },
            { type: 'pointOfIntersection', name: 'P5', firstPoint: 'P1', secondPoint: 'P3' },
            {
              type: 'lineIntersect',
              name: 'P6',
              p1Line1: 'P0',
              p2Line1: 'P5',
              p1Line2: 'P1',
              p2Line2: 'P3',
            },
            {
              type: 'lineIntersectAxis',
              name: 'P7',
              basePoint: 'P2',
              p1Line: 'P3',
              p2Line: 'P5',
              angle: 90,
            },
            {
              type: 'shoulder',
              name: 'P8',
              p1Line: 'P3',
              p2Line: 'P5',
              pShoulder: 'P0',
              length: 9,
            },
            { type: 'line', name: 'L1', firstPoint: 'P0', secondPoint: 'P5', lineType: 'dashLine' },
            {
              type: 'spline',
              name: 'S1',
              point1: 'P0',
              point4: 'P5',
              angle1: 30,
              angle2: 210,
              length1: 3,
              length2: 3,
            },
            { type: 'arc', name: 'Arc1', center: 'P0', radius: 6, angle1: 0, angle2: 90 },
            { type: 'cutSpline', name: 'P9', spline: 'S1', length: 2.5 },
            { type: 'cutArc', name: 'P10', arc: 'Arc1', length: 3 },
          ],
          pieces: [
            {
              name: 'Test_Piece',
              seamAllowanceCm: 1.5,
              grainlineAngle: 90,
              grainlineLengthCm: 10,
              contour: [
                { refName: 'P0', kind: 'point', passmark: true },
                { refName: 'S1', kind: 'spline', reverse: true },
                { refName: 'P5', kind: 'point' },
                { refName: 'Arc1', kind: 'arc', reverse: true },
              ],
            },
          ],
        },
      ],
    };

    const ast = builder.build(input);
    const block = ast.drawBlocks[0];
    expect(block?.calculation).toHaveLength(14);
    expect(block?.modeling).toHaveLength(4);
    expect(block?.details[0]?.nodes[0]?.passmark).toBe(true);
    expect(block?.details[0]?.nodes[1]?.reverse).toBe(true);
    expect(block?.details[0]?.nodes[3]?.type).toBe('NodeArc');
    expect(block?.details[0]?.nodes[3]?.reverse).toBe(true);
  });

  it('rejects forward references with FORWARD_REFERENCE', () => {
    const builder = new PatternAstBuilder();
    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'Bad_Order',
              elements: [
                { type: 'endLine', name: 'A1', basePoint: 'A', length: 10, angle: 0 },
                { type: 'single', name: 'A', x: 0, y: 0 },
              ],
            },
          ],
        }),
      'FORWARD_REFERENCE',
    );
  });

  it('rejects undeclared symbols with UNDECLARED_SYMBOL', () => {
    const builder = new PatternAstBuilder();
    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'Missing_Ref',
              elements: [
                { type: 'single', name: 'A', x: 0, y: 0 },
                { type: 'endLine', name: 'A1', basePoint: 'NO_SUCH_POINT', length: 10, angle: 0 },
              ],
            },
          ],
        }),
      'UNDECLARED_SYMBOL',
    );
  });

  it('rejects self-references with SELF_REFERENCE', () => {
    const builder = new PatternAstBuilder();
    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'Self_Ref',
              elements: [{ type: 'endLine', name: 'A', basePoint: 'A', length: 10, angle: 0 }],
            },
          ],
        }),
      'SELF_REFERENCE',
    );
  });

  it('rejects duplicate symbol names with DUPLICATE_SYMBOL', () => {
    const builder = new PatternAstBuilder();
    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'Dup_Sym',
              elements: [
                { type: 'single', name: 'A', x: 0, y: 0 },
                { type: 'single', name: 'A', x: 1, y: 1 },
              ],
            },
          ],
        }),
      'DUPLICATE_SYMBOL',
    );
  });

  it('rejects invalid symbol kind references in calculation and detail contours', () => {
    const builder = new PatternAstBuilder();
    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'Wrong_Kind_Calc',
              elements: [
                { type: 'single', name: 'A', x: 0, y: 0 },
                { type: 'endLine', name: 'B', basePoint: 'A', length: 10, angle: 0 },
                {
                  type: 'spline',
                  name: 'S1',
                  point1: 'A',
                  point4: 'B',
                  angle1: 0,
                  angle2: 180,
                  length1: 2,
                  length2: 2,
                },
                { type: 'endLine', name: 'C', basePoint: 'S1', length: 5, angle: 90 },
              ],
            },
          ],
        }),
      'INVALID_SYMBOL_KIND',
    );

    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'Wrong_Kind_Contour',
              elements: [{ type: 'single', name: 'A', x: 0, y: 0 }],
              pieces: [
                {
                  name: 'P',
                  seamAllowanceCm: 1,
                  grainlineAngle: 90,
                  grainlineLengthCm: 10,
                  contour: [{ refName: 'A', kind: 'spline' }],
                },
              ],
            },
          ],
        }),
      'INVALID_SYMBOL_KIND',
    );
  });

  it('validates increments, draw blocks, contours, and formulas', () => {
    const builder = new PatternAstBuilder();

    expectDomainError(
      () => builder.build({ measurementsFile: 'm.smme', drawBlocks: [] }),
      'EMPTY_DRAW_BLOCKS',
    );

    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          increments: [{ name: 'ease_without_hash', formula: '2' }],
          drawBlocks: [{ name: 'B1', elements: [{ type: 'single', name: 'A', x: 0, y: 0 }] }],
        }),
      'INVALID_INCREMENT_NAME',
    );

    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          increments: [
            { name: '#ease', formula: '2' },
            { name: '#ease', formula: '3' },
          ],
          drawBlocks: [{ name: 'B1', elements: [{ type: 'single', name: 'A', x: 0, y: 0 }] }],
        }),
      'DUPLICATE_INCREMENT_NAME',
    );

    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            { name: 'B1', elements: [{ type: 'single', name: 'A', x: 0, y: 0 }] },
            { name: 'B1', elements: [{ type: 'single', name: 'B', x: 0, y: 0 }] },
          ],
        }),
      'DUPLICATE_DRAW_BLOCK',
    );

    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'B1',
              elements: [{ type: 'single', name: 'A', x: 0, y: 0 }],
              pieces: [
                {
                  name: 'Empty',
                  seamAllowanceCm: 1,
                  grainlineAngle: 90,
                  grainlineLengthCm: 10,
                  contour: [],
                },
              ],
            },
          ],
        }),
      'EMPTY_CONTOUR',
    );

    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'B1',
              elements: [
                { type: 'single', name: 'A', x: 0, y: 0 },
                { type: 'endLine', name: 'B', basePoint: 'A', length: '   ', angle: 0 },
              ],
            },
          ],
        }),
      'INVALID_FORMULA',
    );

    expectDomainError(
      () =>
        builder.build({
          measurementsFile: 'm.smme',
          drawBlocks: [
            {
              name: 'B1',
              elements: [{ type: 'single', name: 'A', x: Number.NaN, y: 0 }],
            },
          ],
        }),
      'INVALID_VALUE',
    );
  });
});
