FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache curl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY server.mjs ./server.mjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/generated ./src/generated

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/login > /dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
