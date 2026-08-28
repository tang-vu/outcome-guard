FROM node:24.14.1-alpine AS base
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/agent/package.json apps/agent/package.json
COPY packages/dreamdex/package.json packages/dreamdex/package.json
RUN npm ci --ignore-scripts
COPY apps/agent apps/agent
COPY packages/dreamdex packages/dreamdex
CMD ["npm", "run", "agent"]
