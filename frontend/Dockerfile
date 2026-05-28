# ============================================
# HRMS Narwasthu Group - Frontend (Next.js 16)
# Multi-stage, Production-Ready Dockerfile
# ============================================

# ── Stage 1: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts --no-audit --no-fund

COPY . .

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_URL=http://backend:80/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
RUN npm run build

# ── Stage 2: Production Runner ─────────────────────────────
FROM node:22-alpine AS runner

LABEL maintainer="Ahmad Rizki <ahmadrizki@narwastuarthatama.com>"
LABEL description="HRMS Narwasthu Group - Next.js Frontend Dashboard"

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public

# Leverage Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
