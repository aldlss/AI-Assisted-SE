## --- Build Stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Build-time public envs for Next.js client（需要在构建阶段注入）
ARG NEXT_PUBLIC_AMAP_KEY
ARG NEXT_PUBLIC_AMAP_SECURITY_JS_CODE
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_AMAP_KEY=$NEXT_PUBLIC_AMAP_KEY \
	NEXT_PUBLIC_AMAP_SECURITY_JS_CODE=$NEXT_PUBLIC_AMAP_SECURITY_JS_CODE \
	NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
	NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Copy manifest files first (better cache)
COPY package.json pnpm-lock.yaml* .

# Install deps (no dev in separate stage yet, keep for build)
RUN pnpm install --frozen-lockfile

# Copy rest of source
COPY . .

# Build Next.js (App Router)
RUN pnpm build

## --- Production Runtime Stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy required files from build stage
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-lock.yaml ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/src ./src

COPY --from=build /app/node_modules ./node_modules

# 可选：裁剪为生产依赖，减小体积
RUN corepack enable && corepack prepare pnpm@latest --activate \
	&& pnpm prune --prod \
	&& rm -rf node_modules/.cache || true

# Expose port
EXPOSE 3000

USER appuser

# Start command (env vars are injected at runtime)
CMD ["pnpm","start"]
