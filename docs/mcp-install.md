# MCP 安装与客户端接入

本项目只提供本地 stdio MCP。客户端直接启动本仓库的 `mcp-server/server.js`，不需要 `coding-agent-hub`、私有 manifest 或共享分发脚本。

## 前置条件

1. Node.js 20 或更高版本。
2. 安装飞书官方 CLI：

   ```bash
   npx @larksuite/cli@latest install
   ```

3. 安装 MCP 依赖：

   ```bash
   cd /absolute/path/to/nengong-feishu/mcp-server
   npm ci
   ```

4. 先做离线检查：

   ```bash
   lark-cli doctor --offline
   ```

不要把 `appSecret`、access token 或生产文档内容写入 MCP 配置。官方 CLI 自己管理飞书配置和凭证。

## 生成纯净配置

配置生成器只打印片段，不修改客户端文件：

```bash
node installers/render-config.mjs \
  --client codex \
  --server /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --workdir /absolute/path/to/allowed-media-directory
```

支持的 `--client`：

- `codex`
- `claude-code`
- `claude-desktop`
- `workbuddy`
- `qoder`
- `trae`（Trae IDE 与 TRAE Work CN 共用生成器，配置入口独立）
- `kimi`
- `kimi-cli`
- `opencode`
- `hermes`
- `zcode`
- `generic`

`FEISHU_MCP_WORKDIR` 是媒体上传允许读取的根目录。配置中只放路径，不放飞书密钥。

某些桌面 Agent 会把自己的 CLI 目录放在 `PATH` 前面。若它们内置了另一份未授权的 `lark-cli`，生成配置时显式指定用户已完成授权的官方 CLI：

```bash
node installers/render-config.mjs \
  --client kimi \
  --server /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --workdir /absolute/path/to/allowed-media-directory \
  --lark-cli /absolute/path/to/lark-cli
```

`--lark-cli` 只写入本地可执行文件路径，不复制凭证，也不把 token 写入 MCP 配置。

## 其他 MCP Agent 通用接入口

不在专用适配名单中的客户端，不需要等待本项目增加名字。先生成标准 stdio JSON：

```bash
node installers/render-config.mjs \
  --client generic \
  --server /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --workdir /absolute/path/to/allowed-media-directory
```

把输出连同下面这段话交给当前 Agent：

```text
请把这份标准 stdio MCP 配置合并到你当前客户端的 MCP 设置中。
保留已有 MCP，不要覆盖其他配置，不要把任何 API Key 写入配置。
完成后启动 nengong_feishu，调用 feishu_setup；只有 data.ready=true 才继续使用业务工具。使用多维表格时，还要确认 Base 记录 scope 和目标表 ACL。
如果你的配置字段不是 mcpServers，请只转换客户端外层结构，不要修改 command、args 或 env。
```

这条通用入口表示“遵循标准 MCP 可自行接入”，不表示该客户端已经完成本项目的实机兼容认证。

## 各客户端放置方式

### Codex

生成 TOML 后放入用户级 `~/.codex/config.toml` 或受信任项目的 `.codex/config.toml`。若用户已有配置，只合并 `[mcp_servers.nengong_feishu]` 及其 `.env`，不要覆盖模型、认证或其他 MCP。建议显式传入 `--node` 与已授权的 `--lark-cli`；Codex Desktop 已在 macOS 完成实机只读复验。官方配置参考：<https://developers.openai.com/codex/config-reference/#mcp_servers>。

### Claude Code

可直接用 CLI 添加：

```bash
claude mcp add nengong_feishu -- \
  node /absolute/path/to/nengong-feishu/mcp-server/server.js
```

若需要设置 `FEISHU_MCP_WORKDIR`，使用生成器输出的 JSON，按项目级 `.mcp.json` 或用户级配置导入。官方说明：<https://code.claude.com/docs/en/mcp>。

### Claude Desktop

使用 `--client claude-desktop` 生成标准 `mcpServers` JSON，只把 `nengong_feishu` 合并进当前 Desktop 的配置，不要覆盖原有偏好或路由设置。macOS 官方账号模式通常使用：

```text
~/Library/Application Support/Claude/claude_desktop_config.json
```

第三方路由模式可能使用独立数据目录。本次实测的 `deploymentMode=3p` 使用：

```text
~/Library/Application Support/Claude-3p/claude_desktop_config.json
```

应以当前 Claude Desktop 进程的 `--user-data-dir` 和客户端开发者设置为准。合并前先备份，建议显式传入 `--node` 与 `--lark-cli`；修改后完全退出并重新打开 Claude Desktop，在新任务中确认工具真实存在。Claude Desktop `1.24012.9` 的 `3p / Cowork` 会话已在 macOS 完成实机只读复验。

### WorkBuddy Desktop

WorkBuddy Desktop 与它内置的 CodeBuddy CLI 是两个独立的 MCP 加载面。`codebuddy mcp add` 写入的用户配置可供 CLI 使用，但 WorkBuddy Desktop `5.3.8` 启动会话时使用 `--strict-mcp-config`，不会自动把这份 CLI 配置合并进 Desktop 工具集。因此，CLI 返回 `Connected` 不等于 WorkBuddy Desktop 已完成接入。

WorkBuddy Desktop 应优先从客户端自己的“插件/连接器 → MCP 服务器 → 配置 MCP”入口导入 `--client workbuddy` 生成的标准 JSON，并在界面里显式启用。不要把手写 `~/.workbuddy/.mcp.json`、`~/.workbuddy/mcp.json` 或 `~/.codebuddy/.mcp.json` 视为 Desktop 接入成功；最终以 Desktop 界面状态和新会话工具集为准。

### CodeBuddy CLI

WorkBuddy Desktop 与 CodeBuddy CLI 是两个独立的 MCP 加载面。若只需要给 CodeBuddy CLI 接入，且终端已经能找到 `codebuddy`（别名也可能是 `cbc`），可执行：

```bash
codebuddy mcp add nengong_feishu --scope user \
  --env FEISHU_MCP_WORKDIR=/absolute/path/to/allowed-media-directory \
        LARK_CLI=/absolute/path/to/lark-cli \
  -- /absolute/path/to/node \
     /absolute/path/to/nengong-feishu/mcp-server/server.js
```

注意服务器名必须放在 `--env` 之前；`--env` 会连续读取后面的 `KEY=value` 参数。注册后检查：

```bash
codebuddy mcp list
codebuddy mcp get nengong_feishu
```

CodeBuddy CLI `2.132.0` 已在 macOS 完成独立实机只读复验：当前会话真实发现 `feishu_setup` 与 `feishu_doc_read`，setup 返回 `ready`，测试文档回读三项断言全部通过。该结果与 WorkBuddy Desktop 的验证相互独立。

### Qoder CN Desktop

`--client qoder` 输出标准 `mcpServers` JSON。Qoder CN Desktop、QoderWork CN 与 Qoder CLI CN 是三个独立加载面；桌面产品应通过当前客户端的图形界面导入，不要直接编辑 SQLite 或猜测内部配置文件。

Qoder CN Desktop（Qoder IDE）：打开“Qoder 设置 → MCP 服务 → 我的服务 → 添加”，粘贴生成的 JSON，保存并启用后，以连接图标和展开后的工具列表为准。此前 macOS 文档回归显示 10 个文档工具；当前 server 更新后应重新发现合同规定的 11 个工具。新建智能体会话后，`feishu_setup` 和 `feishu_doc_read` 的只读复验通过。此次复验输出未提供客户端版本号，因此不扩大到其他版本或操作系统。官方说明：<https://docs.qoder.com/user-guide/chat/model-context-protocol>。

### QoderWork CN

打开“Settings → Connectors & MCP”，手动添加自定义 MCP Server，粘贴同一份 JSON，并显式启用该集成。QoderWork 的集成默认处于未启用状态；仅把配置写进 `~/.qoderworkcn/mcp.json` 不等同于已在 QoderWork 连接器层注册。官方说明：<https://docs.qoder.com/qoderwork/connectors>。

导入时建议显式传入用户已授权的 CLI：

```bash
node installers/render-config.mjs \
  --client qoder \
  --server /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --workdir /absolute/path/to/allowed-media-directory \
  --lark-cli /absolute/path/to/lark-cli
```

只有对应客户端设置页显示连接成功、工具列表真实出现，并且当前会话能调用 `feishu_setup`，才算完成接入。提示词中写出工具名称后模型尝试调用、但运行时返回 `Tool not found`，应视为未注册，不能算工具发现成功。

### Qoder CLI CN

Qoder CLI CN 是 QoderWork CN 和 Qoder IDE 之外的独立加载面。先登录 Qoder CLI，再在项目目录注册本地 MCP：

```bash
qoderclicn mcp add \
  --scope local \
  --transport stdio \
  nengong_feishu \
  /absolute/path/to/node \
  /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --env \
  FEISHU_MCP_WORKDIR=/absolute/path/to/allowed-media-directory \
  LARK_CLI=/absolute/path/to/lark-cli
```

`--scope local` 会写入当前项目的 Qoder 设置。启动会话时必须使用项目目录，例如：

```bash
qoderclicn -w /absolute/path/to/nengong-feishu
```

如果从 `~` 启动，项目级 `.qoder/settings.local.json` 不会加载，Connected 配置也不会出现在当前会话工具集。Qoder CLI CN `1.1.11` 已在 macOS 完成 setup 和文档只读回读实机验证；Qoder CN Desktop、QoderWork CN 与 Qoder CLI 仍是相互独立的加载面。

### Trae IDE

`--client trae` 输出 Trae IDE 与 TRAE Work CN 都能使用的标准 `mcpServers` JSON，但两个客户端的配置相互独立。不要把旧版 Trae IDE 的 `~/.trae-cn/mcp.json` 当作 TRAE Work 的全局配置。

Trae IDE：打开项目后，在 Agent 面板的设置中进入“MCP”，打开“启用项目级 MCP”，再通过“添加 → 手动添加”导入生成的 JSON；也可以让客户端从项目根目录的 `.trae/mcp.json` 加载。此前文档回归使用 10 个工具；当前 server 更新后应看到 11 个工具，再在新的 Agent 会话中调用 `feishu_setup` 与 `feishu_doc_read`。当前 macOS 会话已完成只读复验；客户端版本未确认，模型名称不能当作客户端版本。官方说明：<https://docs.trae.ai/ide/add-mcp-servers>。

### TRAE Work CN（原 TRAE SOLO CN）

TRAE Work CN（旧版客户端目录仍可能使用 `TRAE SOLO CN`）在 macOS 的全局配置位置为：

```text
~/Library/Application Support/TRAE SOLO CN/User/mcp.json
```

项目级配置放在当前项目根目录：

```text
.trae/mcp.json
```

优先在 TRAE Work 的“设置 → MCP”导入生成的 JSON，由客户端写入正确位置。导入后确认服务器已启用，并使用本地 CODE 模式的新会话验证；云端任务或部分 Work 模式可能不会把自定义 MCP 工具注入模型工具集。配置显示已连接但模型仍看不到工具时，应报告客户端模式限制，不能用独立启动 server 的结果冒充客户端调用成功。TRAE 官方已将 TRAE SOLO 更名为 TRAE Work，参见 <https://www.trae.ai/blog/trae_work_0609>。

历史客户端 `TRAE SOLO CN 3.3.83` 会错误拆分 `command` 中带空格的可执行文件路径。例如内置 Node 位于 `Application Support` 下时，会只尝试启动空格前的片段并返回 `ENOENT`。此时用 `--node` 显式指定一个不含空格的 Node 绝对路径：

```bash
node installers/render-config.mjs \
  --client trae \
  --server /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --workdir /absolute/path/to/allowed-media-directory \
  --node /absolute/path/without-spaces/node \
  --lark-cli /absolute/path/to/lark-cli
```

保存后检查 SOLO 的 `mcp-servers-host.log` 或设置页：必须能看到 server ready、11 个工具以及 `Connected`，才进入会话调用测试。

### Kimi Desktop

`--client kimi` 输出 Kimi Desktop 使用的 `mcp.servers` 嵌套结构。把 `nengong_feishu` 合并到用户配置中的 `mcp.servers`，不要覆盖其他服务器。macOS 当前持久配置位置为：

```text
~/Library/Application Support/kimi-desktop/daimon-share/daimon/config.json
```

修改后完全退出并重新打开 Kimi。该位置可能随客户端版本变化；优先使用当前 GUI 的 MCP 导入入口。

Kimi Desktop 自带的 `lark-cli` 可能早于用户安装的版本，并使用不同的授权状态。若 `feishu_setup` 在其他 Agent 返回 `ready`、只在 Kimi 返回 `auth_required`，不要重复授权内置 CLI；用 `--lark-cli` 指向普通终端中 `command -v lark-cli` 返回的用户 CLI，再重启 Kimi。

### Kimi Code CLI（新版）

Kimi Code `0.31.x` 使用 `mcp.json` 管理 MCP，不要把旧版 `kimi mcp add` 命令与新版混用。配置有两个常用层级：

- 用户级：`~/.kimi-code/mcp.json`，所有项目共享。
- 项目级：当前工作目录下的 `.kimi-code/mcp.json`，只对该仓库生效。

本项目测试建议使用项目级配置，避免影响 Kimi Code 的其他项目：

1. 进入项目目录并启动 `kimi`。
2. 在 TUI 中输入 `/mcp-config`，选择项目级（project-local）范围。
3. 导入 `--client kimi-cli` 生成的 `mcpServers` JSON，保留已有服务器。
4. 输入 `/reload`，或退出后重新启动一个新会话。
5. 用 `/mcp` 确认 `nengong_feishu` 已连接并发现 11 个工具。

生成配置片段：

```bash
node installers/render-config.mjs \
  --client kimi-cli \
  --server /absolute/path/to/nengong-feishu/mcp-server/server.js \
  --workdir /absolute/path/to/allowed-media-directory \
  --node /absolute/path/to/node \
  --lark-cli /absolute/path/to/lark-cli
```

新版官方说明：<https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html>。旧版 Kimi CLI 的 `kimi mcp add` 文档不适用于本安装包。

Kimi Code CLI `0.31.1` 的历史文档回归在 macOS 完成实机只读复验，项目级 `.kimi-code/mcp.json` 当时显示 10 个工具；当前 server 更新后应重新加载并确认 11 个工具。`feishu_setup` 与 `feishu_doc_read` 均通过。该结果不代表 Kimi Desktop 或旧版 Kimi CLI 的加载面。

### OpenCode

把生成的 `mcp` 对象合并进 `~/.config/opencode/opencode.json`，保留原有模型、provider 和其他用户设置。本地服务器使用 `type=local`，`command` 是数组，环境变量键为 `environment`。官方说明：<https://opencode.ai/docs/mcp-servers/>。

OpenCode Desktop `1.18.9` 已在 macOS 完成实机只读复验。GUI 进程可能不会热加载新增 MCP；修改配置后应完全退出并重新打开，再在新会话确认工具真实存在。建议同时传入 `--node` 和 `--lark-cli` 的无空格绝对路径，避免 GUI PATH 与用户终端不一致。

### Hermes

把生成的 `mcp_servers` YAML 合并进 `~/.hermes/config.yaml`，或使用 Hermes 自带的 `hermes mcp add` 交互命令。建议显式传入 `--node` 和 `--lark-cli`；发现工具后选择启用全部 11 个工具，再启动新会话。可用 `hermes mcp test nengong_feishu` 做独立连接检查。

该 MCP 的文档更新工具存在顺序依赖，所以生成配置显式设置 `supports_parallel_tool_calls=false`；Hermes 未设置时也默认不并行。Hermes Agent `0.19.0` 已在 macOS 完成 setup 和文档回读实机验证。官方说明：<https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference>。

### ZCode

`--client zcode` 输出 ZCode 的 `mcp.servers` 嵌套 JSON，包含 `type=stdio`、`timeoutMs` 和 `enabled`。把 `nengong_feishu` 合并进：

```text
~/.zcode/cli/config.json
```

不要覆盖该文件中的模型设置、其他 MCP 或用户偏好。本项目只生成可审计片段，不直接修改 ZCode 配置。

## 首次授权

连接 MCP 后：

1. 首先调用 `feishu_setup()`。不要直接猜测用户缺 CLI、缺配置还是缺授权。
2. 返回 `cli_missing` 时，展示官方安装命令，等用户安装后重新检查。
3. 返回 `config_required` 时，让用户配合完成 `lark-cli config init --new`，不要静默创建应用。
4. 返回 `auth_required` 时，用 `feishu_auth_start` 指定最小 `domains` 或 `scopes`。
5. 用户在浏览器完成授权后，再调用 `feishu_auth_complete`。
6. 再次调用 `feishu_setup()`；只有 `data.ready=true` 才进入文档操作。

不要一次索取 `all` 权限。文档 formatter 通常从 `docs`、`drive` 两个业务域开始即可，最终以实际操作返回的 `missing_scopes` 为准。

如果要使用 `feishu_bitable_record`，先用 `operation=list` 做一次目标表读取。文档 setup 就绪不代表 Base 已授权；若返回缺少记录 scope，只针对错误中列出的最小 `base:record:read`、`base:record:create` 或 `base:record:update` 范围重新授权，并确认用户对目标表有访问权。不要因为启用多维表格就申请全量 Base 管理权限。
