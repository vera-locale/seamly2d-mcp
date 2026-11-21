import { describe, expect, it, vi } from 'vitest';
import {
  type ExecFileFn,
  resolveSeamlyBinaryPath,
  Seamly2DCli,
  SeamlyCliError,
} from '../../src/infrastructure/index.js';

describe('Seamly2DCli', () => {
  it('resolves binary path from env var, macOS default, and Linux default', () => {
    expect(resolveSeamlyBinaryPath({ SEAMLY2D_PATH: '/custom/seamly2d' }, 'darwin')).toBe(
      '/custom/seamly2d',
    );
    expect(resolveSeamlyBinaryPath({}, 'darwin')).toBe(
      '/Applications/Seamly2D.app/Contents/MacOS/Seamly2D',
    );
    expect(resolveSeamlyBinaryPath({}, 'linux')).toBe('seamly2d');
  });

  it.each([
    ['svg', '0'],
    ['pdf', '1'],
    ['dxf', '2'],
  ] as const)(
    'passes exact CLI arguments for %s (format code %s)',
    async (format, expectedCode) => {
      const mockExecFile = vi.fn<ExecFileFn>().mockResolvedValue({
        stdout: 'Exported successfully',
        stderr: '',
      });

      const cli = new Seamly2DCli({
        binaryPath: '/usr/local/bin/seamly2d',
        execFileFn: mockExecFile,
      });

      const result = await cli.compileAndExport({
        patternPath: '/ws/bodice_back_base.sm2d',
        measurementsPath: '/ws/standard_size_38.smme',
        exportDir: '/ws/exports',
        outputName: 'bodice_back_base',
        format,
      });

      expect(mockExecFile).toHaveBeenCalledWith(
        '/usr/local/bin/seamly2d',
        [
          '-b',
          '/ws/exports',
          '-d',
          'bodice_back_base',
          '-f',
          expectedCode,
          '-m',
          '/ws/standard_size_38.smme',
          '/ws/bodice_back_base.sm2d',
        ],
        { timeout: 30_000 },
      );

      expect(result.exitCode).toBe(0);
      expect(result.formatCode).toBe(expectedCode);
      expect(result.stdout).toBe('Exported successfully');
    },
  );

  it('classifies ENOENT as BINARY_NOT_FOUND', async () => {
    const err = Object.assign(new Error('spawn seamly2d ENOENT'), { code: 'ENOENT' });
    const mockExecFile = vi.fn<ExecFileFn>().mockRejectedValue(err);
    const cli = new Seamly2DCli({ binaryPath: '/missing/seamly2d', execFileFn: mockExecFile });

    await expect(
      cli.compileAndExport({
        patternPath: '/ws/p.sm2d',
        measurementsPath: '/ws/m.smme',
        exportDir: '/ws/exports',
        outputName: 'p',
        format: 'svg',
      }),
    ).rejects.toSatisfy((caught: unknown) => {
      expect(caught).toBeInstanceOf(SeamlyCliError);
      if (caught instanceof SeamlyCliError) {
        expect(caught.details.category).toBe('BINARY_NOT_FOUND');
        expect(caught.details.hint).toContain('SEAMLY2D_PATH');
      }
      return true;
    });
  });

  it('classifies qMuParser errors as FORMULA_ERROR with actionable hint', async () => {
    const err = Object.assign(new Error('Command failed'), {
      code: 1,
      stdout: '',
      stderr: 'Parser error: Unexpected token "," in formula min(10, 20)',
    });
    const mockExecFile = vi.fn<ExecFileFn>().mockRejectedValue(err);
    const cli = new Seamly2DCli({ binaryPath: 'seamly2d', execFileFn: mockExecFile });

    await expect(
      cli.compileAndExport({
        patternPath: '/ws/p.sm2d',
        measurementsPath: '/ws/m.smme',
        exportDir: '/ws/exports',
        outputName: 'p',
        format: 'pdf',
      }),
    ).rejects.toSatisfy((caught: unknown) => {
      expect(caught).toBeInstanceOf(SeamlyCliError);
      if (caught instanceof SeamlyCliError) {
        expect(caught.details.category).toBe('FORMULA_ERROR');
        expect(caught.details.exitCode).toBe(1);
        expect(caught.details.hint).toContain('semicolon');
      }
      return true;
    });
  });

  it('classifies XML errors as XML_PARSE_ERROR and unknown non-zero exits as CLI_EXECUTION_ERROR', async () => {
    const xmlErr = Object.assign(new Error('Command failed'), {
      code: 2,
      stdout: '',
      stderr: 'Invalid file: cannot open XML document',
    });
    const cli1 = new Seamly2DCli({
      binaryPath: 'seamly2d',
      execFileFn: vi.fn<ExecFileFn>().mockRejectedValue(xmlErr),
    });

    await expect(
      cli1.compileAndExport({
        patternPath: '/ws/p.sm2d',
        measurementsPath: '/ws/m.smme',
        exportDir: '/ws/exports',
        outputName: 'p',
        format: 'dxf',
      }),
    ).rejects.toSatisfy((caught: unknown) => {
      expect(caught).toBeInstanceOf(SeamlyCliError);
      if (caught instanceof SeamlyCliError) {
        expect(caught.details.category).toBe('XML_PARSE_ERROR');
      }
      return true;
    });

    const genericErr = Object.assign(new Error('Command failed'), {
      code: 139,
      stdout: '',
      stderr: 'Segmentation fault',
    });
    const cli2 = new Seamly2DCli({
      binaryPath: 'seamly2d',
      execFileFn: vi.fn<ExecFileFn>().mockRejectedValue(genericErr),
    });

    await expect(
      cli2.compileAndExport({
        patternPath: '/ws/p.sm2d',
        measurementsPath: '/ws/m.smme',
        exportDir: '/ws/exports',
        outputName: 'p',
        format: 'svg',
      }),
    ).rejects.toSatisfy((caught: unknown) => {
      expect(caught).toBeInstanceOf(SeamlyCliError);
      if (caught instanceof SeamlyCliError) {
        expect(caught.details.category).toBe('CLI_EXECUTION_ERROR');
        expect(caught.details.exitCode).toBe(139);
      }
      return true;
    });
  });

  it.skipIf(!process.env.SEAMLY2D_PATH)(
    'opt-in integration: verifies configured SEAMLY2D_PATH binary is invokable',
    () => {
      const cli = new Seamly2DCli();
      expect(cli.getBinaryPath()).toBe(process.env.SEAMLY2D_PATH);
    },
  );
});
