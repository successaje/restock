# syntax=docker/dockerfile:1.7
# One container runs the agent loop, its API and the built web app.
#   docker build -t restock .
#   docker run -p 8787:8787 -v restock-data:/app/data restock
# Mount /app/data on persistent storage in live mode: the ledger there
# remembers which payments were already converted.

# ---- build the web app
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---- runtime
FROM node:24-slim
ENV NODE_ENV=production \
    PORT=8787 \
    NODE_NO_WARNINGS=1
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY --from=build /app/web/dist ./web/dist
RUN mkdir -p data && chown node:node data
USER node
VOLUME ["/app/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/health`).then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "--import", "tsx", "src/server.ts"]
