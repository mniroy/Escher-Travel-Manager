# ==========================================
# Stage 1: Build Frontend & Backend
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy project source files
COPY . .

# Build Vite static assets and bundled Express server
RUN npm run build

# Remove development dependencies to keep image light
RUN npm prune --omit=dev

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install curl/wget for healthcheck
RUN apk add --no-cache curl wget

# Create non-root user and set permissions
USER node

# Copy built application & production node_modules from builder
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=builder /app/dist-server ./dist-server

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start production server
CMD ["node", "dist-server/index.js"]
