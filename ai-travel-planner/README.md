## AI 旅行规划助手（语音一键生成行程）

一个基于 Next.js 16 + React 19 + TypeScript 的旅行规划应用：
- 用语音或文字描述旅行需求，自动生成含 景点/餐饮/住宿/交通 的完整行程
- 支持预算、偏好与同行人数，地图预览与登录保存
- 语音可直达 LLM 生成（服务端附加系统提示词，确保完整提取与结构化 JSON）

主要技术：Next.js App Router、MUI、Tailwind、Framer Motion、Supabase Auth、阿里云百炼（DashScope 兼容）、高德地图、科大讯飞 ASR（可选）。

---

## 功能概览

- 表单生成：输入目的地/日期/天数/预算/人数/偏好 → 一键生成行程并保存
- 语音直达生成：录音→提交→服务端携带提示词调用 LLM → 生成行程并保存
- 地理编码与时间补齐：为行程项补经纬度（高德 REST）与推荐时间段
- 登录与持久化：需登录后才能生成与保存行程（Supabase）

---

## 快速开始（本地）

### 先决条件
- Node.js 18+（建议 20+）
- pnpm（推荐）或 npm/yarn

### 克隆与安装
```bash
pnpm install
```

### 配置环境变量（.env.local）
推荐先复制模板：
```bash
cp ai-travel-planner/.env.example ai-travel-planner/.env.local
```
按需填写 `.env.local`，完整清单如下（可直接复制）：

```bash
# 公开（浏览器可见）
NEXT_PUBLIC_AMAP_KEY=你的高德Web JS API Key
NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=你的高德JS安全码
NEXT_PUBLIC_SUPABASE_URL=你的 Supabase 项目 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 Supabase 匿名 Key

# 仅服务端（不要暴露给客户端）
DASHSCOPE_API_KEY=你的阿里云百炼 API Key
# 可选：默认 qwen-plus
DASHSCOPE_MODEL=qwen-plus
# 可选：百炼兼容端点，默认官方
DASHSCOPE_COMPAT_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions

# 可选：为地点补经纬度（高德 REST）
AMAP_REST_KEY=

# 可选：如项目启用对称加密（自定义功能）
ENCRYPTION_SECRET=

# 语音识别（科大讯飞 WebAPI）——仅当启用 /api/asr/iflytek 时需要
IFLYTEK_APPID=你的讯飞 WebAPI 应用 AppID
IFLYTEK_API_KEY=你的讯飞 WebAPI API Key
# 启用 v2 WebSocket 推荐提供 API Secret
IFLYTEK_API_SECRET=你的讯飞 WebAPI API Secret

# 可选：地理编码最大请求数（避免频繁外呼），默认 20
GEOCODE_LIMIT=20
```

注意：`.env.local` 不要提交到公开仓库。如已泄漏请在各平台重置 Key。

### 启动开发服务
```bash
pnpm dev
```
打开 http://localhost:3000 访问。

---

## 使用说明

### 路径一：表单生成
1. 填写目的地、出发日期、天数、预算、人数、偏好
2. 点击“生成行程”（需先登录）
3. 生成后会保存到数据库并跳转到 trip 详情页，支持地图预览

### 路径二：语音直达生成
1. 授权麦克风，点击录音并描述完整需求（目的地/天数/预算/人数/偏好等）
2. 停止后点击“提交”，前端会调用 `/api/voice/plan`
3. 服务端附带系统提示词调用百炼，强制输出结构化 JSON → 地理编码/时间补齐 → 保存并跳转
4. 移动端若提示 “Failed to fetch”，请确保 HTTPS、同一网络、服务正在运行且已登录

---

## 环境变量一览

必需：
- `NEXT_PUBLIC_SUPABASE_URL`，`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_AMAP_KEY`，`NEXT_PUBLIC_AMAP_SECURITY_JS_CODE`
- `DASHSCOPE_API_KEY`

可选：
- `AMAP_REST_KEY`（为地点补经纬度）
- `DASHSCOPE_MODEL`（默认 `qwen-plus`）
- `DASHSCOPE_COMPAT_ENDPOINT`（默认官方兼容端点）
- `IFLYTEK_*`（仅在使用语音识别代理 `/api/asr/iflytek` 时需要）

---

## 部署

### Vercel（推荐）
1. 导入仓库到 Vercel
2. 在 Vercel Project → Settings → Environment Variables 配置上面的环境变量
3. 触发部署即可（需要在 Supabase 配置好数据库 Schema）

### 自建服务器（Node）
```bash
pnpm build
pnpm start # 默认 0.0.0.0:3000
```
将 `.env.local` 内容以进程环境变量方式注入（或写入服务器上的 `.env`），前置 Nginx/Traefik 提供 HTTPS 与反向代理。

---

## 常见问题（FAQ）

- 移动端 “Failed to fetch”
	- 请确保 HTTPS、同一网络、服务在运行，并确认已登录（需要 same-origin cookies）
- 讯飞报错 “illegal access|no appid info (10105)”
	- 使用“WebAPI 语音听写”应用的 AppID/API Key（不是其他产品），并补充 API Secret 以启用 v2 WebSocket；确保服务端环境变量无空格
- 地图不显示/定位为空
	- 请配置 `NEXT_PUBLIC_AMAP_KEY`（JS）与 `AMAP_REST_KEY`（REST，选配）

---

## 开发脚本

```bash
pnpm dev     # 开发模式
pnpm build   # 生产构建
pnpm start   # 本地启动生产包
pnpm lint    # 代码检查
```

---

## 项目文档（/docs）

项目的需求、架构与实现方案在 `docs/`：

- docs/README.md（索引）
- docs/01-requirements.md（需求说明书）
- docs/02-architecture.md（架构设计）
- docs/03-implementation-plan.md（实现计划）
- docs/04-data-and-apis.md（数据与 API 设计）
- docs/05-deployment.md（部署与交付）
