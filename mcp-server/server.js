#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS } from "./src/contract.js";
import { createToolHandler } from "./src/handlers.js";
import { createLarkCliRunner } from "./src/lark-cli-runner.js";

const runner = createLarkCliRunner();
const callTool = createToolHandler({ runner });

const server = new Server(
  { name: "nengong-feishu-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result = await callTool(request.params.name, request.params.arguments ?? {});
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    isError: result.ok !== true,
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[nengong-feishu-mcp] stdio server ready");
