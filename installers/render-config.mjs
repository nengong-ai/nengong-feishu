#!/usr/bin/env node

import { resolve } from "node:path";

function usage(message) {
  if (message) console.error(message);
  console.error("用法: node installers/render-config.mjs --client <name> --server <server.js> [--workdir <dir>] [--node <path>] [--lark-cli <path>]");
  console.error("client: codex | claude-code | claude-desktop | workbuddy | qoder | trae | kimi | kimi-cli | opencode | hermes | zcode | generic");
  process.exit(message ? 1 : 0);
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) usage(`无效参数：${key || "<empty>"}`);
    result[key.slice(2)] = value;
  }
  return result;
}

function quoteToml(value) {
  return JSON.stringify(value);
}

function quoteYaml(value) {
  return JSON.stringify(value);
}

export function renderConfig({ client, server, workdir, node, larkCli }) {
  if (!client || !server) throw new Error("client 和 server 必填");
  const serverPath = resolve(server);
  const workingDirectory = resolve(workdir || process.cwd());
  const nodePath = resolve(node || process.execPath);
  const env = {
    FEISHU_MCP_WORKDIR: workingDirectory,
    ...(larkCli ? { LARK_CLI: resolve(larkCli) } : {}),
  };
  const common = {
    command: nodePath,
    args: [serverPath],
    env,
  };

  switch (client) {
    case "codex":
      return [
        "[mcp_servers.nengong_feishu]",
        `command = ${quoteToml(common.command)}`,
        `args = [${common.args.map(quoteToml).join(", ")}]`,
        "",
        "[mcp_servers.nengong_feishu.env]",
        ...Object.entries(env).map(([key, value]) => `${key} = ${quoteToml(value)}`),
      ].join("\n");
    case "opencode":
      return JSON.stringify({
        $schema: "https://opencode.ai/config.json",
        mcp: {
          nengong_feishu: {
            type: "local",
            command: [common.command, ...common.args],
            enabled: true,
            environment: env,
          },
        },
      }, null, 2);
    case "hermes":
      return [
        "mcp_servers:",
        "  nengong_feishu:",
        `    command: ${quoteYaml(common.command)}`,
        `    args: [${common.args.map(quoteYaml).join(", ")}]`,
        "    env:",
        ...Object.entries(env).map(([key, value]) => `      ${key}: ${quoteYaml(value)}`),
        "    enabled: true",
        "    supports_parallel_tool_calls: false",
      ].join("\n");
    case "zcode":
      return JSON.stringify({
        mcp: {
          servers: {
            nengong_feishu: {
              ...common,
              type: "stdio",
              timeoutMs: 60000,
              enabled: true,
            },
          },
        },
      }, null, 2);
    case "kimi":
      return JSON.stringify({ mcp: { servers: { nengong_feishu: common } } }, null, 2);
    case "workbuddy":
      return JSON.stringify({
        mcpServers: {
          nengong_feishu: { ...common, disabled: false },
        },
      }, null, 2);
    case "claude-code":
    case "claude-desktop":
    case "qoder":
    case "trae":
    case "kimi-cli":
    case "generic":
      return JSON.stringify({ mcpServers: { nengong_feishu: common } }, null, 2);
    default:
      throw new Error(`不支持的 client：${client}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) usage();
  try {
    console.log(renderConfig({
      client: args.client,
      server: args.server,
      workdir: args.workdir,
      node: args.node,
      larkCli: args["lark-cli"],
    }));
  } catch (error) {
    usage(error.message);
  }
}
