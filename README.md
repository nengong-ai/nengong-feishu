# nengong-feishu

面向中文用户与主流 AI Agent 的飞书 MCP 和文档排版 Skill。

本仓库包含两个相互衔接、也可以单独使用的组件：

- [`mcp-server/`](mcp-server/)：基于官方 `lark-cli` 的纯飞书 stdio MCP，提供文档、媒体和受控多维表格记录能力。
- [`skills/feishu-doc-formatter/`](skills/feishu-doc-formatter/)：先保真、后排版的飞书云文档 Skill，依赖稳定的执行器契约。

MCP 与 Skill 不共享用户凭证，也不包含私有 Agent 管理仓库、客户端配置或本机路径。

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
