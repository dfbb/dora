import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { handlers, toolDefs } from "./tools";

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "dora", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefs as unknown as { name: string; description: string; inputSchema: unknown }[],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const name = req.params.name as keyof typeof handlers;
    const fn = handlers[name];
    if (!fn) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "unknown_tool", name }) }], isError: true };
    }
    const out = await fn(req.params.arguments ?? {});
    return { content: [{ type: "text", text: out }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
