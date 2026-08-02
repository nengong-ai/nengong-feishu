import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { renderConfig } from "../../installers/render-config.mjs";

const input = { server: "./mcp-server/server.js", workdir: "./fixtures" };

test("标准 mcpServers 客户端与通用入口可解析且不含密钥", () => {
  for (const client of ["claude-code", "claude-desktop", "qoder", "trae", "kimi-cli", "generic"]) {
    const output = renderConfig({ client, ...input });
    const parsed = JSON.parse(output);
    assert.ok(parsed.mcpServers.nengong_feishu.command);
    assert.equal("APP_SECRET" in parsed.mcpServers.nengong_feishu.env, false);
  }
});

test("国内常用客户端输出各自原生结构", () => {
  assert.match(renderConfig({ client: "codex", ...input }), /^\[mcp_servers\.nengong_feishu\]/);
  assert.equal(JSON.parse(renderConfig({ client: "opencode", ...input })).mcp.nengong_feishu.type, "local");
  assert.match(renderConfig({ client: "hermes", ...input }), /^mcp_servers:/);

  const zcode = JSON.parse(renderConfig({ client: "zcode", ...input })).mcp.servers.nengong_feishu;
  assert.equal(zcode.type, "stdio");
  assert.equal(zcode.timeoutMs, 60000);
  assert.equal(zcode.enabled, true);

  const kimi = JSON.parse(renderConfig({ client: "kimi", ...input })).mcp.servers.nengong_feishu;
  assert.ok(kimi.command);

  const workbuddy = JSON.parse(renderConfig({ client: "workbuddy", ...input })).mcpServers.nengong_feishu;
  assert.equal(workbuddy.disabled, false);
});

test("可固定使用用户已授权的 lark-cli，避免客户端内置 CLI 抢占 PATH", () => {
  const kimi = JSON.parse(renderConfig({
    client: "kimi",
    ...input,
    larkCli: "./fixtures/lark-cli",
  }));
  const env = kimi.mcp.servers.nengong_feishu.env;
  assert.equal(env.LARK_CLI, resolve("./fixtures/lark-cli"));
  assert.equal("API_KEY" in env, false);

  const codex = renderConfig({
    client: "codex",
    ...input,
    larkCli: "./fixtures/lark-cli",
  });
  assert.ok(codex.includes(`LARK_CLI = ${JSON.stringify(resolve("./fixtures/lark-cli"))}`));
  assert.equal(codex.includes("API_KEY"), false);

  const hermes = renderConfig({
    client: "hermes",
    ...input,
    larkCli: "./fixtures/lark-cli",
  });
  assert.ok(hermes.includes(`LARK_CLI: ${JSON.stringify(resolve("./fixtures/lark-cli"))}`));
  assert.ok(hermes.includes("supports_parallel_tool_calls: false"));
  assert.equal(hermes.includes("API_KEY"), false);
});

test("可覆盖 Node 可执行文件，避开客户端对含空格 command 的错误拆分", () => {
  const parsed = JSON.parse(renderConfig({
    client: "trae",
    ...input,
    node: "./fixtures/node",
  }));
  assert.equal(parsed.mcpServers.nengong_feishu.command, resolve("./fixtures/node"));
});
