# 排版执行器契约

此 Skill 不要求某一种 MCP 或 CLI。接入层只需实现下面的可观察语义；参数名、鉴权方式和返回包装可以不同。

## 必需操作

| 能力 | 最小输入 | 成功证据 | 排版器要求 |
| --- | --- | --- | --- |
| `probe` | 无，或最小认证信息 | `unavailable` / `needs_auth` / `connected` 与可用能力 | 只读检查适配器和身份；不能用测试写入探测权限 |
| `inspect` | URL 或 token | canonical type、token、标题 | Wiki 必须返回底层对象 |
| `copy` | 源 token、目标目录、名称、类型 | 新 token/URL | 必须复制在线对象，不能导出再导入 |
| `fetch_full` | 副本 token | 内容、块 ID、属性、reference sidecar、revision | 用于账本、写前与验收 |
| `fetch_range` | token、块范围 | 同一结构的局部内容与 revision | 用于每批写后复读 |
| `mutate_blocks` | token、revision、块操作 | `success` / `partial_success` / `failed`、影响数量、warning、新块 ID、revision | 每次只做一个可验收批次 |
| `list_or_preview_media` | token 或媒体 ID | 媒体类型、token、可读产物 | 不改变源文档 |
| `insert_media_at_anchor` | token、锚点、文件/资源、布局 | 新媒体 block ID/token、revision | 仅支持末尾插入时不得声称定位插入 |
| `list_history` / `revert_history` | token、历史 ID | 候选版本/异步状态 | 仅用户确认后用于恢复 |

`probe` 只能说明环境层状态。拿到目标 URL 后，调用方还必须单独检查该文档的读取、复制和块级写入权限，并对外报告 `read_only` 或 `ready`；不要从“认证成功”推断“目标可写”。

## 保真数据模型

`fetch_full` 结果至少能表达以下对象，或显式标记为不可编辑：文本块、标题、列表、表格、链接、图片、附件、画板、@人、任务、评论锚点、嵌入资源、公式、`pre`（含正文、`lang`、caption、相邻块）和未知块。若正文引用使用临时标识，返回同一 revision 的 `reference_map` sidecar，回放时必须成对传递。

调用方必须先基于完整文档判定代码主导、非代码或混合语境，再结合 `pre` 的相邻块和块内语义分类为代码、等宽文字、Markdown 导入残留、ASCII 示意或未知内容。真实代码、配置、命令和终端输出不可转换；非代码语境不能单独覆盖这条规则。执行器必须支持把有完整映射证据的 Markdown 残留或 ASCII 网格安全转成原生标题、列表、引用、表格或结构：先插入新结构、读取并逐项核验语义映射，再删除旧 `pre`。对可读出固定画布、区块、比例和嵌套关系的 ASCII 版面线框，`mutate_blocks` 还必须能插入原生版面规格表，至少写入区块路径、占比/尺寸、位置关系和元素，再删除旧 `pre`；像素级复刻不是保留该块的理由。若要清除空 caption，必须能在不改变 `pre` 正文的前提下局部更新；没有这项能力时保留并报告。对 ASCII 示意新增视觉表达时，`insert_media_at_anchor` 必须返回靠近源块的锚点证据。

## 并发与恢复语义

- `mutate_blocks` 接受基准 revision；冲突、部分成功和 warning 必须可区分。
- 影响或替换某个 block 后，旧 block ID 视为失效，直到新的读取证明仍可用。
- 成功写入本身不是验收；后续 `fetch_range` 或 `fetch_full` 才是验收证据。
- 历史回滚是显式、高风险操作。接入层必须能返回候选历史记录和最终异步状态，不得替调用方静默选择或执行。

## 降级响应

| 缺失能力 | 允许结果 |
| --- | --- |
| 没有 `copy` | 说明风险，等待用户授权改原文；否则只读方案 |
| 没有块级写入 | 结构化排版方案或可审阅 XML/Markdown，不写回 |
| 没有锚点媒体插入 | 原生层排版，标记视觉层待人工插入 |
| 没有写后读取 | 不可报告“已排版完成” |
