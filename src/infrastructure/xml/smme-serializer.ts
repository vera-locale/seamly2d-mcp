import type { MeasurementsDocument } from '../../domain/index.js';
import { escapeXmlText, formatAttrs } from './xml-escape.js';

export function serializeSmme(doc: MeasurementsDocument): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<smis>',
    `    <version>${escapeXmlText(doc.version)}</version>`,
    `    <read-only>${doc.readOnly ? 'true' : 'false'}</read-only>`,
    doc.notes.length > 0 ? `    <notes>${escapeXmlText(doc.notes)}</notes>` : '    <notes/>',
    `    <unit>${escapeXmlText(doc.unit)}</unit>`,
    `    <pm_system>${escapeXmlText(doc.pmSystem)}</pm_system>`,
    '    <personal>',
    '        <family-name/>',
    '        <given-name/>',
    '        <birth-date>1800-01-01</birth-date>',
    '        <gender>unknown</gender>',
    '        <email/>',
    '    </personal>',
  ];

  if (doc.measurements.length === 0) {
    lines.push('    <body-measurements/>');
  } else {
    lines.push('    <body-measurements>');
    for (const entry of doc.measurements) {
      const attrs = formatAttrs([
        ['name', entry.name],
        ['value', entry.value],
      ]);
      lines.push(`        <m ${attrs}/>`);
    }
    lines.push('    </body-measurements>');
  }

  lines.push('</smis>');
  return `${lines.join('\n')}\n`;
}
