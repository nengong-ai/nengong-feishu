import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createLarkCliRunner } from "../../mcp-server/src/lark-cli-runner.js";

const mockCli = fileURLToPath(new URL("./fixtures/mock-lark-cli.mjs", import.meta.url));

test("runner 用 argv 传参，不经过 shell", async () => {
  const runner = createLarkCliRunner({ binary: process.execPath, prefixArgs: [mockCli] });
  const dangerousLooking = "$(touch should-not-exist); value with spaces";
  const result = await runner.run(["schema", dangerousLooking]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.data.argv, ["schema", dangerousLooking]);
});

test("runner 解析结构化错误", async () => {
  const previous = process.env.MOCK_LARK_EXIT_CODE;
  process.env.MOCK_LARK_EXIT_CODE = "7";
  try {
    const runner = createLarkCliRunner({ binary: process.execPath, prefixArgs: [mockCli] });
    const result = await runner.run(["doctor"]);
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "mock_error");
  } finally {
    if (previous === undefined) delete process.env.MOCK_LARK_EXIT_CODE;
    else process.env.MOCK_LARK_EXIT_CODE = previous;
  }
});
