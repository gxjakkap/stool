FROM oven/bun:1-alpine AS pruner
WORKDIR /app

COPY . .
RUN bunx turbo prune @stool/frontend --docker

FROM oven/bun:1-alpine AS installer
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .

RUN bunx turbo run build --filter=@stool/frontend

FROM nginx:1.27-alpine AS runner

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
