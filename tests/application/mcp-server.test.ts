import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { createSeamlyMcpServer, mapErrorToToolResult } from '../../src/application/index.js';
import {
  type ExecFileFn,
  Seamly2DCli,
  SeamlyCliError,
  WorkspaceRepository,
  XmlInspectionError,
} from '../../src/infrastructure/index.js';
import { BODICE_BACK_FIXTURE, STANDARD_SIZE_38_MEASUREMENTS } from '../fixtures/bodice-back.js';

function parseToolJson(result: { content: unknown }): Record<string, unknown> {
  const content = result.content as Array<{ type: string; text?: string }>;
  const first = content[0];
  expect(first?.type).toBe('text');
  return JSON.parse(first?.text ?? '{}') as Record<string, unknown>;
}

describe('Seamly2D MCP Server (InMemoryTransport E2E)', () => {
  let tempDir: string;
  let client: Client;
  let mockExecFile: ReturnType<typeof vi.fn<ExecFileFn>>;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'seamly2d-mcp-e2e-'));
    mockExecFile = vi.fn<ExecFileFn>().mockResolvedValue({
      stdout: 'Seamly2D export complete',
      stderr: '',
    });

    const workspace = new WorkspaceRepository(tempDir);
    const cli = new Seamly2DCli({
      binaryPath: '/mock/bin/seamly2d',
      execFileFn: mockExecFile,
    });
    const server = createSeamlyMcpServer({ workspace, cli });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'vitest-mcp-client', version: '1.0.0' });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('registers all 4 required MCP tools', async () => {
    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'build_parametric_pattern',
      'compile_and_export_pattern',
      'inspect_pattern',
      'manage_measurements',
    ]);
  });

  it('runs full Bodice Back Block workflow: manage_measurements -> build_parametric_pattern -> inspect_pattern -> compile_and_export_pattern', async () => {
    // 1. Create standard_size_38.smme
    const measRes = await client.callTool({
      name: 'manage_measurements',
      arguments: {
        filename: 'standard_size_38',
        unit: 'cm',
        mode: 'overwrite',
        measurements: STANDARD_SIZE_38_MEASUREMENTS,
      },
    });
    expect(measRes.isError).toBeFalsy();
    const measPayload = parseToolJson(measRes);
    expect(measPayload.ok).toBe(true);
    expect(measPayload.relativePath).toBe('standard_size_38.smme');
    expect(measPayload.measurementCount).toBe(5);

    // 1b. Merge an extra measurement
    const mergeRes = await client.callTool({
      name: 'manage_measurements',
      arguments: {
        filename: 'standard_size_38.smme',
        unit: 'cm',
        mode: 'merge',
        measurements: { hip_circ: 98 },
      },
    });
    const mergePayload = parseToolJson(mergeRes);
    expect(mergePayload.measurementCount).toBe(6);

    // 2. Build Bodice Back Block pattern
    const buildRes = await client.callTool({
      name: 'build_parametric_pattern',
      arguments: BODICE_BACK_FIXTURE,
    });
    expect(buildRes.isError).toBeFalsy();
    const buildPayload = parseToolJson(buildRes);
    expect(buildPayload.ok).toBe(true);
    expect(buildPayload.relativePath).toBe('bodice_back_base.sm2d');
    expect(buildPayload.totalAllocatedIds).toBe(28);
    expect(Array.isArray(buildPayload.symbolTable)).toBe(true);

    // 3. Inspect generated .sm2d file
    const inspectRes = await client.callTool({
      name: 'inspect_pattern',
      arguments: { filename: 'bodice_back_base.sm2d' },
    });
    expect(inspectRes.isError).toBeFalsy();
    const inspectPayload = parseToolJson(inspectRes);
    expect(inspectPayload.ok).toBe(true);
    const doc = inspectPayload.document as {
      documentType: string;
      drawBlocks: Array<{ name: string; pieces: Array<{ name: string }> }>;
    };
    expect(doc.documentType).toBe('sm2d');
    expect(doc.drawBlocks[0]?.name).toBe('Bodice_Back');
    expect(doc.drawBlocks[0]?.pieces[0]?.name).toBe('Back_Bodice_Cut1_OnFold');

    // 4. Compile & export to SVG via mocked Seamly2D CLI
    const exportRes = await client.callTool({
      name: 'compile_and_export_pattern',
      arguments: {
        patternFile: 'bodice_back_base.sm2d',
        measurementsFile: 'standard_size_38.smme',
        format: 'svg',
      },
    });
    expect(exportRes.isError).toBeFalsy();
    const exportPayload = parseToolJson(exportRes);
    expect(exportPayload.ok).toBe(true);
    expect(exportPayload.formatCode).toBe('0');
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });

  it('returns structured error responses for domain validation failures and CLI failures', async () => {
    const badAstRes = await client.callTool({
      name: 'build_parametric_pattern',
      arguments: {
        filename: 'bad_dag',
        measurementsFile: 'standard_size_38.smme',
        drawBlocks: [
          {
            name: 'Invalid_Block',
            elements: [
              { type: 'endLine', name: 'A1', basePoint: 'A', length: 10, angle: 0 },
              { type: 'single', name: 'A', x: 0, y: 0 },
            ],
          },
        ],
      },
    });
    expect(badAstRes.isError).toBe(true);
    const badAstPayload = parseToolJson(badAstRes);
    expect(badAstPayload.ok).toBe(false);
    expect(badAstPayload.errorType).toBe('DOMAIN_VALIDATION_ERROR');
    expect(badAstPayload.code).toBe('FORWARD_REFERENCE');

    const missingFileRes = await client.callTool({
      name: 'compile_and_export_pattern',
      arguments: {
        patternFile: 'missing.sm2d',
        measurementsFile: 'missing.smme',
        format: 'pdf',
      },
    });
    expect(missingFileRes.isError).toBe(true);
    const missingPayload = parseToolJson(missingFileRes);
    expect(missingPayload.errorType).toBe('WORKSPACE_ERROR');
    expect(missingPayload.code).toBe('FILE_NOT_FOUND');
  });

  it('maps XmlInspectionError, SeamlyCliError, ZodError, and unexpected errors cleanly', () => {
    const xmlRes = mapErrorToToolResult(new XmlInspectionError('INVALID_XML', 'Bad XML'));
    expect(xmlRes.isError).toBe(true);
    expect(parseToolJson(xmlRes).errorType).toBe('XML_INSPECTION_ERROR');

    const cliRes = mapErrorToToolResult(
      new SeamlyCliError('Parser error', {
        binaryPath: 'seamly2d',
        args: ['-f', '0'],
        exitCode: 1,
        stdout: '',
        stderr: 'Unexpected token',
        category: 'FORMULA_ERROR',
        hint: 'Use semicolon',
      }),
    );
    expect(cliRes.isError).toBe(true);
    expect(parseToolJson(cliRes).errorType).toBe('SEAMLY_CLI_ERROR');

    const zodRes = mapErrorToToolResult(new ZodError([]));
    expect(zodRes.isError).toBe(true);
    expect(parseToolJson(zodRes).errorType).toBe('SCHEMA_VALIDATION_ERROR');

    const genericRes = mapErrorToToolResult(new Error('Boom'));
    expect(genericRes.isError).toBe(true);
    expect(parseToolJson(genericRes).errorType).toBe('UNEXPECTED_ERROR');
  });
});
