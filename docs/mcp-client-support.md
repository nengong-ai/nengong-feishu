# 客户端支持矩阵

这张表回答两个不同的问题：

1. 这个 Agent 能不能接入标准的本地 stdio MCP？
2. 我们有没有在该 Agent 的真实会话里验证过 `nengong_feishu`？

“已实机验证”只代表下表注明的客户端版本、加载模式和 macOS 环境，不等于对该产品所有版本、账号模式或操作系统做了永久兼容承诺。每个客户端最终都必须满足：工具真实出现、`feishu_setup` 返回 `ready=true`，并且只读回读测试文档成功。

本表按独立的 MCP 加载面列行：同一品牌的桌面端、CLI、IDE 或工作台即使共享配置格式，也不合并验证结论。`TRAE Work CN` 是 TRAE 官方把 `TRAE SOLO` 更名后的现行名称；历史验证记录仍保留旧产品名和版本信息。

说明：下表中的历史工具数量来自多维表格能力加入前的文档回归，记录的是当时发现的 10 个文档工具。当前合同已增加第 11 个工具 `feishu_bitable_record`，并已在独立 stdio MCP 进程完成多维表格读写冒烟。它属于 server 层能力：只要客户端能正常加载该 MCP、用户通过官方 `lark-cli` 完成授权并拥有目标表权限，就不需要为每个客户端重复做真实写入认证；客户端更新后需要重新加载，才能发现新增工具。

## 已实机验证

| Agent | 当前承诺 | 接入方式 | 配置形态 / 入口 | 实机边界 |
| --- | --- | --- | --- | --- |
| Codex Desktop | ✅ 已验证 | 合并 TOML 片段 | `~/.codex/config.toml` 的 `[mcp_servers.nengong_feishu]` | macOS；独立 Luna 任务，中等思考强度；只读 setup + 文档回读 |
| Claude Code | ✅ 已验证 | 官方 CLI 注册 | `claude mcp add --scope local`，项目级 MCP | macOS；Claude Code `2.1.220`；另有真实文档写入回归 |
| Claude Desktop | ✅ 已验证 | 合并 JSON | `claude_desktop_config.json` 的 `mcpServers` | macOS；`1.24012.9` 的 `3p / Cowork` 加载模式；其他账号模式需单独确认 |
| ZCode | ✅ 已验证 | 合并嵌套 JSON | `~/.zcode/cli/config.json` 的 `mcp.servers` | macOS；新会话加载后 setup + 文档回读 |
| Kimi Desktop | ✅ 已验证 | 合并嵌套 JSON | `~/Library/Application Support/kimi-desktop/daimon-share/daimon/config.json` 的 `mcp.servers` | macOS；需显式指定已授权的 `lark-cli 1.0.81` |
| Kimi Code CLI | ✅ 已验证 | TUI `/mcp-config` | `~/.kimi-code/mcp.json`（用户级）或当前目录 `.kimi-code/mcp.json`（项目级） | macOS；`0.31.1`；历史文档回归显示 10 个工具，setup + 文档回读通过 |
| Qoder CLI CN | ✅ 已验证 | 官方 CLI 注册 | `qoderclicn mcp add --scope local`，用 `qoderclicn mcp list` 检查 | macOS；`1.1.11`；从项目目录启动后 setup + 文档回读通过 |
| Qoder CN Desktop | ✅ 已验证 | GUI MCP 管理器 | `Qoder 设置 → MCP 服务 → 我的服务 → 添加`，保存后启用 | macOS；当前复验未提供客户端版本；历史文档回归显示 10 个工具，setup + 文档回读通过 |
| QoderWork CN | ✅ 已验证 | GUI 连接器导入 | `Settings → Connectors & MCP`，导入 `mcpServers` JSON | macOS；`0.6.3`；工具通过 lazy-loading 通道调用 |
| TRAE Work CN（原 TRAE SOLO CN） | ✅ 已验证（原 SOLO） | GUI MCP 导入 | TRAE Work 的 MCP 设置，或旧版 `mcp.json` 配置层 | macOS；历史验证版本 `TRAE SOLO CN 3.3.83`；Node 路径不能含空格；新版本需重新验证 |
| Trae IDE | ✅ 已验证 | GUI MCP 导入 | Agent 面板设置 → MCP；项目级 `.trae/mcp.json` 导入开关 | macOS；客户端版本未确认；模型名不作为版本；历史文档回归显示 10 个工具，setup + 文档回读通过 |
| WorkBuddy Desktop | ✅ 已验证 | GUI 连接器导入 | Desktop 的“插件/连接器 → MCP 服务器” | macOS；`5.3.8`；不能用 CodeBuddy CLI 的 Connected 代替 Desktop 验证 |
| CodeBuddy CLI | ✅ 已验证 | 官方 CLI 注册 | `codebuddy mcp add --scope user`，用 `codebuddy mcp list/get` 检查 | macOS；`2.132.0`；独立 CLI 会话真实 setup + 文档回读 |
| OpenCode Desktop | ✅ 已验证 | 合并 JSON | `~/.config/opencode/opencode.json` 的 `mcp.nengong_feishu` | macOS；`1.18.9`；本地 MCP 使用 `type=local` 和数组 `command` |
| Hermes Agent | ✅ 已验证 | YAML 合并或官方 CLI | `~/.hermes/config.yaml` 的 `mcp_servers`，或 `hermes mcp add` | macOS；`0.19.0`；配置关闭并行工具调用 |

## 标准接入，但尚未列入实机认证

这些客户端只要支持标准 MCP stdio，就可以使用通用配置片段；“可接入”不等于本项目已经测试过该客户端的 GUI、工具发现、重启行为或模型路由。

| Agent / 类型 | 支持方式 | 配置片段 | 当前状态 |
| --- | --- | --- | --- |
| 其他标准 MCP Agent | 通用 stdio JSON | `--client generic` 生成 `mcpServers`，再由客户端合并 | 🧩 以客户端自己的 MCP 设置为准 |

生成通用片段：

```bash
node installers/render-config.mjs \
  --client generic \
  --server /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --workdir /absolute/path/to/allowed-media-directory \
  --node /absolute/path/to/node \
  --lark-cli /absolute/path/to/lark-cli
```

## 当前不承诺的相邻产品

除表中已验证的客户端外，其他产品仍只享有标准 MCP stdio 接入，不自动获得专用适配承诺。Qoder CN Desktop、QoderWork CN、Qoder CLI CN、TRAE Work CN（原 TRAE SOLO CN）与 Trae IDE 是相互独立的加载面，本表已分别记录各自的实机结果；不能用其中一个产品的连接结果替代另一个产品的认证。WorkBuddy Desktop 与 CodeBuddy CLI、Kimi Desktop 与 Kimi Code CLI、Claude Code 与 Claude Desktop 也同样相互独立。

## 接入方法的统一规则

不论客户端界面长什么样，接入都遵循同一条链路：

```text
客户端 MCP 配置
    → 启动本地 server.js
    → 发现当前合同的 11 个 nengong_feishu 工具
    → feishu_setup(verify_auth=true)
    → ready=true 后再读写飞书文档
```

- 配置只包含 `command`、`args` 和 `FEISHU_MCP_WORKDIR`；需要时可加 `LARK_CLI` 的绝对路径。
- 不把 `appSecret`、access token 或用户文档内容写进配置。
- 修改配置后，桌面 Agent 通常需要完全退出并重新打开；只看到配置文件存在或 CLI 显示 Connected，不算会话工具已加载。
- 真实写入仍需工具参数 `confirm_write=true`，首次连接只做 setup 和只读验证。
- 详细安装、授权和客户端差异见 [`mcp-install.md`](mcp-install.md)；合同与工具边界见 [`MCP_CONTRACT.md`](MCP_CONTRACT.md)。

## 如何维护这张表

只有完成以下三项，才能把某个客户端从“标准接入”升级为“已实机验证”：

1. 当前会话真实发现 `feishu_setup` 与 `feishu_doc_read`，不是只在配置或提示词中看到工具名。
2. `feishu_setup({ verify_auth: true })` 返回 CLI 版本、`stage=ready`、`ready=true`、`identity=user`。
3. `feishu_doc_read` 只读回读测试文档，确认标题、PNG 图片块和 caption。

验证记录集中在 [`mcp-test-report.md`](mcp-test-report.md)。如果客户端、版本、加载模式或操作系统发生变化，应新增一条记录并重新评估，不要静默扩大承诺范围。
