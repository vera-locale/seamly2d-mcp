import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';
import { DomainValidationError } from '../domain/index.js';
import { SeamlyCliError, WorkspaceError, XmlInspectionError } from '../infrastructure/index.js';

export interface StructuredErrorPayload {
  ok: false;
  errorType:
    | 'DOMAIN_VALIDATION_ERROR'
    | 'WORKSPACE_ERROR'
    | 'XML_INSPECTION_ERROR'
    | 'SEAMLY_CLI_ERROR'
    | 'SCHEMA_VALIDATION_ERROR'
    | 'UNEXPECTED_ERROR';
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function createSuccessResult(payload: Record<string, unknown>): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ ok: true, ...payload }, null, 2),
      },
    ],
  };
}

export function mapErrorToToolResult(error: unknown): CallToolResult {
  let payload: StructuredErrorPayload;

  if (error instanceof DomainValidationError) {
    payload = {
      ok: false,
      errorType: 'DOMAIN_VALIDATION_ERROR',
      code: error.code,
      message: error.message,
      ...(error.context !== undefined ? { details: error.context } : {}),
    };
  } else if (error instanceof WorkspaceError) {
    payload = {
      ok: false,
      errorType: 'WORKSPACE_ERROR',
      code: error.code,
      message: error.message,
    };
  } else if (error instanceof XmlInspectionError) {
    payload = {
      ok: false,
      errorType: 'XML_INSPECTION_ERROR',
      code: error.code,
      message: error.message,
    };
  } else if (error instanceof SeamlyCliError) {
    payload = {
      ok: false,
      errorType: 'SEAMLY_CLI_ERROR',
      code: error.details.category,
      message: error.message,
      details: {
        binaryPath: error.details.binaryPath,
        args: error.details.args,
        exitCode: error.details.exitCode,
        stdout: error.details.stdout,
        stderr: error.details.stderr,
        hint: error.details.hint,
      },
    };
  } else if (error instanceof ZodError) {
    payload = {
      ok: false,
      errorType: 'SCHEMA_VALIDATION_ERROR',
      code: 'INVALID_ARGUMENTS',
      message: 'Tool arguments failed schema validation.',
      details: {
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  } else {
    payload = {
      ok: false,
      errorType: 'UNEXPECTED_ERROR',
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
