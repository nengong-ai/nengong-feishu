import { realpathSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

const WRITE_CONFIRMATION = {
  ok: false,
  error: {
    type: "write_confirmation_required",
    message: "真实飞书写入需要 confirm_write=true；可先用 dry_run=true 预览。",
  },
};

const IDENTITIES = ["user", "bot"];
const BITABLE_OPERATIONS = ["list", "upsert"];
const UPDATE_OPERATIONS = [
  "str_replace", "block_delete", "block_insert_after", "block_copy_insert_after",
  "block_replace", "block_move_after", "overwrite", "append",
];

function addFlag(args, flag, value) {
  if (value === undefined || value === null) return;
  args.push(flag, String(value));
}

function requireWriteConfirmation(input) {
  return input.dry_run !== true && input.confirm_write !== true;
}

function requireString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} 必须是非空字符串`);
  }
  return value;
}

function optionalEnum(value, field, choices, fallback) {
  const resolved = value ?? fallback;
  if (!choices.includes(resolved)) {
    throw new Error(`${field} 必须是 ${choices.join(" | ")}`);
  }
  return resolved;
}

function validateStringArray(value, field) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} 必须是非空数组`);
  for (const item of value) requireString(item, `${field} 条目`);
}

function validateJsonText(value, field, expectedType) {
  if (value === undefined) return;
  requireString(value, field);
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${field} 必须是有效 JSON`);
  }
  if (expectedType && (parsed === null || typeof parsed !== expectedType || Array.isArray(parsed))) {
    throw new Error(`${field} 必须是 JSON ${expectedType === "object" ? "对象" : expectedType}`);
  }
  return parsed;
}

function validateBitableFields(value) {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("upsert 需要 fields 对象");
  }
  const keys = Object.keys(value);
  if (keys.length === 0) throw new Error("fields 不能为空");
  for (const key of keys) requireString(key, "fields 字段名");
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 64 * 1024) {
    throw new Error("fields JSON 不能超过 65536 字节");
  }
  return serialized;
}

function validateBitableUrl(value) {
  requireString(value, "base_url");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("base_url 必须是有效 URL");
  }
  if (url.protocol !== "https:") throw new Error("base_url 必须使用 HTTPS");
  return value;
}

function validateRelativeFile(file, cwd) {
  requireString(file, "file");
  const normalized = normalize(file);
  if (isAbsolute(file) || normalized === ".." || normalized.startsWith(`..${sep}`)) {
    throw new Error("file 必须是 FEISHU_MCP_WORKDIR 内的相对路径");
  }
  const realRoot = realpathSync(cwd);
  const realFile = realpathSync(resolve(realRoot, normalized));
  const fromRoot = relative(realRoot, realFile);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error("file 的真实路径越过 FEISHU_MCP_WORKDIR（可能经过符号链接）");
  }
  return normalized;
}

function validateUpdate(input) {
  const needsContent = ["str_replace", "block_insert_after", "block_replace", "overwrite", "append"];
  const needsBlock = ["block_delete", "block_insert_after", "block_copy_insert_after", "block_replace", "block_move_after"];
  const needsSource = ["block_copy_insert_after", "block_move_after"];
  if (needsContent.includes(input.operation) && !("content" in input)) {
    throw new Error(`${input.operation} 需要 content`);
  }
  if ("content" in input && typeof input.content !== "string") {
    throw new Error("content 必须是字符串");
  }
  if (input.operation === "str_replace" && !("pattern" in input)) {
    throw new Error("str_replace 需要 pattern");
  }
  if ("pattern" in input && typeof input.pattern !== "string") {
    throw new Error("pattern 必须是字符串");
  }
  if (needsBlock.includes(input.operation) && !input.block_id) {
    throw new Error(`${input.operation} 需要 block_id`);
  }
  if (needsSource.includes(input.operation) && !input.src_block_ids?.length) {
    throw new Error(`${input.operation} 需要 src_block_ids`);
  }
  validateStringArray(input.src_block_ids, "src_block_ids");
}

function payload(result) {
  return result?.data && typeof result.data === "object" ? result.data : result;
}

function setupResult(stage, details = {}) {
  return {
    ok: true,
    data: {
      contract: "feishu-setup/1.0",
      ready: stage === "ready",
      stage,
      ...details,
    },
  };
}

async function resolveBitableCoordinates({ input, identity, runner }) {
  const hasUrl = input.base_url !== undefined;
  const hasToken = input.base_token !== undefined;
  if (!hasUrl && !hasToken) throw new Error("必须提供 base_url，或同时提供 base_token 与 table_id");
  if (hasUrl && hasToken) throw new Error("base_url 与 base_token 不能同时提供");

  if (hasUrl) {
    const resolved = await runner.run([
      "base", "+url-resolve", "--url", validateBitableUrl(input.base_url), "--as", identity, "--json",
    ]);
    if (!resolved.ok) return resolved;
    const data = payload(resolved);
    const baseToken = data?.base_token;
    const tableId = input.table_id ?? data?.table_id;
    const viewId = input.view_id ?? data?.view_id;
    if (typeof baseToken !== "string" || baseToken.length === 0) {
      throw new Error("base_url 解析成功，但没有返回 base_token");
    }
    if (typeof tableId !== "string" || tableId.length === 0) {
      throw new Error("请在 base_url 或 table_id 中提供数据表");
    }
    return { ok: true, baseToken, tableId, viewId };
  }

  requireString(input.base_token, "base_token");
  requireString(input.table_id, "table_id");
  return { ok: true, baseToken: input.base_token, tableId: input.table_id, viewId: input.view_id };
}

export function createToolHandler({ runner }) {
  return async function callTool(name, input) {
    try {
      switch (name) {
        case "feishu_setup": {
          const version = await runner.run(["--version"]);
          if (!version.ok) {
            if (version.error?.type === "spawn_error") {
              return setupResult("cli_missing", {
                message: "未找到飞书官方 lark-cli。先安装 CLI，再重新调用 feishu_setup。",
                install: {
                  command: "npx @larksuite/cli@latest install",
                  source: "https://github.com/larksuite/cli",
                },
                next_action: "安装完成后重新调用 feishu_setup",
              });
            }
            return setupResult("cli_check_failed", {
              message: "lark-cli 存在，但版本检查失败。",
              diagnostic: version.error,
              next_action: "检查 LARK_CLI 路径或重新安装官方 CLI",
            });
          }

          const doctor = await runner.run(["doctor", "--offline"]);
          const doctorData = payload(doctor);
          const checks = Array.isArray(doctorData?.checks) ? doctorData.checks : [];
          const failedChecks = checks.filter((check) => check.status === "fail");
          const configReady = ["config_file", "app_resolved"].every((name) =>
            checks.some((check) => check.name === name && check.status === "pass"),
          );
          if (!doctor.ok || !configReady) {
            return setupResult("config_required", {
              cli_version: typeof version.data === "string" ? version.data : undefined,
              message: "lark-cli 已安装，但飞书应用配置尚未就绪。",
              diagnostic: { failed_checks: failedChecks },
              configure: {
                command: "lark-cli config init --new",
                note: "该命令会等待用户在浏览器完成应用创建；不要在无人确认时自动执行。",
              },
              next_action: "完成应用配置后重新调用 feishu_setup",
            });
          }

          if (input.verify_auth === false) {
            return setupResult("auth_unverified", {
              message: "CLI 与应用配置已就绪，但按请求跳过了联网鉴权验证。",
              next_tool: "feishu_auth_status",
            });
          }

          const auth = await runner.run(["auth", "status", "--json", "--verify"]);
          const authData = payload(auth);
          const userStatus = authData?.identities?.user?.status;
          const userReady = auth.ok && authData?.verified === true && ["ready", "needs_refresh"].includes(userStatus);
          if (!userReady) {
            return setupResult("auth_required", {
              cli_version: typeof version.data === "string" ? version.data : undefined,
              message: "飞书应用已配置，但用户身份尚未完成有效授权。",
              diagnostic: {
                verified: authData?.verified === true,
                user_status: userStatus || "missing",
                error_type: auth.error?.type,
              },
              next_tool: "feishu_auth_start",
              suggested_input: { domains: ["docs", "drive"] },
              next_action: "若同一机器的其他 Agent 已授权，先检查 MCP 的 LARK_CLI 是否指向同一官方 CLI；否则展示授权链接，等用户确认完成后再调用 feishu_auth_complete",
            });
          }

          return setupResult("ready", {
            message: "飞书 CLI、应用配置和用户授权均已就绪。",
            cli_version: typeof version.data === "string" ? version.data : undefined,
            identity: "user",
            user_status: userStatus,
            next_action: "可以调用文档工具；需要多维表格记录时使用 feishu_bitable_record，并按需确认 Base 权限",
          });
        }
        case "feishu_doc_read": {
          requireString(input.doc, "doc");
          const identity = optionalEnum(input.identity, "identity", IDENTITIES, "user");
          const detail = optionalEnum(input.detail, "detail", ["simple", "with-ids", "full"], "simple");
          const docFormat = optionalEnum(input.doc_format, "doc_format", ["xml", "markdown", "im-markdown"], "xml");
          const scope = optionalEnum(input.scope, "scope", ["full", "outline", "range", "keyword", "section"], "full");
          const args = ["docs", "+fetch", "--doc", input.doc, "--as", identity];
          addFlag(args, "--detail", detail);
          addFlag(args, "--doc-format", docFormat);
          addFlag(args, "--scope", scope);
          addFlag(args, "--start-block-id", input.start_block_id);
          addFlag(args, "--end-block-id", input.end_block_id);
          addFlag(args, "--keyword", input.keyword);
          addFlag(args, "--context-before", input.context_before);
          addFlag(args, "--context-after", input.context_after);
          addFlag(args, "--max-depth", input.max_depth);
          addFlag(args, "--revision-id", input.revision_id);
          return await runner.run(args);
        }
        case "feishu_doc_copy": {
          requireString(input.source_token, "source_token");
          requireString(input.folder_token, "folder_token");
          requireString(input.name, "name");
          if (Buffer.byteLength(input.name, "utf8") > 256) throw new Error("name 不能超过 256 字节");
          const fileType = optionalEnum(input.file_type, "file_type", ["docx", "doc", "sheet", "bitable", "mindnote", "slides", "file"], "docx");
          const identity = optionalEnum(input.identity, "identity", IDENTITIES, "user");
          if (requireWriteConfirmation(input)) return WRITE_CONFIRMATION;
          const data = {
            folder_token: input.folder_token,
            name: input.name,
            type: fileType,
          };
          const args = [
            "drive", "files", "copy",
            "--file-token", input.source_token,
            "--data", JSON.stringify(data),
            "--as", identity,
          ];
          if (input.dry_run) args.push("--dry-run");
          return await runner.run(args);
        }
        case "feishu_doc_update": {
          requireString(input.doc, "doc");
          requireString(input.operation, "operation");
          optionalEnum(input.operation, "operation", UPDATE_OPERATIONS);
          const identity = optionalEnum(input.identity, "identity", IDENTITIES, "user");
          const docFormat = optionalEnum(input.doc_format, "doc_format", ["xml", "markdown"], "xml");
          validateUpdate(input);
          if (requireWriteConfirmation(input)) return WRITE_CONFIRMATION;
          const args = [
            "docs", "+update", "--doc", input.doc,
            "--command", input.operation,
            "--as", identity,
            "--doc-format", docFormat,
          ];
          if ("content" in input) addFlag(args, "--content", input.content);
          if ("pattern" in input) addFlag(args, "--pattern", input.pattern);
          addFlag(args, "--block-id", input.block_id);
          if (input.src_block_ids) addFlag(args, "--src-block-ids", input.src_block_ids.join(","));
          addFlag(args, "--revision-id", input.revision_id ?? -1);
          if (input.dry_run) args.push("--dry-run");
          return await runner.run(args);
        }
        case "feishu_doc_media_insert": {
          requireString(input.doc, "doc");
          const mediaType = optionalEnum(input.media_type, "media_type", ["image", "file"], "image");
          const identity = optionalEnum(input.identity, "identity", IDENTITIES, "user");
          if (input.align !== undefined) optionalEnum(input.align, "align", ["left", "center", "right"]);
          if (requireWriteConfirmation(input)) return WRITE_CONFIRMATION;
          const file = validateRelativeFile(input.file, runner.cwd);
          const args = [
            "docs", "+media-insert", "--doc", input.doc,
            "--file", file,
            "--type", mediaType,
            "--as", identity,
          ];
          addFlag(args, "--align", input.align);
          addFlag(args, "--caption", input.caption);
          addFlag(args, "--width", input.width);
          addFlag(args, "--height", input.height);
          addFlag(args, "--selection-with-ellipsis", input.selection_with_ellipsis);
          if (input.before) args.push("--before");
          if (input.dry_run) args.push("--dry-run");
          return await runner.run(args);
        }
        case "feishu_bitable_record": {
          const operation = optionalEnum(input.operation, "operation", BITABLE_OPERATIONS);
          const identity = optionalEnum(input.identity, "identity", IDENTITIES, "user");
          if (input.table_id !== undefined) requireString(input.table_id, "table_id");
          if (input.view_id !== undefined) requireString(input.view_id, "view_id");
          validateStringArray(input.field_ids, "field_ids");
          if (input.offset !== undefined && (!Number.isInteger(input.offset) || input.offset < 0)) {
            throw new Error("offset 必须是大于等于 0 的整数");
          }
          if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200)) {
            throw new Error("limit 必须是 1 到 200 的整数");
          }
          if (operation === "list") {
            if (input.record_id !== undefined || input.fields !== undefined) {
              throw new Error("list 不接受 record_id 或 fields；请使用 upsert");
            }
            validateJsonText(input.filter_json, "filter_json", "object");
            if (input.sort_json !== undefined) {
              const sort = validateJsonText(input.sort_json, "sort_json");
              if (sort === null || typeof sort !== "object") throw new Error("sort_json 必须是 JSON 数组或对象");
            }
          } else {
            const fields = validateBitableFields(input.fields);
            if (input.record_id !== undefined) requireString(input.record_id, "record_id");
            if (input.filter_json !== undefined || input.sort_json !== undefined || input.field_ids !== undefined || input.view_id !== undefined || input.offset !== undefined || input.limit !== undefined) {
              throw new Error("upsert 只接受 base、table、record_id、fields、identity、dry_run 和 confirm_write");
            }
            if (requireWriteConfirmation(input)) return WRITE_CONFIRMATION;
            const coordinates = await resolveBitableCoordinates({ input, identity, runner });
            if (!coordinates.ok) return coordinates;
            const args = [
              "base", "+record-upsert",
              "--base-token", coordinates.baseToken,
              "--table-id", coordinates.tableId,
              "--json", fields,
              "--as", identity,
            ];
            addFlag(args, "--record-id", input.record_id);
            if (input.dry_run) args.push("--dry-run");
            return await runner.run(args);
          }

          const coordinates = await resolveBitableCoordinates({ input, identity, runner });
          if (!coordinates.ok) return coordinates;
          const args = [
            "base", "+record-list",
            "--base-token", coordinates.baseToken,
            "--table-id", coordinates.tableId,
            "--as", identity,
            "--json",
          ];
          addFlag(args, "--view-id", coordinates.viewId);
          for (const fieldId of input.field_ids || []) addFlag(args, "--field-id", fieldId);
          addFlag(args, "--filter-json", input.filter_json);
          addFlag(args, "--sort-json", input.sort_json);
          addFlag(args, "--offset", input.offset);
          addFlag(args, "--limit", input.limit);
          if (input.dry_run) args.push("--dry-run");
          return await runner.run(args);
        }
        case "feishu_auth_status":
          return await runner.run(["auth", "status", "--json", "--verify"]);
        case "feishu_auth_start": {
          validateStringArray(input.domains, "domains");
          validateStringArray(input.scopes, "scopes");
          if (!input.domains?.length && !input.scopes?.length) {
            return { ok: false, error: { type: "validation", message: "至少指定一个 domains 或 scopes 条目" } };
          }
          const args = ["auth", "login"];
          for (const domain of input.domains || []) addFlag(args, "--domain", domain);
          for (const scope of input.scopes || []) addFlag(args, "--scope", scope);
          args.push("--no-wait", "--json");
          return await runner.run(args);
        }
        case "feishu_auth_complete": {
          requireString(input.device_code, "device_code");
          return await runner.run(["auth", "login", "--device-code", input.device_code, "--json"]);
        }
        case "feishu_doctor":
          return await runner.run(input.offline ? ["doctor", "--offline"] : ["doctor"]);
        case "feishu_schema": {
          requireString(input.path, "path");
          if (!/^[a-zA-Z0-9_][a-zA-Z0-9_-]*(\.[a-zA-Z0-9_][a-zA-Z0-9_-]*){2,}$/.test(input.path)) {
            throw new Error("path 必须是 service.resource.method 形式");
          }
          return await runner.run(["schema", input.path]);
        }
        default:
          return { ok: false, error: { type: "unknown_tool", message: `未知工具：${name}` } };
      }
    } catch (error) {
      return { ok: false, error: { type: "validation", message: error.message } };
    }
  };
}
