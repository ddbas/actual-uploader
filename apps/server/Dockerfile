# Build from the monorepo root: docker build -f apps/server/Dockerfile .
# Uses `turbo prune` so only the server's dependency graph (and a pruned
# lockfile) enter the image. See https://turborepo.dev/docs/guides/tools/docker
FROM node:26-bookworm-slim AS base
RUN npm install -g pnpm@11.20.0
WORKDIR /app

# ---
FROM base AS prepare
RUN npm install -g turbo@2.11.9
COPY . .
RUN turbo prune server --docker

# ---
FROM base AS builder
# better-sqlite3 has no prebuilt binary for this Node version; build from source
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
# Install dependencies first (only changes when package.json/lockfile do)
COPY --from=prepare /app/out/json/ .
RUN pnpm install --frozen-lockfile
# Then add sources and build (server + dashboard)
COPY --from=prepare /app/out/full/ .
# Not included by `turbo prune`, but extended by the packages' tsconfigs
COPY --from=prepare /app/tsconfig.base.json .
RUN pnpm turbo build --filter=server

# ---
FROM base AS runner
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    ACCOUNT_CRAWLER_NO_OPEN=1
COPY --from=builder --chown=node:node /app /app
# Data directory: mount a volume here
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
WORKDIR /app/apps/server
ENTRYPOINT ["node", "dist/bin.js"]
CMD ["--data-dir", "/data"]
