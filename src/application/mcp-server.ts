import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PatternAstBuilder } from '../domain/index.js';
import { Seamly2DCli, WorkspaceRepository } from '../infrastructure/index.js';
import { createSuccessResult, mapErrorToToolResult } from './error-mapper.js';
import {
  BuildParametricPatternInputSchema,
  CompileAndExportPatternInputSchema,
  InspectPatternInputSchema,
  ManageMeasurementsInputSchema,
} from './schemas.js';
import { executeBuildParametricPattern } from './use-cases/build-parametric-pattern.js';
import { executeCompileAndExportPattern } from './use-cases/compile-and-export-pattern.js';
import { executeInspectPattern } from './use-cases/inspect-pattern.js';
import { executeManageMeasurements } from './use-cases/manage-measurements.js';

export interface SeamlyMcpServerDeps {
  workspace?: WorkspaceRepository;
  cli?: Seamly2DCli;
  astBuilder?: PatternAstBuilder;
}

export function createSeamlyMcpServer(deps?: SeamlyMcpServerDeps): McpServer {
  const workspace = deps?.workspace ?? new WorkspaceRepository();
  const cli = deps?.cli ?? new Seamly2DCli();
  const astBuilder = deps?.astBuilder ?? new PatternAstBuilder();

  const server = new McpServer({
    name: 'seamly2d-mcp',
    version: '1.0.0',
  });

  server.registerTool(
    'manage_measurements',
    {
      title: 'Manage Seamly2D Measurements (.smme)',
      description:
        'Create or update a Seamly2D body measurement table (.smme v0.5.0 XML) inside SEAMLY_WORKSPACE. ' +
        'Supports merging new measurements into an existing file or cleanly overwriting it.',
      inputSchema: ManageMeasurementsInputSchema,
    },
    async (args) => {
      try {
        const result = await executeManageMeasurements(args, workspace);
        return createSuccessResult({ ...result });
      } catch (err: unknown) {
        return mapErrorToToolResult(err);
      }
    },
  );

  server.registerTool(
    'build_parametric_pattern',
    {
      title: 'Build Parametric Seamly2D Pattern (.sm2d)',
      description:
        'Validate a chronological parametric pattern AST, resolve symbolic names to globally unique sequential Seamly2D integer IDs, ' +
        'automatically project modeling proxies and clockwise detail piece contours, serialize to .sm2d v0.7.0 XML, and write it to SEAMLY_WORKSPACE. ' +
        'All formulas use Seamly2D qMuParser syntax (degree angles, semicolon ";" function separators, #increments, Line_A_B/Spl_A_B).',
      inputSchema: BuildParametricPatternInputSchema,
    },
    async (args) => {
      try {
        const result = await executeBuildParametricPattern(args, workspace, astBuilder);
        return createSuccessResult({ ...result });
      } catch (err: unknown) {
        return mapErrorToToolResult(err);
      }
    },
  );

  server.registerTool(
    'inspect_pattern',
    {
      title: 'Inspect Seamly2D Pattern or Measurement File',
      description:
        'Parse an existing .sm2d pattern or .smme measurement file inside SEAMLY_WORKSPACE and return a structured JSON summary ' +
        'of measurements, increments, calculation nodes (with resolved symbolic references and formulas), and detail pieces.',
      inputSchema: InspectPatternInputSchema,
    },
    async (args) => {
      try {
        const result = await executeInspectPattern(args, workspace);
        return createSuccessResult({ ...result });
      } catch (err: unknown) {
        return mapErrorToToolResult(err);
      }
    },
  );

  server.registerTool(
    'compile_and_export_pattern',
    {
      title: 'Compile and Export Seamly2D Pattern via CLI',
      description:
        'Invoke the local Seamly2D CLI headlessly to compile a .sm2d pattern against a .smme measurement table ' +
        'and export layout files as SVG (0), PDF (1), or DXF (2). Returns captured stdout/stderr or structured parser diagnostics.',
      inputSchema: CompileAndExportPatternInputSchema,
    },
    async (args) => {
      try {
        const result = await executeCompileAndExportPattern(args, workspace, cli);
        return createSuccessResult({ ...result });
      } catch (err: unknown) {
        return mapErrorToToolResult(err);
      }
    },
  );

  return server;
}
