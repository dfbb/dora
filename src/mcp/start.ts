import { startMcpServer } from "./server";
startMcpServer().catch((e) => {
  process.stderr.write(`[dora-mcp] ${(e as Error).stack ?? e}\n`);
  process.exit(1);
});
