# MCP 阶段测试报告

测试日期：2026-08-01 至 2026-08-02。

## 环境

- macOS arm64
- Node.js `22.23.1`
- `@modelcontextprotocol/sdk` `1.30.0`
- 飞书官方 `lark-cli` `1.0.81`
- 发布候选：组合发布包主分支；本报告源自预发布开发环境。

## 自动测试

运行：

```bash
cd mcp-server
npm run check
npm test
npm audit --audit-level=moderate
```

结果：

- 语法检查通过。
- 25 项测试全部通过，0 失败。
- `npm audit`：0 个已知漏洞。

覆盖范围：

- 契约版本与当前 11 个工具名固定。
- 首次使用索引可区分 CLI 缺失、应用配置缺失、授权缺失和完全就绪。
- input schema 默认拒绝未知顶层字段。
- 读取、复制、更新、鉴权的 CLI argv 映射。
- 未确认真实写入时不启动 CLI。
- `dry_run` 可在不写入的情况下预览。
- 块操作必需字段检查。
- 绝对路径、`..` 穿越和符号链接越界拒绝。
- schema option injection 服务端二次校验。
- handler 端枚举与 UTF-8 字节长度二次校验。
- 子进程使用 argv 数组，不经过 shell。
- lark-cli 结构化错误透传。
- stdio MCP initialize/listTools/callTool 完整握手。
- 10 个重点客户端、Kimi Code CLI 和其他 MCP Agent 通用入口的配置结构与无密钥检查。

## 官方 CLI 只读冒烟

通过真实 MCP 进程调用本机官方 `lark-cli 1.0.81`：

- `feishu_setup({verify_auth:true})`：成功，返回 `stage=ready`、`identity=user`。
- `feishu_doctor({offline:true})`：成功。
- `feishu_schema({path:"drive.files.copy"})`：成功，返回方法 `drive files copy`、风险等级 `write`，并识别 `data`、`params` 两个必需对象。

这一步没有访问飞书生产文档，没有发起授权，也没有执行网络写入。

## Codex Desktop 实机连接

本次使用 ChatGPT Desktop `26.727.51351` 内置的 `codex-cli 0.146.0-alpha.9.2`。先备份用户级 `~/.codex/config.toml`，再只合并 `[mcp_servers.nengong_feishu]` 与对应环境变量，保留原有模型、认证和其他 MCP；配置固定使用不含空格的 Node 绝对路径与用户已授权的 `lark-cli 1.0.81`。

新建 Luna、中等思考强度的独立 Codex 任务后，会话真实发现 `nengong_feishu` 的 `feishu_setup` 和 `feishu_doc_read`。首次索引返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；专用测试文档回读确认预期标题、PNG 图片块和 caption 全部存在。

测试只读，没有发起授权、调用旧 `lark-mcp`、修改飞书内容或改写其他 Codex 配置。公开报告不保存测试文档 URL、document ID、block ID、资源 token 或本地认证内容。由此 Codex Desktop 的当前本地 stdio MCP 链路完成实机验证。

## Claude Code 实机连接

使用 Claude Code `2.1.220`，在项目目录通过官方 `claude mcp add --scope local` 注册 stdio server：

- `claude mcp list` 返回 `nengong_feishu ... Connected`。
- Claude Code 成功发现 `feishu_setup` 的中文说明与 `verify_auth` 参数。
- 经用户逐次确认后，模型实际调用 `feishu_setup({verify_auth:true})` 成功。
- 返回 `stage=ready`、`identity=user`，并正确列出文档读取、复制、块级更新和媒体插入能力。
- `feishu_setup` 调用本身没有读取、创建、复制、更新或插入任何真实飞书文档。

本次 Claude Code 使用第三方 API 路由，只证明该客户端、该模型路由与本 MCP 的工具发现及调用链在当前环境可用；不能代替 Claude 官方账号、Claude Desktop 或其他模型路由的独立验证。Claude Desktop 的单独结果记录在后文。测试记录不包含 API Key、访问令牌或用户文档内容。

## Claude Code 专用文档写入回归

用户提供并明确授权一份新建空白 Wiki 文档用于真实写入。报告不保存其 URL、document token、block ID 或 file token。

- `feishu_doc_read(detail=with-ids, doc_format=xml)`：成功解析 Wiki URL 并读取底层 Docx；初始文档仅含标题块。
- `feishu_doc_update(operation=append, doc_format=markdown)`：成功追加标题、段落、四项列表和测试日期；revision 前进 1。
- 回读确认 Markdown 正确转换为飞书标题、段落和列表块，文本与 block ID 完整。
- `feishu_doc_update(operation=str_replace, doc_format=xml)`：成功精确替换一个列表项；revision 前进 1。
- `feishu_doc_media_insert(media_type=image)`：成功上传并插入 `tests/mcp/fixtures/feishu-mcp-smoke.png`；返回图片 block 与 file token，revision 前进 2。
- 最终回读确认图片块为 PNG、尺寸 `320x180`、居中，caption 与请求完全一致。
- `feishu_doc_copy(file_type=docx)`：成功把源文档复制到用户授权的专用测试文件夹，并返回新文档 token 与 URL。
- 副本回读确认标题、段落、列表、精确替换结果、PNG 图片和 caption 均完整保留；block ID 已重新分配，图片资源也获得独立 token。

所有写操作均显式传入 `confirm_write=true`，并由用户在 Claude Code 权限提示中逐次确认。操作范围仅限该专用测试文档和测试文件夹。由此，formatter 依赖的读取、追加、精确替换、图片上传插入、原生副本及副本回读路径均完成真实环境验证。

## Claude Desktop 实机连接

Claude Desktop `1.24012.9` 当前以 `deploymentMode=3p` 和 Cowork 界面运行，实际用户数据目录为 `~/Library/Application Support/Claude-3p`。本次先备份现有 `claude_desktop_config.json`，再只合并标准 `mcpServers.nengong_feishu`，保留原有 Cowork 偏好和第三方路由设置；配置固定使用不含空格的 Node 绝对路径与用户已授权的 `lark-cli 1.0.81`。

完全退出并重新打开 Claude Desktop 后，新任务真实发现 `mcp__nengong_feishu__feishu_setup` 与 `mcp__nengong_feishu__feishu_doc_read`。首次索引返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；专用测试文档回读确认预期标题、PNG 图片块和 caption 全部存在。

测试只读，没有发起授权、调用旧 `lark-mcp` 或执行任何文档写入。公开报告不保存路由凭证、测试文档 URL、document ID、block ID 或资源 token。由此 Claude Desktop `1.24012.9` 的当前 `3p / Cowork` 加载面完成独立 MCP 实机验证；这不自动代表其他账号模式或未来版本。

## ZCode 与 Kimi Desktop 快速复验

两者只执行连接、首次索引和专用测试文档回读，没有再次写入飞书：

- ZCode `3.6.5`（build `3.6.5.4145`）：重启加载 `mcp.servers.nengong_feishu` 后连接成功；`feishu_setup` 返回 `stage=ready`、`identity=user`、CLI `1.0.81`；回读确认标题、PNG 图片和 caption。
- Kimi Desktop `3.1.6`：首次连接成功但 `feishu_setup` 返回 `auth_required`。诊断确认 Kimi 的 PATH 优先选择其内置 `lark-cli 1.0.50`，而用户已授权的是另一份 `lark-cli 1.0.81`。
- 配置生成器增加可选 `--lark-cli`，把用户 CLI 的绝对路径写入 MCP 环境变量 `LARK_CLI`，不复制凭证。Kimi 重启后使用 CLI `1.0.81`，`feishu_setup` 返回 `ready`，文档三项回读验证全部通过。
- 自动测试覆盖显式 CLI 路径生成，并确认配置不含 API Key、token 或 secret。

## Kimi Code CLI 实机连接

Kimi Code CLI `0.31.1` 与 Kimi Desktop 是独立的客户端加载面。本次先通过 Kimi Code 的 `/login` 完成模型账号登录，再使用 `/mcp-config` 把 `nengong_feishu` 写入项目级 `.kimi-code/mcp.json`；没有修改 Kimi Desktop 配置，也没有使用旧版 `kimi mcp add` 命令。

重新加载后，Kimi Code 的 `/mcp` 显示 `nengong_feishu` 为 `connected`，传输方式为 stdio，并发现合同规定的 10 个工具。新会话真实调用 `feishu_setup({verify_auth:true})` 返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；随后 `feishu_doc_read(detail=with-ids, doc_format=xml)` 回读专用测试文档，标题、PNG 图片块和 caption 三项全部命中。

全程只读，没有发起飞书授权、调用旧 `lark-mcp` 或执行任何文档写入。项目级 `.kimi-code/mcp.json` 是本地客户端配置，不纳入公开提交。由此 Kimi Code CLI `0.31.1` 的当前 macOS stdio 链路完成实机验证；这不自动代表 Kimi Desktop、旧版 Kimi CLI 或其他版本。

## WorkBuddy 接入诊断

WorkBuddy Desktop `5.3.8` 首次按旧经验把配置合并到 `~/.workbuddy/.mcp.json`。配置结构和 MCP 独立握手均通过，但完全重启后，会话仍只有内置 `connector-proxy`，没有加载 `nengong_feishu`。

只读诊断确认 Desktop 启动 `codebuddy` 时使用 `--strict-mcp-config`，而 WorkBuddy 自带的 `codebuddy mcp list` 同时报告用户级 MCP 为空。因此问题不是 MCP server 启动失败，而是旧配置位置不再是当前版本的有效入口。

改用官方 `codebuddy mcp add --scope user` 后，配置写入 `~/.codebuddy/.mcp.json`；`codebuddy mcp list` 与 `codebuddy mcp get nengong_feishu` 均返回 `Connected`，server command、工作目录和固定 `LARK_CLI` 路径正确。

随后完整退出并重启 WorkBuddy Desktop，新的 Desktop 进程仍以 `--strict-mcp-config` 启动，实际参数只包含内置 `connector-proxy`；第二阶段复验仍找不到 `nengong_feishu`。由此确认 `codebuddy mcp` 用户配置只证明 CLI 链路，不能作为 Desktop 接入方式。

改从 WorkBuddy Desktop 的 MCP/连接器层完成接入后，第三阶段新会话真实发现并调用 `mcp__nengong_feishu__feishu_setup` 与 `mcp__nengong_feishu__feishu_doc_read`。`feishu_setup({verify_auth:true})` 返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；文档回读确认预期标题、PNG 图片块和 caption 全部存在。

由此 WorkBuddy Desktop `5.3.8` 完成实机只读复验。测试没有调用旧 `lark-mcp`，没有发起授权，也没有执行文档写入；公开报告不保存测试文档 URL、block ID 或资源 token。CodeBuddy CLI 与 Desktop 仍应视为两个独立接入面。

## CodeBuddy CLI 实机连接

CodeBuddy CLI `2.132.0` 与 WorkBuddy Desktop 是独立的 MCP 加载面。本次使用用户级 `codebuddy mcp` 配置；`codebuddy mcp list` 与 `codebuddy mcp get nengong_feishu` 均显示 stdio server 已连接。进入 CodeBuddy CLI 项目会话并完成信任与登录后，工具搜索真实发现 `mcp__nengong_feishu__feishu_setup` 和 `mcp__nengong_feishu__feishu_doc_read`。

`feishu_setup({verify_auth:true})` 返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；随后 `feishu_doc_read(detail=with-ids, doc_format=xml, scope=full)` 回读专用测试文档，标题、PNG 图片块和 caption 三项全部命中。测试全程只读，没有发起飞书授权、调用旧 `lark-mcp` 或执行文档写入。由此 CodeBuddy CLI `2.132.0` 的当前 macOS stdio 链路完成独立实机验证。

## TRAE Work CN（原 TRAE SOLO CN）接入诊断

TRAE Work CN 的历史客户端（`TRAE SOLO CN 3.3.83`）首次把标准配置写入旧 Trae IDE 使用的 `~/.trae-cn/mcp.json`。MCP 独立握手成功，但重启 TRAE Work 后当前会话仍只有内置 `integrated_code_mode`，没有加载 `nengong_feishu`。TRAE 官方后来将 TRAE SOLO 更名为 TRAE Work；本节保留旧版本名称，便于复现当时的配置路径和故障。

本机与当前客户端资料核对确认，SOLO 和 Trae IDE 的 MCP 配置相互独立。macOS 的 SOLO 全局配置应位于 `~/Library/Application Support/TRAE SOLO CN/User/mcp.json`，项目级配置应位于项目根目录 `.trae/mcp.json`。本次已在正确的 SOLO 全局位置创建只含 `nengong_feishu` 的无密钥配置，并固定 `LARK_CLI` 为用户已授权的 `1.0.81`。

首次使用 SOLO 内置 Node 时，`command` 路径包含空格。MCP host 错误地把路径按空格拆成 command 与多个 args，导致 `spawn ... ENOENT`。改用不含空格的 Node 绝对路径后，SOLO 热加载成功：server 输出 `stdio server ready`，客户端获取到合同规定的全部 10 个工具并记录 `Connected`。配置生成器因此增加可选 `--node`，避免客户端内置运行时路径被错误解析。

新建本地 CODE 模式会话后，模型侧成功加载 `mcp_nengong_feishu` 的工具描述，实际调用 `feishu_setup({verify_auth:true})` 返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`。随后通过 `feishu_doc_read` 回读专用测试文档，确认预期标题、PNG 图片块和 caption 全部存在。

由此 TRAE Work CN 的历史客户端（`TRAE SOLO CN 3.3.83`）完成实机只读复验。测试没有调用旧 `lark-mcp`，没有发起授权，也没有执行任何文档写入；公开报告不保存测试文档 URL、block ID 或资源 token。Trae IDE 是独立客户端，另有单独记录。

## Trae IDE 实机连接

Trae IDE 打开 `feishu-mcp` 项目后，启用项目级 MCP，并在 MCP 管理页显示 `nengong_feishu` 与合同规定的 10 个工具。项目级加载与 TRAE SOLO CN 的全局配置相互独立，不能用 SOLO 的连接状态替代本次验证。

当前 Agent 会话真实发现 `feishu_setup` 与 `feishu_doc_read`，并通过新的 `nengong_feishu` 调用。`feishu_setup({verify_auth:true})` 返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；随后 `feishu_doc_read(detail=with-ids, doc_format=xml, scope=full, identity=user)` 回读测试文档，标题、PNG 图片块和 caption 三项全部命中。

本次复验没有发起授权、调用旧 `lark-mcp` 或执行任何文档写入。模型输出中的 `DeepSeek-V4-Flash` 是模型名称，不是 Trae IDE 版本；客户端版本未确认，因此不扩大到其他版本或操作系统。原始工具回执中的文档标识和媒体下载凭证未写入本报告。

## QoderWork CN 接入诊断

QoderWork CN `0.6.3` 的首次测试直接把标准配置写入 `~/.qoderworkcn/mcp.json`。会话随后尝试调用提示词里明确写出的 `mcp__nengong_feishu__*` 名称，但三次调用都返回 `Tool not found`。

QoderWork 本地日志明确记录当前会话 `Connected servers: 0`，且没有由 QoderWork 启动的 `nengong_feishu` MCP 进程。因此这不是 MCP 工具已加载后断线，而是配置没有经过 QoderWork 的连接器层注册；提示词中的工具名不能作为工具发现证据。

QoderWork 与 Qoder IDE/CLI 相互独立。改从“Settings → Connectors & MCP”手动添加生成的标准 JSON 并显式启用后，QoderWork CN `0.6.3` 完成实机只读复验：lazy-loading 注册表发现全部 10 个工具；经客户端原生 `qw_mcp_get` / `qw_mcp_call` 通道调用，`feishu_setup` 返回 CLI `1.0.81`、`stage=ready`、`identity=user`，文档回读确认测试标题、PNG 图片块和预期 caption。

QoderWork 对直接绑定的 `mcp__nengong_feishu__*` 名称仍可能返回 `Tool not found`，但同一服务器可经其原生 lazy-loading 调度通道正常调用。这记录为 QoderWork 的客户端分发行为，不影响当前功能兼容结论。测试只读，没有发起授权或执行文档写入；报告不保存测试文档 URL、document ID 或资源 token。

## Qoder CLI CN 实机连接

Qoder CLI CN `1.1.11` 与 QoderWork CN、Qoder CN Desktop 是独立的 MCP 加载面。本次先完成 Qoder CLI CN 的浏览器登录，再用 `qoderclicn mcp add --scope local` 把 `nengong_feishu` 写入项目级 `.qoder/settings.local.json`。第一次从用户主目录启动时，项目级 MCP 没有加载；改用带项目工作目录的 `qoderclicn -w` 启动全新会话后，工具真实出现。

新会话成功发现并调用 `feishu_setup` 与 `feishu_doc_read`。setup 返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；文档回读确认标题、PNG 图片块和 caption 全部命中。测试全程只读，没有发起飞书授权、调用旧 `lark-mcp` 或执行任何文档写入。由此 Qoder CLI CN `1.1.11` 的当前 macOS stdio 链路完成独立实机验证。项目级 `.qoder/settings.local.json` 是本地配置，不纳入公开提交。

## Qoder CN Desktop 实机连接

Qoder CN Desktop（Qoder IDE）通过“Qoder 设置 → MCP 服务 → 我的服务 → 添加”导入本地 stdio MCP，并在用户级服务列表中启用 `nengong_feishu`。设置页真实显示 server command 与合同规定的 10 个工具，证明配置层和工具发现层均已加载；这与 QoderWork CN、Qoder CLI CN 的加载面相互独立。

新建 Qoder 智能体会话后，工具 schema 读取成功。`feishu_setup({verify_auth:true})` 返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；随后 `feishu_doc_read(detail=with-ids, doc_format=xml, scope=full, identity=user)` 回读专用测试文档，标题、PNG 图片块和 caption 三项全部命中。

本次只读复验未提供 Qoder CN Desktop 的实际版本号，因此不把该结果静默扩展到其他版本或操作系统。测试没有发起授权、调用旧 `lark-mcp` 或执行任何文档写入。由此 Qoder CN Desktop 的当前 macOS MCP 加载面完成独立实机验证。

## OpenCode Desktop 实机连接

OpenCode Desktop `1.18.9` 使用用户级 `~/.config/opencode/opencode.json`。本次只把生成器输出的 `mcp.nengong_feishu` 合并进现有配置，保留原有模型、provider 和用户设置，并固定使用不含空格的 Node 绝对路径与用户已授权的 `lark-cli 1.0.81`。配置符合 OpenCode 的本地 MCP 结构：`type=local`、数组形式 `command`、`environment` 环境变量和 `enabled=true`。

完全退出并重新打开 OpenCode 后，新会话真实发现并调用 `nengong_feishu` 的 `feishu_setup` 与 `feishu_doc_read`。首次索引返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；专用测试文档回读确认预期标题、PNG 图片块和 caption 全部存在。

测试只读，没有发起授权、调用旧 `lark-mcp` 或执行任何文档写入。公开报告不保存测试文档 URL、document ID、block ID 或资源 token。由此 OpenCode Desktop `1.18.9` 完成当前独立 MCP 的实机只读复验。

## Hermes Agent 实机连接

Hermes Agent `0.19.0` 使用用户级 `~/.hermes/config.yaml`。本次先备份原配置，再通过官方 `hermes mcp add` 注册 stdio server，固定不含空格的 Node 路径与用户已授权的 `lark-cli 1.0.81`，并在交互提示中启用全部 10 个合同工具。配置比对确认除新增 `nengong_feishu` 外，模型、路由和其他 4 个 MCP 均未变化。

`hermes mcp test nengong_feishu` 在约 203ms 内连接成功并发现 10 个工具。随后启动全新 one-shot 会话，Hermes 的工具搜索真实命中新服务器，实际调用 `feishu_setup({verify_auth:true})` 返回 CLI `1.0.81`、`stage=ready`、`ready=true`、`identity=user`；`feishu_doc_read` 的原始结果包含预期标题、PNG 图片块和 caption。

当前默认模型 `poolside/laguna-s-2.1:free` 在最终摘要中把“飞书”转述成“飞手”，但导出的会话工具记录确认 MCP 原始结果为正确的“飞书”，其他结构化断言也全部匹配。这记录为模型中文转述风险，不是 MCP 连接或数据错误。测试全程只读，没有发起授权、调用旧 `lark-mcp` 或执行文档写入；公开报告不保存测试 URL、document ID、block ID、资源 token 或下载授权码。

## 多维表格记录实机回归

在用户明确提供并授权的专用多维表格上，使用官方 `lark-cli 1.0.81`，通过真实 stdio MCP 进程完成一条最小读写链路：

1. 只读解析多维表格 URL，并用 `base +field-list` 确认存在可写文本字段；未把表格 URL、base token、table ID、字段名或记录 ID 写入公开报告。
2. 调用 `feishu_bitable_record(operation=list)` 读取现状，成功。
3. 调用 `feishu_bitable_record(operation=upsert, confirm_write=true)` 新增一条带时间标记的测试记录，成功；没有删除或覆盖已有记录。
4. 再次调用 `operation=list`，用精确过滤条件回读该标记，成功命中。

MCP 握手时发现当前合同的 11 个工具。写入回执本身不回显字段值，最终以过滤回读命中作为验收依据。该结果证明当前 server 的 Base 记录 `read → create → read-back` 链路可用；不把它扩大为批量写入、删除或字段建模。客户端只需重新加载并发现这个标准 MCP 工具，通常不需要逐个重复真实写入测试。

## 敏感信息与打包检查

- 当前工作树 secret pattern 扫描：无命中。
- Git 历史 secret pattern 扫描：无命中。
- 跟踪的 `.env` 文件：无。
- 当前树不包含本机用户绝对路径或专用测试租户；早期本地开发历史曾记录用户路径，公开仓库应从当前树创建干净初始提交，不能原样推送这段历史。
- `npm pack --dry-run` 只包含 7 个必要文件：许可证、第三方声明、package metadata、入口与 3 个源码文件；不包含 `node_modules`、测试夹具、用户配置或密钥。
- 真实生成 `.tgz` 后，在全新临时 npm 项目安装成功；安装后的 server 通过语法检查并完成 MCP initialize，返回 `nengong-feishu-mcp 0.1.0`。
- 已增加 Node.js 20/22 × Ubuntu/macOS/Windows 的 GitHub Actions 配置。当前未创建远端，因此三系统 CI 尚未实际执行。

## 未执行

- 未执行破坏性较强的 `overwrite`、`block_delete` 或文档删除操作。
- 未启动真实 Device Flow。
- 仅通过 Claude Code 官方 CLI 写入项目作用域的本地 MCP 注册；未手写客户端配置。
- 当前专用适配名单均已完成实机连接、setup 和文档回读。

后续真实写入仍需限定到用户明确提供和授权的测试文档或文件夹。
