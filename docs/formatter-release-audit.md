# Formatter 发布审计

审计日期：2026-08-02。

## 来源与改造

- `skills/feishu-doc-formatter` 是面向独立执行器契约重新组织和重写的公开 Skill。
- 它没有复制私有 Hub 的文件、脚本、图片或配置；内部 Hub 只作为行为参考。
- 公开说明不把未确认权属的外部模板或素材描述成原创或独家。

## 隐私与凭据

- 发布树不包含真实飞书 URL、token、用户 ID、access token、app secret、`.env` 内容或真实文档正文。
- 示例使用占位值，真实回归测试不把文档内容和链接写入仓库。
- 客户端本地配置、依赖缓存和 Git 历史不进入本发布包。

## 组件边界

- Skill 只描述保真阅读、模式选择、复制后排版、块级更新、媒体保留和失败恢复。
- MCP 的执行能力通过稳定契约连接，详见 `skills/feishu-doc-formatter/references/operation-contract.md` 和 `docs/MCP_CONTRACT.md`。
- Skill 不接管用户凭证，也不声称在没有真实写回验收时已经修改飞书文档。

## 发布结论

- 本仓库采用顶层 MIT License。
- Formatter 的 mock/dry-run 测试由 CI 在三种操作系统和两组 Node.js 版本中运行。
- 真实飞书写入仍须在专用测试文档上取得用户明确授权。
