import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createToolHandler } from "../../mcp-server/src/handlers.js";

function fakeRunner() {
  const calls = [];
  return {
    calls,
    cwd: "/tmp/feishu-mcp-test",
    async run(args) {
      calls.push(args);
      return { ok: true, data: { argv: args } };
    },
  };
}

function sequenceRunner(results) {
  const calls = [];
  return {
    calls,
    cwd: "/tmp/feishu-mcp-test",
    async run(args) {
      calls.push(args);
      return results.shift();
    },
  };
}

test("首次索引在 CLI 缺失时返回安装指引", async () => {
  const runner = sequenceRunner([{
    ok: false,
    error: { type: "spawn_error", message: "ENOENT" },
  }]);
  const call = createToolHandler({ runner });
  const result = await call("feishu_setup", {});
  assert.equal(result.ok, true);
  assert.equal(result.data.ready, false);
  assert.equal(result.data.stage, "cli_missing");
  assert.equal(result.data.install.command, "npx @larksuite/cli@latest install");
});

test("首次索引区分应用配置缺失", async () => {
  const runner = sequenceRunner([
    { ok: true, data: "lark-cli version 1.0.81" },
    { ok: false, error: { type: "config" }, checks: [{ name: "config_file", status: "fail" }] },
  ]);
  const call = createToolHandler({ runner });
  const result = await call("feishu_setup", {});
  assert.equal(result.data.stage, "config_required");
  assert.equal(result.data.configure.command, "lark-cli config init --new");
  assert.equal(runner.calls.length, 2);
});

test("首次索引区分授权缺失与完全就绪", async () => {
  const doctor = {
    ok: true,
    checks: [
      { name: "config_file", status: "pass" },
      { name: "app_resolved", status: "pass" },
    ],
  };
  const missingRunner = sequenceRunner([
    { ok: true, data: "lark-cli version 1.0.81" },
    doctor,
    { ok: true, data: { verified: false, identities: {} } },
  ]);
  const missing = await createToolHandler({ runner: missingRunner })("feishu_setup", {});
  assert.equal(missing.data.stage, "auth_required");
  assert.equal(missing.data.next_tool, "feishu_auth_start");
  assert.equal(missing.data.cli_version, "lark-cli version 1.0.81");
  assert.match(missing.data.next_action, /LARK_CLI/);

  const readyRunner = sequenceRunner([
    { ok: true, data: "lark-cli version 1.0.81" },
    doctor,
    { ok: true, data: { verified: true, identities: { user: { status: "needs_refresh" } } } },
  ]);
  const ready = await createToolHandler({ runner: readyRunner })("feishu_setup", {});
  assert.equal(ready.data.stage, "ready");
  assert.equal(ready.data.ready, true);
});

test("读文档参数映射保持稳定", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const result = await call("feishu_doc_read", {
    doc: "doc-token",
    detail: "with-ids",
    scope: "keyword",
    keyword: "预算",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(runner.calls[0], [
    "docs", "+fetch", "--doc", "doc-token", "--as", "user",
    "--detail", "with-ids", "--doc-format", "xml", "--scope", "keyword",
    "--keyword", "预算",
  ]);
});

test("真实写入未确认时不会启动 CLI", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const result = await call("feishu_doc_update", {
    doc: "doc-token",
    operation: "append",
    content: "<p>test</p>",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.type, "write_confirmation_required");
  assert.equal(runner.calls.length, 0);
});

test("dry run 不要求写入确认", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const result = await call("feishu_doc_copy", {
    source_token: "source",
    folder_token: "folder",
    name: "副本",
    dry_run: true,
  });
  assert.equal(result.ok, true);
  assert.equal(runner.calls[0].at(-1), "--dry-run");
  const dataIndex = runner.calls[0].indexOf("--data");
  assert.deepEqual(JSON.parse(runner.calls[0][dataIndex + 1]), {
    folder_token: "folder",
    name: "副本",
    type: "docx",
  });
});

test("多维表格 list 解析 URL 并映射只读参数", async () => {
  const runner = sequenceRunner([
    { ok: true, data: { base_token: "base", table_id: "tbl", view_id: "vew" } },
    { ok: true, data: { records: [] } },
  ]);
  const call = createToolHandler({ runner });
  const result = await call("feishu_bitable_record", {
    operation: "list",
    base_url: "https://example.feishu.cn/wiki/base-token?table=tbl&view=vew",
    field_ids: ["标题", "状态"],
    filter_json: '{"logic":"and","conditions":[]}',
    limit: 10,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(runner.calls, [
    ["base", "+url-resolve", "--url", "https://example.feishu.cn/wiki/base-token?table=tbl&view=vew", "--as", "user", "--json"],
    [
      "base", "+record-list", "--base-token", "base", "--table-id", "tbl", "--as", "user", "--json",
      "--view-id", "vew", "--field-id", "标题", "--field-id", "状态",
      "--filter-json", '{"logic":"and","conditions":[]}', "--limit", "10",
    ],
  ]);
});

test("多维表格 upsert 需要确认并传递顶层字段映射", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const rejected = await call("feishu_bitable_record", {
    operation: "upsert",
    base_token: "base",
    table_id: "tbl",
    fields: { 标题: "MCP 测试" },
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.type, "write_confirmation_required");
  assert.equal(runner.calls.length, 0);

  const accepted = await call("feishu_bitable_record", {
    operation: "upsert",
    base_token: "base",
    table_id: "tbl",
    record_id: "rec",
    fields: { 标题: "MCP 测试" },
    confirm_write: true,
  });
  assert.equal(accepted.ok, true);
  assert.deepEqual(runner.calls[0], [
    "base", "+record-upsert", "--base-token", "base", "--table-id", "tbl",
    "--json", '{"标题":"MCP 测试"}', "--as", "user", "--record-id", "rec",
  ]);
});

test("多维表格 handler 拒绝空字段和任意 upsert 选项", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const empty = await call("feishu_bitable_record", {
    operation: "upsert", base_token: "base", table_id: "tbl", fields: {}, confirm_write: true,
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.error.type, "validation");
  const extra = await call("feishu_bitable_record", {
    operation: "upsert", base_token: "base", table_id: "tbl", fields: { 标题: "x" },
    limit: 1, confirm_write: true,
  });
  assert.equal(extra.ok, false);
  assert.match(extra.error.message, /upsert 只接受/);
  assert.equal(runner.calls.length, 0);
});

test("多维表格定位拒绝缺少坐标和非 HTTPS URL", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const missing = await call("feishu_bitable_record", { operation: "list" });
  assert.equal(missing.ok, false);
  assert.match(missing.error.message, /base_url/);
  const insecure = await call("feishu_bitable_record", {
    operation: "list", base_url: "http://example.invalid/base",
  });
  assert.equal(insecure.ok, false);
  assert.match(insecure.error.message, /HTTPS/);
  assert.equal(runner.calls.length, 0);
});

test("块操作检查必需参数", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const result = await call("feishu_doc_update", {
    doc: "doc-token",
    operation: "block_replace",
    content: "<p>new</p>",
    confirm_write: true,
  });
  assert.equal(result.ok, false);
  assert.equal(result.error.type, "validation");
  assert.match(result.error.message, /block_id/);
  assert.equal(runner.calls.length, 0);
});

test("媒体路径拒绝绝对路径和目录穿越", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  for (const file of ["/tmp/secret.png", "../secret.png"]) {
    const result = await call("feishu_doc_media_insert", {
      doc: "doc-token",
      file,
      confirm_write: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, "validation");
  }
  assert.equal(runner.calls.length, 0);
});

test("媒体路径拒绝通过符号链接越过工作目录", async () => {
  const root = mkdtempSync(join(tmpdir(), "feishu-mcp-root-"));
  const outside = mkdtempSync(join(tmpdir(), "feishu-mcp-outside-"));
  writeFileSync(join(outside, "secret.png"), "not-a-real-image");
  symlinkSync(outside, join(root, "escape"), process.platform === "win32" ? "junction" : "dir");
  const runner = fakeRunner();
  runner.cwd = root;
  const call = createToolHandler({ runner });
  const result = await call("feishu_doc_media_insert", {
    doc: "doc-token",
    file: "escape/secret.png",
    confirm_write: true,
  });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /符号链接/);
  assert.equal(runner.calls.length, 0);
});

test("鉴权启动强制最小权限范围", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const rejected = await call("feishu_auth_start", {});
  assert.equal(rejected.ok, false);
  assert.equal(runner.calls.length, 0);

  const accepted = await call("feishu_auth_start", { domains: ["docs", "drive"] });
  assert.equal(accepted.ok, true);
  assert.deepEqual(runner.calls[0], [
    "auth", "login", "--domain", "docs", "--domain", "drive", "--no-wait", "--json",
  ]);
});

test("schema path 服务端再次校验", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const result = await call("feishu_schema", { path: "--help" });
  assert.equal(result.ok, false);
  assert.equal(result.error.type, "validation");
  assert.equal(runner.calls.length, 0);
});

test("handler 不依赖客户端 schema 校验枚举和字节长度", async () => {
  const runner = fakeRunner();
  const call = createToolHandler({ runner });
  const badOperation = await call("feishu_doc_update", {
    doc: "doc-token",
    operation: "run_arbitrary_command",
    confirm_write: true,
  });
  assert.equal(badOperation.ok, false);
  assert.match(badOperation.error.message, /operation/);

  const tooLongName = await call("feishu_doc_copy", {
    source_token: "source",
    folder_token: "folder",
    name: "中".repeat(86),
    confirm_write: true,
  });
  assert.equal(tooLongName.ok, false);
  assert.match(tooLongName.error.message, /256 字节/);
  assert.equal(runner.calls.length, 0);
});
