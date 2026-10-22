# NuraHelp — production image for Coolify
#
# WORKDIR must NOT be `/app`: Next.js App Router lives under `./app`, and the
# product console is `./app/app` (URL `/app`). Building/running with cwd `/app`
# makes standalone path traces collide (e.g. `/` loads `app/app/page.tsx` +
# AppAccessGate, skips root layout/`globals.css` → unstyled + forced login).
# See vercel/next.js#68690.
FROM node:22-alpine AS deps
WORKDIR /nura
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# Coolify may inject NODE_ENV=production during build; keep devDeps for next build/typescript.
RUN npm ci --include=dev

FROM node:22-alpine AS builder
WORKDIR /nura
COPY --from=deps /nura/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=3072
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /nura
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3471
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache curl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /nura/public ./public
COPY --from=builder --chown=nextjs:nodejs /nura/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /nura/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /nura/CHANGELOG.md ./CHANGELOG.md

# Local uploads (task screenshots, marketing media) write under ./data. /nura
# belongs to root while the app runs as nextjs, so without this the first
# upload fails with EACCES: permission denied, mkdir '/nura/data'.
RUN mkdir -p /nura/data/admin-tasks /nura/data/marketing-media \
  && chown -R nextjs:nodejs /nura/data

USER nextjs
EXPOSE 3471
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3471)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
