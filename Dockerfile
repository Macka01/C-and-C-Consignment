FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=43123
ENV HOSTNAME=0.0.0.0
ENV CONSIGNMENT_DATA_DIR=/data
ENV CONSIGNMENT_BACKUP_DIR=/backups
ENV CONSIGNMENT_SEED=0
ENV CONSIGNMENT_DOCKER=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs \
  && mkdir -p /data/reports /backups \
  && chown -R nextjs:nodejs /data /backups

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdf-lib ./node_modules/pdf-lib
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@pdf-lib ./node_modules/@pdf-lib
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pako ./node_modules/pako
COPY server/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod 755 /app/docker-entrypoint.sh && chown nextjs:nodejs /app/docker-entrypoint.sh

USER nextjs
EXPOSE 43123
HEALTHCHECK --interval=15s --timeout=5s --start-period=25s --retries=8 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:43123/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["/app/docker-entrypoint.sh"]
