import { describe, expect, it } from 'vitest';
import { PatternAstBuilder } from '../../src/domain/index.js';
import {
  inspectXmlContent,
  serializeSm2d,
  serializeSmme,
  XmlInspectionError,
} from '../../src/infrastructure/index.js';
import { BODICE_BACK_FIXTURE } from '../fixtures/bodice-back.js';

describe('Pattern Inspector (round-trip XML parsing)', () => {
  it('round-trips a serialized .smme document', () => {
    const xml = serializeSmme({
      version: '0.5.0',
      readOnly: false,
      notes: 'EU Size 38',
      unit: 'cm',
      pmSystem: '998',
      measurements: [
        { name: 'bust_circ', value: 92 },
        { name: 'waist_circ', value: 74 },
      ],
    });

    const inspected = inspectXmlContent(xml);
    expect(inspected.documentType).toBe('smme');
    if (inspected.documentType === 'smme') {
      expect(inspected.version).toBe('0.5.0');
      expect(inspected.unit).toBe('cm');
      expect(inspected.notes).toBe('EU Size 38');
      expect(inspected.measurements).toEqual([
        { name: 'bust_circ', value: 92 },
        { name: 'waist_circ', value: 74 },
      ]);
    }
  });

  it('round-trips a serialized Bodice Back Block .sm2d document with resolved symbolic names', () => {
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
    const inspected = inspectXmlContent(xml);
    expect(inspected.documentType).toBe('sm2d');

    if (inspected.documentType === 'sm2d') {
      expect(inspected.version).toBe('0.7.0');
      expect(inspected.measurementsFile).toBe('standard_size_38.smme');
      expect(inspected.increments).toHaveLength(2);
      expect(inspected.drawBlocks).toHaveLength(1);

      const block = inspected.drawBlocks[0];
      expect(block?.name).toBe('Bodice_Back');
      expect(block?.calculation).toHaveLength(11);

      const backNeckline = block?.calculation.find((n) => n.name === 'back_neckline');
      expect(backNeckline?.tag).toBe('spline');
      expect(backNeckline?.references).toEqual({ point1: 'A5', point4: 'A4' });
      expect(backNeckline?.formulas.length1).toBe('Line_A_A4 * 0.55');

      const piece = block?.pieces[0];
      expect(piece?.name).toBe('Back_Bodice_Cut1_OnFold');
      expect(piece?.seamAllowanceCm).toBe(1);
      expect(piece?.grainlineAngle).toBe(90);
      expect(piece?.grainlineLengthCm).toBe(20);
      expect(piece?.nodes.map((n) => n.targetName)).toEqual([
        'A5',
        'back_neckline',
        'A4',
        'A7',
        'back_armhole',
        'A6',
        'A8',
        'A1',
      ]);
    }
  });

  it('rejects empty XML and unsupported root documents', () => {
    expect(() => inspectXmlContent('   ')).toThrow(XmlInspectionError);
    expect(() => inspectXmlContent('<?xml version="1.0"?><unknown/>')).toThrow(XmlInspectionError);
  });
});
