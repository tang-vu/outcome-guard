FROM node:24.14.1-alpine AS base
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/agent/package.json apps/agent/package.json
COPY packages/dreamdex/package.json packages/dreamdex/package.json
COPY packages/execution-coordinator/package.json packages/execution-coordinator/package.json
COPY packages/policy-engine/package.json packages/policy-engine/package.json
COPY packages/receipt/package.json packages/receipt/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --ignore-scripts
COPY apps/agent apps/agent
COPY packages/dreamdex packages/dreamdex
COPY packages/execution-coordinator packages/execution-coordinator
COPY packages/policy-engine packages/policy-engine
COPY packages/receipt packages/receipt
COPY packages/schemas packages/schemas
COPY packages/shared packages/shared
RUN addgroup -S outcomeguard && adduser -S -G outcomeguard -h /home/outcomeguard outcomeguard \
  && mkdir -p /var/lib/outcomeguard && chown outcomeguard:outcomeguard /var/lib/outcomeguard
ENV EXECUTION_STATE_DIR=/var/lib/outcomeguard
VOLUME ["/var/lib/outcomeguard"]
USER outcomeguard
HEALTHCHECK --interval=20s --timeout=3s --start-period=15s --retries=3 CMD wget -q -O - http://127.0.0.1:8787/health >/dev/null || exit 1
CMD ["npm", "run", "agent"]
