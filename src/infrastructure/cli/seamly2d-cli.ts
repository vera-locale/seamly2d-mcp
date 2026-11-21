import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(nodeExecFile);

export type ExportFormat = 'svg' | 'pdf' | 'dxf';

export const EXPORT_FORMAT_CODES: Readonly<Record<ExportFormat, string>> = {
  svg: '0',
  pdf: '1',
  dxf: '2',
};

export interface ExecFileOutput {
  stdout: string;
  stderr: string;
}

export type ExecFileFn = (
  file: string,
  args: readonly string[],
  options: { timeout: number },
) => Promise<ExecFileOutput>;

export interface SeamlyCliErrorDetails {
  binaryPath: string;
  args: readonly string[];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  category: 'BINARY_NOT_FOUND' | 'FORMULA_ERROR' | 'XML_PARSE_ERROR' | 'CLI_EXECUTION_ERROR';
  hint: string;
}

export class SeamlyCliError extends Error {
  public readonly details: SeamlyCliErrorDetails;

  public constructor(message: string, details: SeamlyCliErrorDetails) {
    super(message);
    this.name = 'SeamlyCliError';
    this.details = details;
  }
}

export interface CompileExportOptions {
  patternPath: string;
  measurementsPath: string;
  exportDir: string;
  outputName: string;
  format: ExportFormat;
  timeoutMs?: number;
}

export interface CompileExportResult {
  binaryPath: string;
  args: string[];
  format: ExportFormat;
  formatCode: string;
  exportDir: string;
  outputName: string;
  stdout: string;
  stderr: string;
  exitCode: 0;
}

export function resolveSeamlyBinaryPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const configured = env.SEAMLY2D_PATH?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }
  if (platform === 'darwin') {
    return '/Applications/Seamly2D.app/Contents/MacOS/Seamly2D';
  }
  return 'seamly2d';
}

function classifySeamlyError(
  stderr: string,
  stdout: string,
  nodeCode: string | undefined,
): { category: SeamlyCliErrorDetails['category']; hint: string } {
  if (nodeCode === 'ENOENT') {
    return {
      category: 'BINARY_NOT_FOUND',
      hint: 'Seamly2D binary was not found. Install Seamly2D or set the SEAMLY2D_PATH environment variable.',
    };
  }

  const combined = `${stderr}\n${stdout}`.toLowerCase();

  if (
    combined.includes('parser error') ||
    combined.includes('unexpected token') ||
    combined.includes('formula') ||
    combined.includes('unknown variable') ||
    combined.includes('qmuparser')
  ) {
    return {
      category: 'FORMULA_ERROR',
      hint: 'Check qMuParser formula syntax: use semicolon ";" for function arguments (e.g., min(a; b)), degrees for trig functions, "#" prefix for increments, and ensure all measurement names exist in the .smme file.',
    };
  }

  if (
    combined.includes('xml') ||
    combined.includes('dom') ||
    combined.includes('cannot open file') ||
    combined.includes('invalid file') ||
    combined.includes('version')
  ) {
    return {
      category: 'XML_PARSE_ERROR',
      hint: 'Seamly2D failed to parse the .sm2d or .smme XML file. Inspect the pattern with inspect_pattern and verify all references and measurement paths.',
    };
  }

  return {
    category: 'CLI_EXECUTION_ERROR',
    hint: 'Seamly2D exited with a non-zero status. Review stderr and verify the pattern geometry and measurement values.',
  };
}

const defaultExecFile: ExecFileFn = async (file, args, options) => {
  const result = await execFileAsync(file, [...args], {
    timeout: options.timeout,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

export class Seamly2DCli {
  private readonly binaryPath: string;
  private readonly execFileFn: ExecFileFn;

  public constructor(options?: { binaryPath?: string; execFileFn?: ExecFileFn }) {
    this.binaryPath = options?.binaryPath ?? resolveSeamlyBinaryPath();
    this.execFileFn = options?.execFileFn ?? defaultExecFile;
  }

  public getBinaryPath(): string {
    return this.binaryPath;
  }

  public async compileAndExport(options: CompileExportOptions): Promise<CompileExportResult> {
    const formatCode = EXPORT_FORMAT_CODES[options.format];
    const args: string[] = [
      '-b',
      options.exportDir,
      '-d',
      options.outputName,
      '-f',
      formatCode,
      '-m',
      options.measurementsPath,
      options.patternPath,
    ];

    try {
      const { stdout, stderr } = await this.execFileFn(this.binaryPath, args, {
        timeout: options.timeoutMs ?? 30_000,
      });

      return {
        binaryPath: this.binaryPath,
        args,
        format: options.format,
        formatCode,
        exportDir: options.exportDir,
        outputName: options.outputName,
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (err: unknown) {
      const execErr = err as {
        code?: number | string;
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      const stdout = typeof execErr.stdout === 'string' ? execErr.stdout : '';
      const stderr = typeof execErr.stderr === 'string' ? execErr.stderr : '';
      const exitCode = typeof execErr.code === 'number' ? execErr.code : null;
      const nodeCode = typeof execErr.code === 'string' ? execErr.code : undefined;

      const { category, hint } = classifySeamlyError(stderr, stdout, nodeCode);
      const summary =
        stderr.trim().length > 0
          ? stderr.trim()
          : (execErr.message ?? 'Seamly2D CLI execution failed');

      throw new SeamlyCliError(`Seamly2D CLI failed (${category}): ${summary}`, {
        binaryPath: this.binaryPath,
        args,
        exitCode,
        stdout,
        stderr,
        category,
        hint,
      });
    }
  }
}
