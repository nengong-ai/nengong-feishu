# MCP 来源与公开边界审计

审计日期：2026-08-01；最近更新：2026-08-02。

## 当前仓库

审计开始时，独立仓库只有根 `README.md` 和 `AGENTS.md`，没有产品代码、许可证、远端配置或历史密钥。当前分支为 `codex/feishu-mcp`。

## 只读参考来源

### 本地 Hub 适配器

只读参考：本机私有 Hub 工作区中的 `mcp-servers/lark-mcp`。公开仓库不依赖、定位或反向修改该工作区。

该实现是面向私有 Hub 的通用 CLI 包装器，包含 domain 目录工具、任意 `lark_call`、本地 schema cache 和 Hub 安装脚本。它的 Git 历史指向本机仓库所有者，但 Hub 整体没有适合直接复制进公开产品的独立许可证边界。

本项目没有复制其 `server.js`、schema cache、shortcut 清单或安装分发逻辑，只参考了已经验证过的工程经验：stdio MCP、参数数组调用、结构化信封、doctor/schema 和分页风险。

### 飞书官方 CLI

- 仓库：<https://github.com/larksuite/cli>
- 包：`@larksuite/cli`
- 本次核验版本：`1.0.81`
- 许可证：MIT
- 版权所有：Copyright (c) 2026 Lark Technologies Pte. Ltd.

它是当前 MCP 的运行时依赖，负责 OAuth、系统密钥链、OpenAPI、文档 XML/Markdown 转换、图片上传与风险门禁。本项目不内置其二进制，也不接管其凭证存储。

### 飞书官方 OpenAPI MCP

- 仓库：<https://github.com/larksuite/lark-openapi-mcp>
- 本次核验最新版：`0.5.1`
- 许可证：MIT
- 版权所有：Copyright (c) 2025 Lark Technologies Pte. Ltd.

官方 MCP 提供更广泛的 OpenAPI 能力。本项目的独立价值不是重做完整 OpenAPI，而是给 formatter 提供小而稳定、中文友好、有二次写入门禁的文档契约。

### MCP SDK

- 包：`@modelcontextprotocol/sdk@1.30.0`
- 许可证：MIT

依赖版本固定在 lockfile 中；发布前应继续跑 `npm audit` 并复核其 LICENSE。

## 未引入内容

- Hub 的 `.env`、token、账号信息、绝对安装路径和 agent 私有配置。
- Hub 的 `mcp-manifest.json`、`install-mcp.sh`、Codex 特殊写文件逻辑或多 Agent 分发逻辑。
- 官方 CLI 的源码、二进制、Skills、schema cache 或用户凭证。
- 真实飞书文档内容与真实写入测试夹具。

## 敏感信息风险

| 风险 | 当前控制 |
|---|---|
| app secret / access token 泄漏 | MCP 不接收这些字段；凭证由官方 CLI 管理 |
| Device Flow 临时码落盘 | 只在工具结果中短暂返回，文档明确禁止持久化 |
| 任意命令注入 | 不暴露通用执行器；子进程使用 argv 数组且 `shell=false` |
| 任意本地文件上传 | 只接受工作目录内相对路径，拒绝绝对路径和目录穿越 |
| Agent 静默写入生产文档 | 所有写工具需要 `confirm_write=true`；真实回归只在用户明确授权的专用测试文档与文件夹中执行，公开报告不保存 token |
| 文档权限被误认为多维表格权限 | `feishu_bitable_record` 单独声明 Base 记录能力；调用仍受应用 scope、user/bot 身份和目标表 ACL 约束，不在 `feishu_setup` 中默认申请全量 Base 权限 |
| 大输出耗尽上下文/内存 | CLI 输出限制为 10 MiB；schema 必须指定方法路径 |

## 发布候选检查结果

- 已采用 MIT License；顶层仓库和 npm package 均包含许可证，第三方来源与署名继续由 `THIRD_PARTY_NOTICES.md` 保留。
- 当前专用适配名单已全部完成实机验证：Codex Desktop、Claude Code、Claude Desktop、ZCode、Kimi Desktop、Kimi Code CLI、Qoder CLI CN、Qoder CN Desktop、QoderWork CN、TRAE Work CN（原 TRAE SOLO CN）、Trae IDE、WorkBuddy Desktop、CodeBuddy CLI、OpenCode Desktop、Hermes Agent。TRAE Work CN 的公开验证记录对应更名前的 `TRAE SOLO CN 3.3.83`，新版本需重新回归。
- npm `pack --dry-run` 只包含 7 个必要文件；Node.js 22/macOS 已从生成的 `.tgz` 在全新临时项目完成安装、语法检查和 MCP initialize 握手。
- `feishu_bitable_record` 已通过真实专用表的 `list → upsert(confirm_write=true) → list(filter)` 回归；没有执行删除、批量写入或字段建模，也没有把表格坐标写入仓库。
- 已添加 Node.js 20/22 × Ubuntu/macOS/Windows 的 GitHub Actions；远端 CI 只能在创建仓库并上传后实际运行。
- 最终扫描确认当前跟踪树未跟踪 `.env`，没有测试租户、用户绝对路径、私钥、API key、Bearer token 或飞书临时下载凭证；依赖审计为 0 个已知漏洞。
- Git 历史没有常见密钥 pattern，但早期提交包含本机用户路径。公开仓库必须从当前干净树创建新的单一初始提交，不得原样推送本地开发历史。

## 公开前最后门禁

1. 从当前干净树创建独立公开仓库的初始提交，不携带本地开发历史。
2. 先以私有可见性上传并确认三系统 CI 全绿。
3. 由仓库所有者明确批准后再改为公开；本仓库不会自动发布 npm package 或 GitHub Release。
