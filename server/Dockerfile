FROM node:20-alpine

WORKDIR /app

# Install dependencies (context is project root, Dockerfile is in server/)
COPY server/package*.json ./
RUN npm ci --only=production

# Copy server source
COPY server/ .

# Copy mobile PWA dist (mpos/dist → /app/mobile-dist)
COPY mpos/dist/ ./mobile-dist/

# Environment (non-sensitive only; secrets come from Railway env vars at runtime)
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "src/index.js"]
