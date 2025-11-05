# 05. 部署与交付

## Docker 镜像（建议）
- 多阶段构建：builder（安装依赖/构建）→ runner（仅产物与必要运行时）
- 暴露 3000 端口，`NODE_ENV=production`，禁用不必要的 dev 依赖

示例结构（伪代码，后续在项目根添加 Dockerfile）：
```
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm i --frozen-lockfile

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json pnpm-lock.yaml ./
RUN npm i -g pnpm && pnpm i --prod --frozen-lockfile
EXPOSE 3000
CMD ["pnpm","start"]
```

## 环境变量（清单）
- 必需
  - NEXT_PUBLIC_AMAP_KEY（浏览器用，限制域名）
  - SUPABASE_URL, SUPABASE_ANON_KEY（Auth 与 DB）
- 服务端可选
  - DASHScope_API_KEY（若采用环境变量方式）
  - ENCRYPTION_SECRET（用于 pgcrypto 或服务端加解密）

建议在仓库提供 `.env.example`（不含真实值）。

## GitHub Actions → 阿里云 ACR
步骤要点：
1. 触发：push 到 `master` 或打 tag
2. 登录 ACR：`docker login`（GitHub Secrets 保存 ACR 用户/密码或临时令牌）
3. 构建：`docker build -t <acr-registry>/<namespace>/ai-travel-planner:<tag> .`
4. 推送：`docker push <acr-registry>/<namespace>/ai-travel-planner:<tag>`
5. 可选：在同一流程中执行 `supabase db push` 或迁移（若使用）

YAML 结构（示意）：
```yaml
name: build-and-push
on:
  push:
    branches: [ master ]
    tags: [ 'v*.*.*' ]
jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - name: Set up QEMU
        uses: docker/setup-qemu-action@v3
      - name: Set up Buildx
        uses: docker/setup-buildx-action@v3
      - name: Login ACR
        run: echo "$ACR_PASSWORD" | docker login $ACR_REGISTRY -u "$ACR_USERNAME" --password-stdin
        env:
          ACR_REGISTRY: ${{ secrets.ACR_REGISTRY }}
          ACR_USERNAME: ${{ secrets.ACR_USERNAME }}
          ACR_PASSWORD: ${{ secrets.ACR_PASSWORD }}
      - name: Build & Push
        run: |
          TAG=${GITHUB_SHA::7}
          IMAGE="$ACR_REGISTRY/$ACR_NAMESPACE/ai-travel-planner:$TAG"
          docker build -t "$IMAGE" .
          docker push "$IMAGE"
        env:
          ACR_REGISTRY: ${{ secrets.ACR_REGISTRY }}
          ACR_NAMESPACE: ${{ secrets.ACR_NAMESPACE }}
```

## 运行指引（本地）
1. 准备 `.env.local`：
   - NEXT_PUBLIC_AMAP_KEY=...
   - SUPABASE_URL=...
   - SUPABASE_ANON_KEY=...
   - （可选）DASHScope_API_KEY=...
2. 安装依赖并启动：
   - `pnpm i`
   - `pnpm dev`
3. 浏览器打开 `http://localhost:3000`

## 运行指引（Docker）
1. 构建镜像：`docker build -t ai-travel-planner:local .`
2. 运行容器：`docker run -p 3000:3000 --env-file .env.local ai-travel-planner:local`

## 评审与提交
- 提交 PDF：包含 GitHub repo 链接与 README；README 提供 Docker 镜像拉取与运行说明
- 若非使用阿里云 Key，按题目要求在 README 提供可用 Key 或设置页支持输入（建议后者）
