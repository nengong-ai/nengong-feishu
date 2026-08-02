export const CONTRACT_VERSION = "1.0";

const identity = {
  type: "string",
  enum: ["user", "bot"],
  default: "user",
  description: "飞书调用身份；文档和云空间操作通常使用 user。",
};

const confirmWrite = {
  type: "boolean",
  description: "真实写入必须显式为 true；dry_run=true 时可省略。",
};

const dryRun = {
  type: "boolean",
  default: false,
  description: "只预览请求，不修改飞书数据。",
};

export const TOOL_DEFINITIONS = [
  {
    name: "feishu_setup",
    description: "首次使用索引：检查飞书官方 lark-cli、应用配置和用户授权，返回当前阶段与明确下一步。不会自动安装、创建应用或发起授权。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        verify_auth: { type: "boolean", default: true, description: "联网验证用户 token；false 时只检查本地安装与配置。" },
      },
    },
  },
  {
    name: "feishu_doc_read",
    description: "读取飞书 Docx/Wiki 文档。默认返回适合阅读的 XML；需要块定位时使用 detail=with-ids。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        doc: { type: "string", minLength: 1, description: "文档 URL 或 token。" },
        identity,
        detail: { type: "string", enum: ["simple", "with-ids", "full"], default: "simple" },
        doc_format: { type: "string", enum: ["xml", "markdown", "im-markdown"], default: "xml" },
        scope: { type: "string", enum: ["full", "outline", "range", "keyword", "section"], default: "full" },
        start_block_id: { type: "string" },
        end_block_id: { type: "string" },
        keyword: { type: "string" },
        context_before: { type: "integer", minimum: 0 },
        context_after: { type: "integer", minimum: 0 },
        max_depth: { type: "integer", minimum: -1 },
        revision_id: { type: "integer", minimum: -1 },
      },
      required: ["doc"],
    },
  },
  {
    name: "feishu_doc_copy",
    description: "调用飞书 Drive copy API 创建文档副本，保留原文档结构；不会用读取后重建的方式伪造副本。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        source_token: { type: "string", minLength: 1 },
        folder_token: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1, maxLength: 256 },
        file_type: { type: "string", enum: ["docx", "doc", "sheet", "bitable", "mindnote", "slides", "file"], default: "docx" },
        identity,
        dry_run: dryRun,
        confirm_write: confirmWrite,
      },
      required: ["source_token", "folder_token", "name"],
    },
  },
  {
    name: "feishu_doc_update",
    description: "按文本或 block 精确更新飞书文档。写后继续操作新块前应重新读取 block id。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        doc: { type: "string", minLength: 1 },
        operation: {
          type: "string",
          enum: ["str_replace", "block_delete", "block_insert_after", "block_copy_insert_after", "block_replace", "block_move_after", "overwrite", "append"],
        },
        content: { type: "string" },
        pattern: { type: "string" },
        block_id: { type: "string" },
        src_block_ids: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
        doc_format: { type: "string", enum: ["xml", "markdown"], default: "xml" },
        revision_id: { type: "integer", minimum: -1, default: -1 },
        identity,
        dry_run: dryRun,
        confirm_write: confirmWrite,
      },
      required: ["doc", "operation"],
    },
  },
  {
    name: "feishu_doc_media_insert",
    description: "把本地图片或附件上传并插入飞书文档。文件必须位于 FEISHU_MCP_WORKDIR 内，并使用相对路径。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        doc: { type: "string", minLength: 1 },
        file: { type: "string", minLength: 1, description: "相对 FEISHU_MCP_WORKDIR 的文件路径。" },
        media_type: { type: "string", enum: ["image", "file"], default: "image" },
        align: { type: "string", enum: ["left", "center", "right"] },
        caption: { type: "string" },
        width: { type: "integer", minimum: 1 },
        height: { type: "integer", minimum: 1 },
        selection_with_ellipsis: { type: "string" },
        before: { type: "boolean" },
        identity,
        dry_run: dryRun,
        confirm_write: confirmWrite,
      },
      required: ["doc", "file"],
    },
  },
  {
    name: "feishu_bitable_record",
    description: "受控操作飞书多维表格记录：list 读取，upsert 新增或按 record_id 更新。不支持删除或任意 API 执行；真实写入仍需 confirm_write=true。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        operation: { type: "string", enum: ["list", "upsert"], description: "list 读取记录；upsert 新增或更新一条记录。" },
        base_url: { type: "string", minLength: 1, description: "多维表格、Wiki 或记录分享 URL；MCP 会用官方 CLI 解析 base/table/view。" },
        base_token: { type: "string", minLength: 1, description: "已知的多维表格 base token；与 table_id 一起使用时可跳过 URL 解析。" },
        table_id: { type: "string", minLength: 1, description: "数据表 ID（通常以 tbl 开头）或表名。URL 已包含表 ID 时可省略。" },
        view_id: { type: "string", minLength: 1, description: "可选视图 ID 或名称；默认使用 URL 中的视图，或读取整张表。" },
        field_ids: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1, description: "读取时只返回指定字段；可重复传入字段 ID 或名称。" },
        filter_json: { type: "string", minLength: 2, description: "官方 record-list filter JSON；只允许 JSON 对象。" },
        sort_json: { type: "string", minLength: 2, description: "官方 record-list sort JSON；只允许 JSON 数组或对象。" },
        offset: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
        record_id: { type: "string", minLength: 1, description: "upsert 时填写则更新该记录；省略则新增记录。" },
        fields: { type: "object", minProperties: 1, description: "upsert 的顶层字段映射，例如 {\"标题\":\"MCP 测试\"}；不要包裹 fields。" },
        identity,
        dry_run: dryRun,
        confirm_write: confirmWrite,
      },
      required: ["operation"],
    },
  },
  {
    name: "feishu_auth_status",
    description: "验证当前飞书身份、token 状态和已授权 scope；不会返回 appSecret 或 access token。",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "feishu_auth_start",
    description: "启动最小权限 Device Flow，立即返回授权链接和临时 device_code，不阻塞等待。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        domains: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
        scopes: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1 },
      },
    },
  },
  {
    name: "feishu_auth_complete",
    description: "用户在浏览器完成授权后，用本次流程的临时 device_code 完成登录。不要持久化 device_code。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { device_code: { type: "string", minLength: 1 } },
      required: ["device_code"],
    },
  },
  {
    name: "feishu_doctor",
    description: "检查 lark-cli、本地配置、鉴权与连通性；offline=true 时不访问网络。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { offline: { type: "boolean", default: false } },
    },
  },
  {
    name: "feishu_schema",
    description: "读取官方 lark-cli 某个 raw OpenAPI 方法的实时 JSON Schema，例如 drive.files.copy。",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { path: { type: "string", minLength: 5, pattern: "^[a-zA-Z0-9_][a-zA-Z0-9_-]*(\\.[a-zA-Z0-9_][a-zA-Z0-9_-]*){2,}$" } },
      required: ["path"],
    },
  },
];
