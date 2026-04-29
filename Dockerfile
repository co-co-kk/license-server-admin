# Dockerfile for license-server-admin
# Node 22+ for native --experimental-strip-types support
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./

# Install native build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

RUN npm install --omit=dev

# Copy source files
COPY . .

# Build React frontend (Vite outputs to dist/)
RUN npm run build

# --- Production image ---
FROM node:22-alpine

WORKDIR /app

# Copy built dependencies and source files
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY server.ts ./
COPY package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/license.db

EXPOSE 3000

CMD ["node", "--experimental-strip-types", "server.ts"]
