# AI Travel Planner 文档索引

本目录包含项目的需求、架构与实现方案等文档，便于快速理解与协作。

- 01 需求说明书: `01-requirements.md`
- 02 架构设计: `02-architecture.md`
- 03 实现计划: `03-implementation-plan.md`
- 04 数据与 API 设计: `04-data-and-apis.md`
- 05 部署与交付: `05-deployment.md`

技术栈约定（可在实现中微调）：
- 前端与服务端渲染：Next.js (App Router) + TypeScript + Tailwind CSS
- UI 组件库：shadcn/ui（基于 Radix Primitives，Tailwind 风格）
- 身份认证与数据存储：Supabase（Auth、Postgres、RLS）
- 语音识别与大模型：阿里云百炼（DashScope，ASR + Qwen 系列）
- 地图与路线：高德地图 Web JS API（AMap JavaScript API v2）
- 部署与交付：Docker 镜像 + GitHub Actions 推送至阿里云 ACR

安全与密钥：不在仓库提交任何密钥。提供“设置页”便于运行时输入；同时支持通过环境变量注入（仅本地/部署环境）。
