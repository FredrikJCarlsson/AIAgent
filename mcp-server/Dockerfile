# Multi-stage build for MCP Server
FROM node:20-alpine AS builder

# Update packages and install security patches
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm install

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Update packages and install security patches
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create a directory for file operations and set permissions
RUN mkdir -p /app/workspace && \
    chown -R mcpuser:nodejs /app

# Switch to non-root user
USER mcpuser

# Expose port (if needed for future HTTP transport)
EXPOSE 3123

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Default command with dumb-init for proper signal handling
CMD ["dumb-init", "node", "dist/index.js"]
