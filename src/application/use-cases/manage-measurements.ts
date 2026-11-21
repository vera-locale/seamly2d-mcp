import type { MeasurementEntry, MeasurementsDocument } from '../../domain/index.js';
import {
  inspectXmlContent,
  serializeSmme,
  type WorkspaceRepository,
} from '../../infrastructure/index.js';
import type { ManageMeasurementsInput } from '../schemas.js';

export interface ManageMeasurementsResult {
  filePath: string;
  relativePath: string;
  mode: 'merge' | 'overwrite';
  unit: 'cm' | 'mm';
  measurementCount: number;
  measurements: MeasurementEntry[];
}

function ensureSmmeExtension(filename: string): string {
  const trimmed = filename.trim();
  return trimmed.endsWith('.smme') ? trimmed : `${trimmed}.smme`;
}

export async function executeManageMeasurements(
  input: ManageMeasurementsInput,
  workspace: WorkspaceRepository,
): Promise<ManageMeasurementsResult> {
  const relativePath = ensureSmmeExtension(input.filename);
  const mergedMap = new Map<string, number>();

  let notes = input.notes ?? '';
  let pmSystem = input.pmSystem ?? '998';
  let readOnly = false;

  if (input.mode === 'merge' && (await workspace.exists(relativePath))) {
    const existingXml = await workspace.readText(relativePath);
    const inspected = inspectXmlContent(existingXml);
    if (inspected.documentType === 'smme') {
      for (const item of inspected.measurements) {
        mergedMap.set(item.name, item.value);
      }
      if (input.notes === undefined) {
        notes = inspected.notes;
      }
      if (input.pmSystem === undefined) {
        pmSystem = inspected.pmSystem;
      }
      readOnly = inspected.readOnly;
    }
  }

  for (const [name, value] of Object.entries(input.measurements)) {
    mergedMap.set(name.trim(), value);
  }

  const measurements: MeasurementEntry[] = Array.from(mergedMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  const document: MeasurementsDocument = {
    version: '0.5.0',
    readOnly,
    notes,
    unit: input.unit,
    pmSystem,
    measurements,
  };

  const xml = serializeSmme(document);
  const filePath = await workspace.writeText(relativePath, xml);

  return {
    filePath,
    relativePath,
    mode: input.mode,
    unit: input.unit,
    measurementCount: measurements.length,
    measurements,
  };
}
