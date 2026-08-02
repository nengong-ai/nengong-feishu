import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverPath = fileURLToPath(new URL("../server.js", import.meta.url));
const mockCli = fileURLToPath(new URL("../../tests/mcp/fixtures/mock-lark-cli.mjs", import.meta.url));

test("stdio MCP 可握手、列工具并调用只读工具", async () => {
  const client = new Client({ name: "nengong-feishu-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: {
      ...process.env,
      LARK_CLI: mockCli,
      FEISHU_MCP_WORKDIR: process.cwd(),
    },
    stderr: "pipe",
  });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 11);
    assert.ok(listed.tools.some((tool) => tool.name === "feishu_doctor"));

    const called = await client.callTool({ name: "feishu_doctor", arguments: { offline: true } });
    assert.equal(called.isError, false);
    const envelope = JSON.parse(called.content[0].text);
    assert.deepEqual(envelope.data.argv, ["doctor", "--offline"]);
  } finally {
    await client.close();
  }
});
