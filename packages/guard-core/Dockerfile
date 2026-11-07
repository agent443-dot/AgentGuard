# Build from the repository root with --dockerfile: see "Deploy on Fly.io" in this package's README.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
# Only the files guard-core runs from, so no .env, key file or test can end up in a layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/onchain/package.json packages/onchain/
COPY packages/guard-core/package.json packages/guard-core/
# better-sqlite3 ships its prebuilt bindings in the package and esbuild (for tsx) its binary as an
# optional dependency, so no install script has to run, and no compiler is needed.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @agentguard/guard-core...
COPY packages/shared/src packages/shared/src
COPY packages/onchain/src packages/onchain/src
COPY packages/guard-core/src packages/guard-core/src
COPY packages/guard-core/migrations packages/guard-core/migrations
COPY packages/guard-core/deploy packages/guard-core/deploy
RUN pnpm --filter @agentguard/guard-core deploy --prod --legacy --ignore-scripts /out

FROM node:22-slim
ENV NODE_ENV=production
# The same depth as in the repository, so db/placement.ts takes /srv/agentguard as the repo root
# and the /data volume counts as outside it.
WORKDIR /srv/agentguard/packages/guard-core
COPY --from=build /out .
# Starts as root only to mount tmpfs for the hot keys, then runs node as the node user.
ENTRYPOINT ["./deploy/entrypoint.sh"]
CMD ["node", "--import", "tsx", "src/main.ts"]
