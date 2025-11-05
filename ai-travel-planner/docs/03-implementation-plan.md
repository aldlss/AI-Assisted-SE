# 03. 实现计划（路线图）

## 里程碑
1) M1 可用原型（地图+语音+基础行程）：~ 3-5 天
2) M2 预算与记账、登录与云端同步：~ 3 天
3) M3 打磨体验（编辑、导出、国际化/可选）、CI/CD 与 Docker 交付：~ 2-3 天

## 任务拆解（按优先级）
- 基础框架
  - 集成 Tailwind + shadcn/ui，建立基础布局与主题
  - 建立 App Router 路由：`/`（生成器）、`/trips`（我的行程）、`/settings`（密钥）
  - 集成 Supabase（Auth：邮箱登录/魔法链接）
- 语音与 LLM
  - 浏览器录音组件（MediaRecorder）→ `/api/asr` → DashScope ASR → 文本
  - `/api/plan`：Prompt 设计（结构化 JSON 输出），调用 LLM（Qwen），服务端校验/修正结构
- 地图
  - 集成高德 JS Loader，地图容器与 Marker 组件
  - 行程项与地图联动，高亮与路线预览（驾车/步行/公交）
- 预算与记账
  - 模型：预算（总额/日均），支出（类别/金额/时间/关联行程项）
  - API：/api/budget、/api/expenses；UI：进度条、分类统计
  - 语音记账（简单口令解析）
- 数据与同步
  - 表结构与 RLS（见 04 文档）
  - “我的行程”列表、详情、复制、删除、导出 PDF
- 交付与部署
  - Dockerfile（多阶段构建），环境变量清单
  - GitHub Actions：构建镜像、推送阿里云 ACR

## 页面与路由结构（初版）
```
/                # 主页：需求输入（文本/语音）、结果展示（行程+地图）
/trips           # 我的行程列表
/trips/[id]      # 行程详情（地图联动、预算模块、编辑/复制/导出）
/settings        # 设置页（输入阿里云百炼/高德 Key，可临时使用）
/auth/callback   # Supabase Auth 回调
```

## 组件库与样式
- 采用 shadcn/ui：Button、Card、Dialog、Drawer、Tabs、Progress 等
- Tailwind 作为样式主线；封装 Map 容器与行程卡片组件

## 语音/LLM 处理流程（简要“契约”）
- 输入：
  - ASR：`audio/webm` 或 `audio/wav`，48kHz 单声道
  - 规划：目的地、日期/天数、预算、人数、偏好（字符串）
- 输出：
  - ASR：纯文本（UTF-8）
  - 规划：结构化 JSON（trips/itineraries/items），每项包含名称、经纬度（若可解析）、建议时间与费用估算
- 错误：
  - 超时/配额：统一错误码与友好提示；支持重试

## Prompt 设计（示例要点）
- 明确输出 JSON Schema（字段必填/可选），用代码块返回
- 估算每日总时长≤10小时，避免过密
- 标注每项估算费用与交通方式关键词，便于 UI 分类

## 地图交互要点
- Loader 仅加载必要插件；按需请求路线服务
- 只渲染当前日的 markers 与一条路线，切换日时更新

## 开发规范
- ESLint + Prettier；严格 TS；模块按 domain 分层（plan/map/budget/auth）
- API 响应统一格式；错误集中处理；单元测试覆盖核心解析逻辑
