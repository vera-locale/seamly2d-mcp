import type { BuildParametricPatternInput } from '../../src/application/index.js';

export const STANDARD_SIZE_38_MEASUREMENTS: Record<string, number> = {
  bust_circ: 92,
  waist_circ: 74,
  neck_circ: 36,
  back_waist_length: 41,
  shoulder_length: 12.5,
};

export const BODICE_BACK_FIXTURE: BuildParametricPatternInput = {
  filename: 'bodice_back_base',
  measurementsFile: 'standard_size_38.smme',
  unit: 'cm',
  increments: [
    { name: '#ease_bust', formula: '2', description: 'Quarter bust ease in cm' },
    { name: '#ease_waist', formula: '1.5', description: 'Quarter waist ease in cm' },
  ],
  drawBlocks: [
    {
      name: 'Bodice_Back',
      elements: [
        { type: 'single', name: 'A', x: 1, y: 1 },
        { type: 'endLine', name: 'A1', basePoint: 'A', length: 'back_waist_length', angle: 270 },
        {
          type: 'endLine',
          name: 'A2',
          basePoint: 'A',
          length: 'bust_circ / 4 + #ease_bust',
          angle: 0,
        },
        { type: 'pointOfIntersection', name: 'A3', firstPoint: 'A2', secondPoint: 'A1' },
        { type: 'endLine', name: 'A4', basePoint: 'A', length: 'neck_circ / 6 + 0.5', angle: 0 },
        { type: 'endLine', name: 'A5', basePoint: 'A', length: '2', angle: 270 },
        {
          type: 'spline',
          name: 'back_neckline',
          point1: 'A5',
          point4: 'A4',
          angle1: 0,
          angle2: 270,
          length1: 'Line_A_A4 * 0.55',
          length2: '1.1',
        },
        {
          type: 'endLine',
          name: 'A6',
          basePoint: 'A2',
          length: 'back_waist_length / 2 + 2',
          angle: 270,
        },
        { type: 'endLine', name: 'A7', basePoint: 'A4', length: 'shoulder_length', angle: 342 },
        {
          type: 'spline',
          name: 'back_armhole',
          point1: 'A7',
          point4: 'A6',
          angle1: 252,
          angle2: 180,
          length1: '6.5',
          length2: '5.5',
        },
        {
          type: 'endLine',
          name: 'A8',
          basePoint: 'A1',
          length: 'waist_circ / 4 + #ease_waist',
          angle: 0,
        },
      ],
      pieces: [
        {
          name: 'Back_Bodice_Cut1_OnFold',
          seamAllowanceCm: 1.0,
          grainlineAngle: 90,
          grainlineLengthCm: 20,
          contour: [
            { refName: 'A5', kind: 'point' },
            { refName: 'back_neckline', kind: 'spline', reverse: false },
            { refName: 'A4', kind: 'point' },
            { refName: 'A7', kind: 'point' },
            { refName: 'back_armhole', kind: 'spline', reverse: false },
            { refName: 'A6', kind: 'point' },
            { refName: 'A8', kind: 'point' },
            { refName: 'A1', kind: 'point' },
          ],
        },
      ],
    },
  ],
};
