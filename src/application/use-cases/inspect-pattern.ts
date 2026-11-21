import {
  type InspectedDocument,
  inspectXmlContent,
  type WorkspaceRepository,
} from '../../infrastructure/index.js';
import type { InspectPatternInput } from '../schemas.js';

export interface InspectPatternResult {
  filePath: string;
  relativePath: string;
  document: InspectedDocument;
}

export async function executeInspectPattern(
  input: InspectPatternInput,
  workspace: WorkspaceRepository,
): Promise<InspectPatternResult> {
  const relativePath = input.filename.trim();
  const filePath = workspace.resolveWorkspacePath(relativePath);
  const xmlContent = await workspace.readText(relativePath);
  const document = inspectXmlContent(xmlContent);

  return {
    filePath,
    relativePath,
    document,
  };
}
