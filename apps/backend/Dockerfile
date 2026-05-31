FROM oven/bun:1-alpine AS pruner
WORKDIR /app

COPY package.json bun.lock turbo.json ./
RUN bun install --frozen-lockfile

COPY apps ./apps

RUN bunx turbo prune @stool/backend --docker

FROM oven/bun:1-alpine AS installer
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine AS runner
WORKDIR /app

COPY --from=installer /app/node_modules ./node_modules
COPY --from=pruner /app/out/full/ .

WORKDIR /app/apps/backend

EXPOSE 4000
CMD ["bun", "run", "src/index.ts"]
