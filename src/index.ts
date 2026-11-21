#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createSeamlyMcpServer } from './application/index.js';

async function main(): Promise<void> {
  const server = createSeamlyMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`Fatal error starting seamly2d-mcp: ${message}\n`);
  process.exit(1);
});
