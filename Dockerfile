# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# ── deps ────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ───────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Both are baked in at build time: the pages are statically generated, so a
# runtime-only variable would never reach them. In Coolify, tick "Build
# Variable" on each of these.
ARG NEXT_PUBLIC_SITE_URL=https://dartawil.emsquare.ma
ARG SITE_INDEXABLE=false
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV SITE_INDEXABLE=$SITE_INDEXABLE
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── run ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Back office: schema migrations, applied on every start (already-applied
# ones are skipped). The postgres driver is traced into the standalone node_modules (next.config.ts).
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs

USER nextjs
EXPOSE 3000

# DATABASE_URL is a runtime variable (not a build one): /gestion renders per request.
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
