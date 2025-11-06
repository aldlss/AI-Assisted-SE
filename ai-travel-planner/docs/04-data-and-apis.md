# 04. 数据与 API 设计

## 数据模型（Supabase / Postgres）

> 说明：所有表均包含 `id`、`created_at`、`updated_at`，并通过 `user_id` 关联到 `auth.users`。

### 表：profiles
- user_id (uuid, pk, fk -> auth.users)
- display_name (text)
- avatar_url (text)

### 表：api_keys（加密或会话策略，二选一）
- user_id (uuid, pk)
- aliyun_dashscope_key_enc (text, 可选，服务端加密后存储)
- amap_web_key_enc (text, 可选)
- note: 可用 `pgcrypto` 进行对称加密，密钥由环境变量提供；或仅做会话级缓存，不落库。

### 表：trips
- id (uuid)
- user_id (uuid)
- title (text)
- destination (text)
- start_date (date)
- end_date (date)
- party_size (int)
- budget_total (numeric)
- preferences (jsonb)

### 表：itineraries（行程天）
- id (uuid)
- trip_id (uuid)
- day_index (int)
- note (text)

### 表：itinerary_items（行程项）
- id (uuid)
- itinerary_id (uuid)
- type (text)  -- sight/food/hotel/transport
- name (text)
- description (text)
- lat (numeric)
- lng (numeric)
- start_time (time)
- end_time (time)
- estimated_cost (numeric)
- transport_mode (text)  -- drive/walk/transit

### 表：budgets
- id (uuid)
- trip_id (uuid)
- amount_total (numeric)
- currency (text)

### 表：expenses
- id (uuid)
- trip_id (uuid)
- item_id (uuid, 可空)  -- 关联具体行程项
- category (text)       -- food/hotel/transport/ticket/other
- amount (numeric)
- occurred_at (timestamptz)
- note (text)

## RLS 策略（示意）
```sql
-- 每个业务表：仅允许当前用户访问自己的数据
alter table trips enable row level security;
create policy trips_owner on trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## API 设计（Next.js Route Handlers）

### POST /api/asr
- 入参：multipart/form-data { audio: Blob }
- 处理：服务端将音频转发至 DashScope ASR（paraformer），返回文本
- 出参：{ text: string }

### POST /api/plan
- 入参：{ destination, dateRange|days, budget, partySize, preferences }
- 处理：构造 Prompt → 调用 DashScope LLM（Qwen）→ 解析/校验 → 写入 trips/itineraries/items
- 出参：{ tripId, itinerary: ... }（结构化 JSON）

### GET /api/trips, GET /api/trips/[id]
- 读取 “我的行程” 列表/详情（含行程天与行程项）

### POST /api/expenses, GET /api/expenses?tripId=
- 写入/查询支出记录

### GET /api/budget?tripId=, PUT /api/budget
- 查询/更新预算总额

### POST /api/voice-expense
- 语音记账：ASR → 轻量规则解析（金额/类别/备注）→ 写入 expenses

## 第三方服务接入要点
- 阿里云百炼（DashScope）
  - ASR：上传 PCM/WAV/WebM，选择中文识别模型（paraformer）
  - LLM：Qwen2.5 或同等中文效果模型；优先流式（Server-Sent Events）
- 高德地图
  - 浏览器端（JS API）：需要公开的 `NEXT_PUBLIC_AMAP_KEY` 才能加载 SDK，无法完全隐藏；务必在高德控制台配置“Referer 白名单”，并可启用 `securityJsCode`（`NEXT_PUBLIC_AMAP_SECURITY_JS_CODE`）增强校验。
  - 服务端（Web Service REST）：使用私密 `AMAP_REST_KEY`，通过 Next.js API Route 代理访问路线/地理编码等服务，避免在前端暴露服务端密钥；必要时可对参数做签名。
  - 组合策略：前端仅用于地图展示与基础交互；涉及敏感数据或配额敏感的服务统一走服务端代理。
