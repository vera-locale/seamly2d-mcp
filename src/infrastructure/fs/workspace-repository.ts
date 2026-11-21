import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class WorkspaceError extends Error {
  public readonly code: 'PATH_TRAVERSAL' | 'FILE_NOT_FOUND' | 'IO_ERROR';

  public constructor(code: 'PATH_TRAVERSAL' | 'FILE_NOT_FOUND' | 'IO_ERROR', message: string) {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
  }
}

export class WorkspaceRepository {
  public readonly rootDir: string;

  public constructor(rootDir?: string) {
    const configured = rootDir ?? process.env.SEAMLY_WORKSPACE ?? process.cwd();
    this.rootDir = path.resolve(configured);
  }

  public resolveWorkspacePath(relativePath: string): string {
    const trimmed = relativePath.trim();
    if (trimmed.length === 0) {
      throw new WorkspaceError('PATH_TRAVERSAL', 'File path cannot be empty.');
    }

    const resolved = path.resolve(this.rootDir, trimmed);
    const relative = path.relative(this.rootDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new WorkspaceError(
        'PATH_TRAVERSAL',
        `Path "${relativePath}" escapes SEAMLY_WORKSPACE (${this.rootDir}).`,
      );
    }

    return resolved;
  }

  public async exists(relativePath: string): Promise<boolean> {
    const target = this.resolveWorkspacePath(relativePath);
    try {
      await access(target);
      return true;
    } catch {
      return false;
    }
  }

  public async readText(relativePath: string): Promise<string> {
    const target = this.resolveWorkspacePath(relativePath);
    try {
      return await readFile(target, 'utf8');
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new WorkspaceError('FILE_NOT_FOUND', `File not found in workspace: ${relativePath}`);
      }
      throw new WorkspaceError(
        'IO_ERROR',
        `Failed to read file "${relativePath}": ${nodeErr.message}`,
      );
    }
  }

  public async writeText(relativePath: string, content: string): Promise<string> {
    const target = this.resolveWorkspacePath(relativePath);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
      return target;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new WorkspaceError('IO_ERROR', `Failed to write file "${relativePath}": ${msg}`);
    }
  }

  public async ensureDirectory(relativeDir: string): Promise<string> {
    const target = this.resolveWorkspacePath(relativeDir);
    try {
      await mkdir(target, { recursive: true });
      return target;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new WorkspaceError('IO_ERROR', `Failed to create directory "${relativeDir}": ${msg}`);
    }
  }
}
