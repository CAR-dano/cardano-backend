# ============================================
# OPTIMIZED DOCKERFILE WITH PNPM & CACHING
# ============================================
# Features:
# - pnpm for faster dependency installation (2-3x faster than npm)
# - Persistent npm cache via Coolify volumes
# - Better layer caching
# - Reduced image size
# - Non-root user for security
# ============================================

# STAGE 1: Dependencies Installation
FROM node:22-alpine AS dependencies

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install build tools
RUN apk add --no-cache \
    build-base \
    python3 \
    cmake \
    git \
    openssl-dev \
    libc6-compat

RUN ln -sf /usr/bin/python3 /usr/bin/python || true

# Configure npm cache to use persistent volume
# This will be mounted from Coolify: /var/lib/docker/volumes/cardano-backend-cache:/usr/src/app/.npm-cache
RUN npm config set cache /usr/src/app/.npm-cache --global

# Install dependencies with npm (with caching)
# --prefer-offline: Use cached packages when available
# --no-audit: Skip audit for faster install
RUN npm ci --prefer-offline --no-audit --legacy-peer-deps

# ============================================
# STAGE 2: Build Application
# ============================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy dependencies from previous stage
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY package*.json ./

# Copy source code
COPY . .

# Remove test files to prevent build errors
RUN find . -type f \( -name "*.spec.ts" -o -name "*.test.ts" \) -delete

# Generate Prisma client (only client generator for speed)
RUN npx prisma generate

# Build application (test files removed)
RUN npm run build

# Prune dev dependencies to reduce final image size
RUN npm prune --production

# ============================================
# STAGE 3: Production Runtime
# ============================================
FROM node:22-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    gcompat \
    udev \
    xvfb \
    openssl \
    postgresql-libs

# Configure Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

WORKDIR /usr/src/app

# Copy production dependencies and built files
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/package*.json ./

# Create runtime directories with proper permissions
RUN mkdir -p uploads/inspection-photos pdfarchived

# Copy entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /usr/src/app

USER nestjs

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["/usr/src/app/entrypoint.sh"]
CMD ["node", "dist/main"]
