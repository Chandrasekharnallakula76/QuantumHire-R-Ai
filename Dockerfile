# ─────────────────────────────────────────────────────────────────────────────
# CognitiveScreen AI — Frontend Dockerfile
# Stage 1: Build React/Vite app
# Stage 2: Serve with nginx
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (separate layer for cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Copy face-api model weights from npm package into public/models for browser loading
RUN mkdir -p public/models && cp node_modules/@vladmandic/face-api/model/* public/models/

# Pass the backend URL at build time (override with --build-arg)
ARG VITE_API_URL=https://cognitivescreen-backend-610993990979.us-east4.run.app
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config — handles SPA routing (hash-based, so minimal config needed)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]