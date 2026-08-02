# MCP 稳定契约

本文定义 `nengong-feishu-mcp` 与文档 formatter、表格型 Agent 工作流之间的稳定边界。当前契约版本为 `1.0`。

## 设计边界

- MCP 只暴露 formatter 和受控表格工作流确实依赖的稳定飞书能力，不暴露任意 shell 或任意 OpenAPI 执行器。
- 底层调用官方 `@larksuite/cli` 的 stdio 子进程；MCP 自身不保存 app secret、access token 或用户文档。
- 工具名、输入字段和返回信封构成稳定接口；底层 CLI 参数属于实现细节。
- 所有子进程通过 argv 数组启动，禁止 shell 拼接。
- 所有真实写入都需要 `confirm_write=true`。`dry_run=true` 可在未确认时预览。

## 通用返回值

成功：

```json
{
  "ok": true,
  "identity": "user",
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "type": "validation",
    "message": "..."
  }
}
```

MCP 同时把 `ok != true` 标记为 `isError=true`。调用方判断成功必须看 `ok === true`，不能假设存在顶层 `code`。

## 首次使用索引：`feishu_setup`

Agent 第一次连接 MCP 时应先调用 `feishu_setup`，不要直接尝试业务工具。它不自动安装软件、创建飞书应用或发起授权，只返回当前阶段和下一步：

| `stage` | 含义 | 下一步 |
|---|---|---|
| `cli_missing` | 没找到飞书官方 `lark-cli` | 执行 `npx @larksuite/cli@latest install`，然后重试 |
| `cli_check_failed` | CLI 路径存在但无法运行 | 检查 `LARK_CLI` 或重新安装官方 CLI |
| `config_required` | CLI 已安装，但飞书应用配置未就绪 | 由用户配合执行 `lark-cli config init --new` |
| `auth_unverified` | 本地安装和配置正常，但按请求跳过联网验证 | 调用 `feishu_auth_status` |
| `auth_required` | 没有可用的 user 授权 | 调用 `feishu_auth_start`，完成后调用 `feishu_auth_complete` |
| `ready` | CLI、应用配置和 user 授权均正常 | 开放文档业务工具 |

`feishu_setup` 返回的是成功的引导结果，因此即使 `ready=false`，顶层仍为 `ok=true`。调用方应读取 `data.ready` 和 `data.stage`。只有索引工具自身发生内部错误时才返回 `ok=false`。

安装来源固定为飞书官方仓库 <https://github.com/larksuite/cli>。MCP 不得在用户未确认时自行执行安装命令或 `config init`。

## 文档读取：`feishu_doc_read`

必填字段：`doc`，接受 Docx/Wiki URL 或 token。默认值：

- `identity=user`
- `detail=simple`
- `doc_format=xml`
- `scope=full`

formatter 只需要阅读正文时用 `simple`。需要按 block 修改时，优先用 `scope=outline|keyword|section|range` 配合 `detail=with-ids` 局部读取。只有保真恢复样式时才使用 `full`。

契约保证：返回官方 CLI 的结构化文档结果，不自行把 Wiki 重建成普通文档，也不丢弃 `reference_map`。

## 创建副本：`feishu_doc_copy`

必填字段：

- `source_token`
- `folder_token`
- `name`

默认 `file_type=docx`、`identity=user`。实现必须调用 Drive 的 `files.copy`，不能用“读取正文再新建文档”代替，因为后者会丢失评论、资源块、历史和部分结构。

对应官方 schema：`drive.files.copy`。常见所需权限为 `drive:drive` 或 `docs:document:copy`，实际以当前 CLI schema 和飞书错误中的 `missing_scopes` 为准。

## 块级更新：`feishu_doc_update`

支持的 `operation`：

| 操作 | 必需字段 | 用途 |
|---|---|---|
| `str_replace` | `pattern`, `content` | 文本替换；XML 模式只适合行内匹配 |
| `block_insert_after` | `block_id`, `content` | 在目标块后插入 |
| `block_copy_insert_after` | `block_id`, `src_block_ids` | 复制块后插入 |
| `block_replace` | `block_id`, `content` | 替换单个块 |
| `block_delete` | `block_id` | 删除一个或多个块 |
| `block_move_after` | `block_id`, `src_block_ids` | 移动已有块 |
| `append` | `content` | 文末追加 |
| `overwrite` | `content` | 全文覆盖，可能丢失不可重建内容 |

默认 `doc_format=xml`。用户明确给出 Markdown，或整段导入时才使用 `markdown`。

Block ID 生命周期属于契约的一部分：

- `overwrite`、`block_replace`、`block_delete` 后，受影响的旧 ID 不得继续复用。
- 插入、复制后，新内容需要重新读取才能获得新 ID。
- 移动后若后续逻辑依赖位置，也要重新读取。
- formatter 应优先局部更新，避免无必要的 `overwrite`。

## 图片上传插入：`feishu_doc_media_insert`

必填字段：`doc`、`file`。`file` 必须是 `FEISHU_MCP_WORKDIR` 内的相对路径；绝对路径和 `..` 目录穿越会被拒绝。

默认 `media_type=image`，可选 `align`、`caption`、`width`、`height` 和文本定位字段。该工具把创建资源块、上传文件、绑定 token 作为一个事务式上游操作；失败时以上游 CLI 的回滚语义为准。

本阶段不支持剪贴板输入。MCP 常驻进程通常与用户 GUI 会话隔离，显式文件路径更容易审计。

## 多维表格记录：`feishu_bitable_record`

这是一个有意收窄的记录工具，不是通用 Base/OpenAPI 执行器。它只支持两种操作：

| `operation` | 作用 | 写入？ |
|---|---|---|
| `list` | 列出表格记录，可按视图、字段投影、过滤和排序读取 | 否 |
| `upsert` | 不填 `record_id` 时新增一条记录；填写时更新指定记录 | 是 |

定位表格可以二选一：

- `base_url`：多维表格、Wiki 或记录分享 URL；MCP 通过官方 `base +url-resolve` 解析 base/table/view。
- `base_token` + `table_id`：已知坐标时跳过 URL 解析。

`upsert` 的 `fields` 必须是顶层字段映射，不包裹额外的 `fields` 层。MCP 只负责把字段值交给官方 CLI；字段名、字段类型和可写性必须先由调用方通过表格字段结构确认。当前不暴露删除、批量写入、字段建模、附件上传或任意 API 调用。

真实 `upsert` 必须传 `confirm_write=true`；未确认时不会启动 CLI。`dry_run=true` 可预览请求。默认身份为 `user`，`bot` 只有在应用与目标表同时授予相应 bot 权限时才可用。

多维表格权限不等同于文档权限。`feishu_setup` 只验证 CLI、应用配置和 user 鉴权，不保证某个 Base 可访问；实际调用还需要应用和用户拥有记录读取/创建/更新 scope（常见为 `base:record:read`、`base:record:create`、`base:record:update`，具体以当前 CLI 错误和官方 scope 为准），以及目标表本身的访问权。缺 scope 或 ACL 时，应把错误中的最小缺口反馈给用户，再由用户决定是否重新授权，不要默认申请全量权限。

## 鉴权

### `feishu_auth_status`

调用 `auth status --verify`，用于检查当前用户、token 有效性和 scope。工具不读取、不打印 app secret 或 access token。

### `feishu_auth_start`

必须至少提供一个 `domains` 或 `scopes` 条目。工具用 `--no-wait` 启动 Device Flow，并返回本次授权的 URL 与临时 `device_code`。

调用方必须：

1. 原样展示 verification URL，不改写、不拼接。
2. 等用户在浏览器明确完成授权后，再调用 `feishu_auth_complete`。
3. 不把 URL 或 `device_code` 写入日志、仓库、长期记忆或配置文件。

### `feishu_auth_complete`

只接收本次流程生成的临时 `device_code`。它不是长期凭证，用后即弃。

文档和多维表格记录默认用 user 身份。bot 身份看不到用户个人云空间，缺 bot scope 时应让用户在飞书开放平台开通，不能对 bot 运行用户登录流程。

## Doctor 与 Schema

### `feishu_doctor`

检查 CLI、本地配置、鉴权和网络。`offline=true` 只检查本地状态，适合安装验证和 CI；它不证明真实飞书权限可用。

### `feishu_schema`

读取官方 CLI 当前版本的 raw OpenAPI 方法 schema。`path` 必须是 `service.resource.method` 形式，例如 `drive.files.copy`。formatter 不应把 schema 返回值直接当作稳定业务接口；它只用于诊断参数、权限和版本漂移。

## 版本与兼容策略

- `1.x` 内不删除工具，不重命名已有字段，不改变默认写入门禁。
- 新增可选字段属于向后兼容。
- 删除工具、收紧已有合法输入或改变返回信封必须升主版本。
- 官方 CLI 升级后，先跑 mock/协议测试，再用 `feishu_schema` 对关键 raw 方法做漂移检查。
- 真实写入回归必须使用专用测试文档，并由用户在当次任务中明确授权。
