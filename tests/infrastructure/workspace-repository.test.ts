import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WorkspaceError, WorkspaceRepository } from '../../src/infrastructure/index.js';

describe('WorkspaceRepository', () => {
  let tempDir: string;
  let repo: WorkspaceRepository;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'seamly2d-ws-test-'));
    repo = new WorkspaceRepository(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes, checks existence, and reads files inside workspace', async () => {
    expect(await repo.exists('nested/file.txt')).toBe(false);
    const writtenPath = await repo.writeText('nested/file.txt', 'hello seamly');
    expect(writtenPath).toBe(path.join(tempDir, 'nested/file.txt'));
    expect(await repo.exists('nested/file.txt')).toBe(true);
    expect(await repo.readText('nested/file.txt')).toBe('hello seamly');
  });

  it('prevents directory traversal outside SEAMLY_WORKSPACE', () => {
    expect(() => repo.resolveWorkspacePath('../outside.sm2d')).toThrow(WorkspaceError);
    expect(() => repo.resolveWorkspacePath('')).toThrow(WorkspaceError);
  });

  it('throws FILE_NOT_FOUND when reading a missing file', async () => {
    await expect(repo.readText('does-not-exist.sm2d')).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(WorkspaceError);
      if (err instanceof WorkspaceError) {
        expect(err.code).toBe('FILE_NOT_FOUND');
      }
      return true;
    });
  });
});
