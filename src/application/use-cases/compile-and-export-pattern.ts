import path from 'node:path';
import {
  type CompileExportResult,
  type Seamly2DCli,
  WorkspaceError,
  type WorkspaceRepository,
} from '../../infrastructure/index.js';
import type { CompileAndExportPatternInput } from '../schemas.js';

export interface CompileAndExportPatternResult extends CompileExportResult {
  patternPath: string;
  measurementsPath: string;
}

export async function executeCompileAndExportPattern(
  input: CompileAndExportPatternInput,
  workspace: WorkspaceRepository,
  cli: Seamly2DCli,
): Promise<CompileAndExportPatternResult> {
  const patternRelative = input.patternFile.trim();
  const measurementsRelative = input.measurementsFile.trim();

  if (!(await workspace.exists(patternRelative))) {
    throw new WorkspaceError(
      'FILE_NOT_FOUND',
      `Pattern file not found in workspace: ${patternRelative}`,
    );
  }
  if (!(await workspace.exists(measurementsRelative))) {
    throw new WorkspaceError(
      'FILE_NOT_FOUND',
      `Measurements file not found in workspace: ${measurementsRelative}`,
    );
  }

  const patternPath = workspace.resolveWorkspacePath(patternRelative);
  const measurementsPath = workspace.resolveWorkspacePath(measurementsRelative);
  const exportDir = await workspace.ensureDirectory(input.exportDir);
  const outputName =
    input.outputName?.trim() ?? path.basename(patternRelative, path.extname(patternRelative));

  const cliResult = await cli.compileAndExport({
    patternPath,
    measurementsPath,
    exportDir,
    outputName,
    format: input.format,
  });

  return {
    ...cliResult,
    patternPath,
    measurementsPath,
  };
}
