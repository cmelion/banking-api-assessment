# Multi-stage build for production-ready banking API
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Install required dependencies for Prisma and Alpine Linux
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
# Install build dependencies including OpenSSL
RUN apk add --no-cache libc6-compat openssl ca-certificates

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Generate Prisma client for the correct platform
ENV PRISMA_CLI_BINARY_TARGET=linux-musl-openssl-3.0.x
RUN npx prisma generate
# Build the application
RUN npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# Install runtime dependencies for Prisma
RUN apk add --no-cache openssl ca-certificates

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy the built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Create data directory for SQLite with proper permissions
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]