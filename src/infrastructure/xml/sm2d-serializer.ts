import type {
  ResolvedCalculationElement,
  ResolvedDetailNode,
  ResolvedDetailPiece,
  ResolvedModelingProxy,
  ResolvedPatternAst,
} from '../../domain/index.js';
import { escapeXmlText, formatAttrs } from './xml-escape.js';

const DEFAULT_MX = '0.132292';
const DEFAULT_MY = '0.264583';

function serializeCalculationElement(el: ResolvedCalculationElement): string {
  if (el.kind === 'line') {
    const attrs = formatAttrs([
      ['firstPoint', el.firstPointId],
      ['id', el.id],
      ['lineColor', 'black'],
      ['secondPoint', el.secondPointId],
      ['typeLine', el.lineType],
    ]);
    return `            <line ${attrs}/>`;
  }

  if (el.kind === 'spline') {
    const attrs = formatAttrs([
      ['angle1', el.angle1],
      ['angle2', el.angle2],
      ['color', 'black'],
      ['id', el.id],
      ['length1', el.length1],
      ['length2', el.length2],
      ['name', el.name],
      ['point1', el.point1Id],
      ['point4', el.point4Id],
      ['type', 'simpleInteractive'],
    ]);
    return `            <spline ${attrs}/>`;
  }

  if (el.kind === 'arc') {
    const attrs = formatAttrs([
      ['angle1', el.angle1],
      ['angle2', el.angle2],
      ['center', el.centerId],
      ['color', 'black'],
      ['id', el.id],
      ['name', el.name],
      ['radius', el.radius],
      ['type', 'simple'],
    ]);
    return `            <arc ${attrs}/>`;
  }

  switch (el.type) {
    case 'single': {
      const attrs = formatAttrs([
        ['id', el.id],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['type', 'single'],
        ['x', el.x],
        ['y', el.y],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'endLine': {
      const attrs = formatAttrs([
        ['angle', el.angle],
        ['basePoint', el.basePointId],
        ['id', el.id],
        ['length', el.length],
        ['lineColor', 'black'],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['type', 'endLine'],
        ['typeLine', 'hair'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'alongLine': {
      const attrs = formatAttrs([
        ['firstPoint', el.firstPointId],
        ['id', el.id],
        ['length', el.length],
        ['lineColor', 'black'],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['secondPoint', el.secondPointId],
        ['type', 'alongLine'],
        ['typeLine', 'none'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'normal': {
      const attrs = formatAttrs([
        ['angle', el.angle],
        ['firstPoint', el.firstPointId],
        ['id', el.id],
        ['length', el.length],
        ['lineColor', 'black'],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['secondPoint', el.secondPointId],
        ['type', 'normal'],
        ['typeLine', 'hair'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'bisector': {
      const attrs = formatAttrs([
        ['firstPoint', el.firstPointId],
        ['id', el.id],
        ['length', el.length],
        ['lineColor', 'black'],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['secondPoint', el.secondPointId],
        ['thirdPoint', el.thirdPointId],
        ['type', 'bisector'],
        ['typeLine', 'hair'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'pointOfIntersection': {
      const attrs = formatAttrs([
        ['firstPoint', el.firstPointId],
        ['id', el.id],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['secondPoint', el.secondPointId],
        ['type', 'pointOfIntersection'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'lineIntersect': {
      const attrs = formatAttrs([
        ['id', el.id],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['p1Line1', el.p1Line1Id],
        ['p1Line2', el.p1Line2Id],
        ['p2Line1', el.p2Line1Id],
        ['p2Line2', el.p2Line2Id],
        ['type', 'lineIntersect'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'lineIntersectAxis': {
      const attrs = formatAttrs([
        ['angle', el.angle],
        ['basePoint', el.basePointId],
        ['id', el.id],
        ['lineColor', 'black'],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['p1Line', el.p1LineId],
        ['p2Line', el.p2LineId],
        ['type', 'lineIntersectAxis'],
        ['typeLine', 'hair'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'cutArc': {
      const attrs = formatAttrs([
        ['arc', el.arcId],
        ['id', el.id],
        ['length', el.length],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['type', 'cutArc'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'cutSpline': {
      const attrs = formatAttrs([
        ['id', el.id],
        ['length', el.length],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['spline', el.splineId],
        ['type', 'cutSpline'],
      ]);
      return `            <point ${attrs}/>`;
    }
    case 'shoulder': {
      const attrs = formatAttrs([
        ['id', el.id],
        ['length', el.length],
        ['lineColor', 'black'],
        ['mx', DEFAULT_MX],
        ['my', DEFAULT_MY],
        ['name', el.name],
        ['p1Line', el.p1LineId],
        ['p2Line', el.p2LineId],
        ['pShoulder', el.pShoulderId],
        ['type', 'shoulder'],
        ['typeLine', 'hair'],
      ]);
      return `            <point ${attrs}/>`;
    }
  }
}

function serializeModelingProxy(proxy: ResolvedModelingProxy): string {
  if (proxy.kind === 'point') {
    const attrs = formatAttrs([
      ['id', proxy.id],
      ['idObject', proxy.idObject],
      ['inUse', 'true'],
      ['mx', DEFAULT_MX],
      ['my', DEFAULT_MY],
      ['type', 'modeling'],
    ]);
    return `            <point ${attrs}/>`;
  }
  if (proxy.kind === 'spline') {
    const attrs = formatAttrs([
      ['id', proxy.id],
      ['idObject', proxy.idObject],
      ['inUse', 'true'],
      ['type', 'modelingSpline'],
    ]);
    return `            <spline ${attrs}/>`;
  }
  const attrs = formatAttrs([
    ['id', proxy.id],
    ['idObject', proxy.idObject],
    ['inUse', 'true'],
    ['type', 'modelingArc'],
  ]);
  return `            <arc ${attrs}/>`;
}

function serializeDetailNode(node: ResolvedDetailNode): string {
  const attrs: Array<readonly [string, string | number]> = [
    ['id', node.id],
    ['idObject', node.idObject],
  ];

  if (node.type === 'NodePoint' && node.passmark === true) {
    attrs.push(['passmark', 'true']);
    attrs.push(['passmarkAngle', 'straightforward']);
    attrs.push(['passmarkLine', 'one']);
  }

  if (node.type === 'NodeSpline' || node.type === 'NodeArc') {
    attrs.push(['reverse', node.reverse === true ? '1' : '0']);
  }

  attrs.push(['type', node.type]);
  return `                    <node ${formatAttrs(attrs)}/>`;
}

function serializeDetailPiece(piece: ResolvedDetailPiece): string[] {
  const hasSeamAllowance = piece.seamAllowanceCm > 0;
  const detailAttrs = formatAttrs([
    ['forbidFlipping', 'false'],
    ['forceFlipping', 'false'],
    ['hideMainPath', 'false'],
    ['id', piece.id],
    ['inLayout', 'true'],
    ['mx', 0],
    ['my', 0],
    ['name', piece.name],
    ['seamAllowance', hasSeamAllowance ? 'true' : 'false'],
    ['united', 'false'],
    ['version', 2],
    ['width', piece.seamAllowanceCm],
  ]);

  const dataAttrs = formatAttrs([
    ['annotation', ''],
    ['foldPosition', ''],
    ['fontSize', 0],
    ['height', 1],
    ['letter', ''],
    ['mx', 0],
    ['my', 0],
    ['onFold', 'false'],
    ['orientation', ''],
    ['quantity', 1],
    ['rotation', 0],
    ['rotationWay', ''],
    ['tilt', ''],
    ['visible', 'false'],
    ['width', 1],
  ]);

  const patternInfoAttrs = formatAttrs([
    ['fontSize', 0],
    ['height', 1],
    ['mx', 0],
    ['my', 0],
    ['rotation', 0],
    ['visible', 'false'],
    ['width', 1],
  ]);

  const grainlineAttrs = formatAttrs([
    ['arrows', 0],
    ['length', piece.grainlineLengthCm],
    ['mx', 0],
    ['my', 0],
    ['rotation', piece.grainlineAngle],
    ['visible', 'true'],
  ]);

  const lines: string[] = [
    `            <detail ${detailAttrs}>`,
    `                <data ${dataAttrs}/>`,
    `                <patternInfo ${patternInfoAttrs}/>`,
    `                <grainline ${grainlineAttrs}/>`,
    '                <nodes>',
    ...piece.nodes.map(serializeDetailNode),
    '                </nodes>',
    '            </detail>',
  ];

  return lines;
}

export function serializeSm2d(ast: ResolvedPatternAst): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<pattern>',
    `    <version>${escapeXmlText(ast.version)}</version>`,
    `    <unit>${escapeXmlText(ast.unit)}</unit>`,
    ast.description.length > 0
      ? `    <description>${escapeXmlText(ast.description)}</description>`
      : '    <description/>',
    ast.notes.length > 0 ? `    <notes>${escapeXmlText(ast.notes)}</notes>` : '    <notes/>',
    `    <measurements>${escapeXmlText(ast.measurementsFile)}</measurements>`,
  ];

  if (ast.increments.length === 0) {
    lines.push('    <increments/>');
  } else {
    lines.push('    <increments>');
    for (const inc of ast.increments) {
      const attrs = formatAttrs([
        ['description', inc.description],
        ['formula', inc.formula],
        ['name', inc.name],
      ]);
      lines.push(`        <increment ${attrs}/>`);
    }
    lines.push('    </increments>');
  }

  for (const block of ast.drawBlocks) {
    lines.push(`    <draw ${formatAttrs([['name', block.name]])}>`);

    if (block.calculation.length === 0) {
      lines.push('        <calculation/>');
    } else {
      lines.push('        <calculation>');
      for (const el of block.calculation) {
        lines.push(serializeCalculationElement(el));
      }
      lines.push('        </calculation>');
    }

    if (block.modeling.length === 0) {
      lines.push('        <modeling/>');
    } else {
      lines.push('        <modeling>');
      for (const proxy of block.modeling) {
        lines.push(serializeModelingProxy(proxy));
      }
      lines.push('        </modeling>');
    }

    if (block.details.length === 0) {
      lines.push('        <details/>');
    } else {
      lines.push('        <details>');
      for (const piece of block.details) {
        lines.push(...serializeDetailPiece(piece));
      }
      lines.push('        </details>');
    }

    lines.push('    </draw>');
  }

  lines.push('</pattern>');
  return `${lines.join('\n')}\n`;
}
