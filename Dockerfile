# syntax=docker/dockerfile:1
# STAGE 1: HERMETIC TYPESCRIPT & VITE BUILDER
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

# STAGE 2: DISTROLESS NONROOT PRODUCTION RUNNER (Zero Shell / Zero Package Manager)
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV EMBED_WORKER=true

COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/server.ts ./server.ts
COPY --from=builder --chown=nonroot:nonroot /app/src ./src
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json

USER nonroot
EXPOSE 3000
CMD ["node_modules/tsx/dist/cli.mjs", "server.ts"]
