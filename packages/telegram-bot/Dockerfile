# syntax=docker/dockerfile:1
# Build from the repository root: the bot needs packages/shared and the workspace lockfile.
#   docker build -f packages/telegram-bot/Dockerfile .

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @agentguard/telegram-bot...
# --legacy: copies workspace packages into the output instead of needing inject-workspace-packages.
RUN pnpm --filter @agentguard/telegram-bot deploy --prod --legacy /app

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
# shared ships TypeScript sources, so the bot runs under tsx rather than from a build.
CMD ["node", "--import", "tsx", "src/main.ts"]
