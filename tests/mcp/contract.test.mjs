import test from "node:test";
import assert from "node:assert/strict";
import { CONTRACT_VERSION, TOOL_DEFINITIONS } from "../../mcp-server/src/contract.js";

test("v1 合同工具集合固定", () => {
  assert.equal(CONTRACT_VERSION, "1.0");
  assert.deepEqual(TOOL_DEFINITIONS.map((tool) => tool.name), [
    "feishu_setup",
    "feishu_doc_read",
    "feishu_doc_copy",
    "feishu_doc_update",
    "feishu_doc_media_insert",
    "feishu_bitable_record",
    "feishu_auth_status",
    "feishu_auth_start",
    "feishu_auth_complete",
    "feishu_doctor",
    "feishu_schema",
  ]);
});

test("所有工具 schema 拒绝未知顶层参数", () => {
  for (const tool of TOOL_DEFINITIONS) {
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
  }
});
