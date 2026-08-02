import { spawn } from "node:child_process";
import { resolve } from "node:path";

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

function parseJson(text) {
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function createLarkCliRunner({
  binary = process.env.LARK_CLI || "lark-cli",
  prefixArgs = [],
  cwd = resolve(process.env.FEISHU_MCP_WORKDIR || process.cwd()),
  timeoutMs = Number(process.env.FEISHU_MCP_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
} = {}) {
  return {
    cwd,
    async run(args) {
      return new Promise((resolveResult) => {
        const proc = spawn(binary, [...prefixArgs, ...args], {
          cwd,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
            LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
          },
        });

        let stdout = "";
        let stderr = "";
        let settled = false;

        const finish = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolveResult(result);
        };

        const timer = setTimeout(() => {
          proc.kill("SIGTERM");
          finish({
            ok: false,
            error: { type: "timeout", message: `lark-cli 超时（${timeoutMs}ms）` },
          });
        }, timeoutMs);

        const collect = (target, chunk) => {
          const next = target + chunk.toString("utf8");
          if (Buffer.byteLength(next) > maxOutputBytes) {
            proc.kill("SIGTERM");
            finish({
              ok: false,
              error: { type: "output_limit", message: "lark-cli 输出超过安全上限" },
            });
            return target;
          }
          return next;
        };

        proc.stdout.on("data", (chunk) => { stdout = collect(stdout, chunk); });
        proc.stderr.on("data", (chunk) => { stderr = collect(stderr, chunk); });
        proc.on("error", (error) => finish({
          ok: false,
          error: { type: "spawn_error", message: error.message },
        }));
        proc.on("close", (code) => {
          if (settled) return;
          const parsedOut = parseJson(stdout);
          const parsedErr = parseJson(stderr);
          if (code === 0) {
            if (parsedOut && typeof parsedOut === "object") {
              finish("ok" in parsedOut ? parsedOut : { ok: true, data: parsedOut });
            } else {
              finish({ ok: true, data: stdout.trim() || null });
            }
            return;
          }
          if (parsedErr && typeof parsedErr === "object") {
            finish("ok" in parsedErr ? parsedErr : { ok: false, error: parsedErr });
            return;
          }
          finish({
            ok: false,
            error: {
              type: "cli_error",
              exit_code: code,
              message: stderr.trim() || "lark-cli 执行失败",
            },
          });
        });
      });
    },
  };
}
