# Formatter 与飞书执行层的集成说明

本文件随 `feishu-doc-formatter` Skill 分发，只记录 Skill 需要的既有能力与行为，不修改或复制任何 MCP 实现。

## 已核对的 lark-cli 映射

| Formatter 契约 | 已有能力 | 关键语义 |
| --- | --- | --- |
| 识别对象 | `drive +inspect` | Wiki URL 会解包到底层 type/token；识别失败后不得继续尝试写入。 |
| 创建副本 | `drive files copy` | 先以 schema 确认参数；`file_token` 为源，`folder_token`/`name`/`type` 为副本信息。禁止用导出再导入或 fetch+create 重建。 |
| 保真读取 | `docs +fetch --detail full` | 编辑前读取应包含 block ID、样式属性、引用元数据和 revision；局部核验用 `section` 或 `range`。 |
| 局部更新 | `docs +update` | 优先 `block_insert_after`、`block_replace`、`block_move_after`、`block_copy_insert_after`；`overwrite` 会清空文档并可能丢失资源。 |
| 媒体读取 | `docs +media-preview` / `+media-download` | 普通媒体由 `<img>`/`<source>` token 标识；画板只能使用 `+media-download --type whiteboard`。 |
| 媒体写入 | `docs +media-insert` 或 XML `<img>` | `+media-insert` 是文末插入；需要章节定位时必须选块级锚点能力，不能假装其能定位。 |
| 恢复 | `docs +history-list` / `+history-revert` / `+history-revert-status` | 先根据时间/revision 选择具体 `history_version_id`；回滚后重新 fetch 验证。 |

## 首次使用的只读检查

1. 先确认适配器是否存在；lark-cli 可用时，用 `auth status --verify` 检查认证状态，不执行任何写操作。
2. 工具可用不代表目标可访问。收到文档 URL 后，用 `drive +inspect` 识别底层对象，再以读取接口验证目标是否可读。
3. 只有在用户已明确要写回，且副本创建、块级更新和写后读取均可用时，才报告 `ready`。否则报告 `unavailable`、`needs_auth`、`needs_scope` 或 `read_only` 并按 Skill 降级。
4. 不用“写一个测试块再删除”的方式检查写权限；那会制造不可恢复的真实改动。

## 必须对齐的返回契约

1. 成功以 `ok: true` 或进程退出码 0 判断，不能以不存在的顶层 `code: 0` 判断。
2. 更新结果必须暴露 `result`（至少可区分 success、partial_success、failed）、实际更新数量、warning、新块 ID 和 revision。
3. `overwrite`、`block_replace`、`block_delete` 后，调用方必须重新读取，不能继续复用受影响旧 block ID。
4. 包含临时引用的读取和写回必须携带同一份 `reference_map` sidecar。
5. 文件路径参数应允许执行器采用安全的相对路径或 stdin；Skill 不应假设绝对路径可用。

## 身份、授权与写入边界

- 用户文档通常需要 user 身份；bot 不能代替用户访问其私人 Drive 资源。
- 缺少 user scope 时只发起最小范围授权；bot 缺 scope 时应引导在开发者后台开通，不能对 bot 走用户登录。
- 返回 `confirmation_required`、高风险历史回滚或无法创建副本时，停止并向用户请求明确确认。
- 真实写入前，调用方要让用户知道源文档、副本目标与拟做的操作；测试优先 mock、dry-run 或专用测试文档。

## 尚需主任务对齐的缺口

1. 将上述能力做成稳定、可版本化的 MCP 契约，而非让 Skill 依赖内部 CLI 参数。
2. 明确“指定锚点上传媒体”的原子接口或事务边界；仅有文末上传不足以支撑可靠的章节视觉排版。
3. 返回统一的内容账本字段（媒体/附件/特殊块 token、引用 sidecar、revision）以及可机器判断的部分成功结果。
4. 给写入批次提供 revision 冲突语义和可查询的异步回滚状态。
