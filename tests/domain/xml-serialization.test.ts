import { describe, expect, it } from 'vitest';
import { PatternAstBuilder } from '../../src/domain/index.js';
import { serializeSm2d, serializeSmme } from '../../src/infrastructure/index.js';
import { BODICE_BACK_FIXTURE } from '../fixtures/bodice-back.js';

describe('XML Serializers (.smme and .sm2d)', () => {
  it('serializes .smme v0.5.0 deterministically', () => {
    const xml = serializeSmme({
      version: '0.5.0',
      readOnly: false,
      notes: '',
      unit: 'cm',
      pmSystem: '998',
      measurements: [
        { name: 'bust_circ', value: 92 },
        { name: 'waist_circ', value: 74 },
      ],
    });

    expect(xml).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<vit>',
        '    <version>0.5.0</version>',
        '    <read-only>false</read-only>',
        '    <notes/>',
        '    <unit>cm</unit>',
        '    <pm_system>998</pm_system>',
        '    <body-measurements>',
        '        <m name="bust_circ" value="92"/>',
        '        <m name="waist_circ" value="74"/>',
        '    </body-measurements>',
        '</vit>',
        '',
      ].join('\n'),
    );
  });

  it('serializes Bodice Back Block .sm2d v0.7.0 deterministically', () => {
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

    const xml = serializeSm2d(ast);

    expect(xml).toContain('<version>0.7.0</version>');
    expect(xml).toContain('<unit>cm</unit>');
    expect(xml).toContain('<measurements>standard_size_38.smme</measurements>');
    expect(xml).toContain(
      '<increment description="Quarter bust ease in cm" formula="2" name="#ease_bust"/>',
    );
    expect(xml).toContain('<draw name="Bodice_Back">');
    expect(xml).toContain(
      '<point id="1" mx="0.132292" my="0.264583" name="A" type="single" x="1" y="1"/>',
    );
    expect(xml).toContain(
      '<spline angle1="0" angle2="270" color="black" id="7" length1="Line_A_A4 * 0.55" length2="1.1" name="back_neckline" point1="6" point4="5" type="simpleInteractive"/>',
    );
    expect(xml).toContain(
      '<point id="12" idObject="6" inUse="true" mx="0.132292" my="0.264583" type="modeling"/>',
    );
    expect(xml).toContain('<spline id="13" idObject="7" inUse="true" type="modelingSpline"/>');
    expect(xml).toContain('name="Back_Bodice_Cut1_OnFold"');
    expect(xml).toContain(
      '<grainline arrows="0" length="20" mx="0" my="0" rotation="90" visible="true"/>',
    );
    expect(xml).toContain('<node id="21" idObject="12" type="NodePoint"/>');
    expect(xml).toContain('<node id="22" idObject="13" reverse="0" type="NodeSpline"/>');
  });

  it('serializes reverse="1" on NodeSpline/NodeArc and passmark attributes on NodePoint', () => {
    const builder = new PatternAstBuilder();
    const ast = builder.build({
      measurementsFile: 'm.smme',
      description: 'Test & <Escape>',
      notes: 'Draft notes',
      drawBlocks: [
        {
          name: 'Curve_Block',
          elements: [
            { type: 'single', name: 'A', x: 0, y: 0 },
            { type: 'endLine', name: 'B', basePoint: 'A', length: 10, angle: 0 },
            {
              type: 'spline',
              name: 'S1',
              point1: 'A',
              point4: 'B',
              angle1: 45,
              angle2: 135,
              length1: 3,
              length2: 3,
            },
            { type: 'arc', name: 'Arc1', center: 'A', radius: 5, angle1: 0, angle2: 90 },
          ],
          pieces: [
            {
              name: 'Reversed_Piece',
              seamAllowanceCm: 0,
              grainlineAngle: 0,
              grainlineLengthCm: 12,
              contour: [
                { refName: 'A', kind: 'point', passmark: true },
                { refName: 'S1', kind: 'spline', reverse: true },
                { refName: 'B', kind: 'point' },
                { refName: 'Arc1', kind: 'arc', reverse: true },
              ],
            },
          ],
        },
      ],
    });

    const xml = serializeSm2d(ast);
    expect(xml).toContain('<description>Test &amp; &lt;Escape&gt;</description>');
    expect(xml).toContain('<notes>Draft notes</notes>');
    expect(xml).toContain('seamAllowance="false"');
    expect(xml).toContain(
      'passmark="true" passmarkAngle="straightforward" passmarkLine="one" type="NodePoint"/>',
    );
    expect(xml).toContain('reverse="1" type="NodeSpline"/>');
    expect(xml).toContain('reverse="1" type="NodeArc"/>');
    expect(xml).toContain('type="modelingArc"/>');
  });

  it('serializes empty .smme measurements and all 11 point types + lines in .sm2d', () => {
    const emptySmme = serializeSmme({
      version: '0.5.0',
      readOnly: true,
      notes: 'Empty table',
      unit: 'mm',
      pmSystem: '998',
      measurements: [],
    });
    expect(emptySmme).toContain('<read-only>true</read-only>');
    expect(emptySmme).toContain('<notes>Empty table</notes>');
    expect(emptySmme).toContain('<body-measurements/>');

    const builder = new PatternAstBuilder();
    const ast = builder.build({
      measurementsFile: 'test.smme',
      drawBlocks: [
        {
          name: 'All_Types',
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
            { type: 'line', name: 'L1', firstPoint: 'P0', secondPoint: 'P5', lineType: 'dotLine' },
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
        },
      ],
    });

    const xml = serializeSm2d(ast);
    expect(xml).toContain('type="alongLine"');
    expect(xml).toContain('type="normal"');
    expect(xml).toContain('type="bisector"');
    expect(xml).toContain('type="lineIntersect"');
    expect(xml).toContain('type="lineIntersectAxis"');
    expect(xml).toContain('type="shoulder"');
    expect(xml).toContain('typeLine="dotLine"');
    expect(xml).toContain('type="cutSpline"');
    expect(xml).toContain('type="cutArc"');
    expect(xml).toContain('<modeling/>');
    expect(xml).toContain('<details/>');
  });
});
