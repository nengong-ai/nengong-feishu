#!/usr/bin/env node

const argv = process.argv.slice(2);
if (process.env.MOCK_LARK_EXIT_CODE) {
  console.error(JSON.stringify({
    ok: false,
    error: { type: "mock_error", argv },
  }));
  process.exit(Number(process.env.MOCK_LARK_EXIT_CODE));
}

console.log(JSON.stringify({ ok: true, data: { argv } }));
