# nengong-feishu

面向中文用户与主流 AI Agent 的飞书 MCP 和文档排版 Skill。

本仓库包含两个相互衔接、也可以单独使用的组件：

- [`mcp-server/`](mcp-server/)：基于官方 `lark-cli` 的纯飞书 stdio MCP，提供文档、媒体和受控多维表格记录能力。
- [`skills/feishu-doc-formatter/`](skills/feishu-doc-formatter/)：先保真、后排版的飞书云文档 Skill，依赖稳定的执行器契约。

MCP 与 Skill 不共享用户凭证，也不包含私有 Agent 管理仓库、客户端配置或本机路径。

## 支持的客户端与连接方式

这个项目不是一个需要填写远程 URL 的 SaaS MCP，而是本地 `stdio` MCP：

```text
AI Agent → 本地 server.js → 飞书官方 lark-cli → 飞书 API
```

第一次使用需要安装官方 CLI、完成一次飞书授权，再把生成的配置片段导入客户端。仓库提供配置生成器，但不会覆盖你已有的 MCP 配置，也不会把密钥写进配置文件。

| Logo | Agent / 客户端 | 如何连接 | 配置形态 | 状态 |
| :---: | --- | --- | --- | :---: |
| 🟣 | Codex Desktop | 生成后合并到 `~/.codex/config.toml` | TOML | ✅ macOS 实机验证 |
| <img src="https://cdn.simpleicons.org/claude" alt="Claude" width="24" /> | Claude Code | `claude mcp add --scope local`，或导入生成片段 | CLI / JSON | ✅ macOS 实机验证 |
| <img src="https://cdn.simpleicons.org/claude" alt="Claude" width="24" /> | Claude Desktop | 合并到 `claude_desktop_config.json` | JSON | ✅ macOS 实机验证 |
| **Z** | ZCode | 合并到 `mcp.servers` | 嵌套 JSON | ✅ macOS 实机验证 |
| <img src="https://cdn.simpleicons.org/kimi" alt="Kimi" width="24" /> | Kimi Desktop / Kimi Code CLI | 合并到桌面端持久配置或项目级 `.kimi-code/mcp.json` | 嵌套 JSON / JSON | ✅ macOS 实机验证 |
| **Q** | Qoder CN Desktop / QoderWork CN / Qoder CLI CN | 桌面端 GUI 导入；CLI 用官方注册命令 | JSON / CLI | ✅ macOS 实机验证 |
| <img src="https://cdn.simpleicons.org/trae" alt="Trae" width="24" /> | Trae IDE / TRAE SOLO CN | 在 MCP 设置中导入生成的配置 | JSON | ✅ macOS 实机验证 |
| **W** | WorkBuddy Desktop | 在“插件/连接器 → MCP 服务器”中导入并启用 | JSON | ✅ macOS 实机验证 |
| **CB** | CodeBuddy CLI | `codebuddy mcp add --scope user` | CLI | ✅ macOS 实机验证 |
| <img src="https://cdn.simpleicons.org/opencode" alt="OpenCode" width="24" /> | OpenCode Desktop | 合并到 `~/.config/opencode/opencode.json` | JSON | ✅ macOS 实机验证 |
| <img src="https://cdn.simpleicons.org/hermes" alt="Hermes" width="24" /> | Hermes Agent | 合并到 `~/.hermes/config.yaml`，或使用 `hermes mcp add` | YAML / CLI | ✅ macOS 实机验证 |
| 🧩 | 其他标准 MCP 客户端 | 生成通用 `mcpServers` JSON 后按客户端说明导入 | JSON | 🧩 可接入，未逐一实机认证 |

生成对应客户端的配置片段：

```bash
node installers/render-config.mjs \
  --client codex \
  --server /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --workdir /absolute/path/to/allowed-media-directory \
  --node /absolute/path/to/node \
  --lark-cli /absolute/path/to/lark-cli
```

详细版本、配置入口、重启要求和已验证边界见[客户端支持矩阵](docs/mcp-client-support.md)；其他接入示例见 [MCP 安装指南](docs/mcp-install.md)。

## MCP 工具

MCP 当前暴露 11 个有边界的工具。文档、媒体和多维表格写入都要求显式 `confirm_write=true`；可以先用 `dry_run=true` 预览。

| Tool | 能做什么 |
| --- | --- |
| `feishu_setup` | 首次使用索引：检查 CLI、应用配置和用户授权，并给出下一步 |
| `feishu_doc_read` | 读取 Docx / Wiki 文档，支持 XML、Markdown、范围和块定位 |
| `feishu_doc_copy` | 使用飞书 Drive API 创建文档副本 |
| `feishu_doc_update` | 按文本或 block 精确更新、插入、移动、删除或追加内容 |
| `feishu_doc_media_insert` | 上传本地图片或附件并插入文档 |
| `feishu_bitable_record` | 受控读取、创建或更新多维表格记录，不提供任意 API 执行 |
| `feishu_auth_status` | 查看当前授权身份、token 状态和已授权 scope |
| `feishu_auth_start` / `feishu_auth_complete` | 启动并完成最小权限 Device Flow 授权 |
| `feishu_doctor` | 检查 CLI、本地配置、鉴权和连通性 |
| `feishu_schema` | 读取官方 `lark-cli` raw 方法的实时 JSON Schema |

## 快速开始

### MCP

要求 Node.js 20 或 22，并先安装飞书官方 CLI：

```bash
npx @larksuite/cli@latest install
cd mcp-server
npm ci
npm run check
npm test
```

使用 [`installers/render-config.mjs`](installers/render-config.mjs) 为具体 MCP 客户端生成配置片段。凭证由官方 CLI 管理；第一次使用先调用 `feishu_setup`，不要直接写入生产文档。

### 文档排版 Skill

将 `skills/feishu-doc-formatter/` 作为 Skill 目录安装到你的 Agent。执行器能力契约见 [`skills/feishu-doc-formatter/references/operation-contract.md`](skills/feishu-doc-formatter/references/operation-contract.md)，它与本仓库 MCP 的映射见 [`docs/MCP_CONTRACT.md`](docs/MCP_CONTRACT.md)。

运行不连接飞书的 mock/dry-run 测试：

```bash
python tests/formatter/test_dry_run.py
python tests/formatter/test_routing.py
python tests/formatter/test_pre_routing.py
```

真实飞书写入必须在专用测试文档上获得用户授权后再执行。

## CI

GitHub Actions 会在 Ubuntu、macOS、Windows 上分别使用 Node.js 20 和 22，运行 MCP 检查、测试、Formatter 合同测试和依赖审计。

## 来源与许可证

本项目采用 [MIT License](LICENSE)。飞书官方 CLI、官方 OpenAPI MCP 和 MCP SDK 的来源、版权与许可证说明见 [`mcp-server/THIRD_PARTY_NOTICES.md`](mcp-server/THIRD_PARTY_NOTICES.md)。完整的边界与测试记录见 [`docs/mcp-audit.md`](docs/mcp-audit.md) 和 [`docs/formatter-release-audit.md`](docs/formatter-release-audit.md)。
