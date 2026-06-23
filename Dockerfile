# Multi-stage build: Vite SPA built with Node, served by Nginx.
# VITE_* values are inlined into the bundle at build time; the runtime image
# has no Node and no secrets baked into its layers.

FROM node:22-alpine AS base

# Dependencies stage - install all dependencies for building
FROM base AS deps
WORKDIR /app
# libc6-compat is needed for native binaries (lightningcss / Tailwind v4) on Alpine
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN \
  if [ -f package-lock.json ]; then npm ci; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Builder stage - build the Vite SPA. VITE_* values must be present at build time
# because Vite inlines them into the client bundle. They arrive via a BuildKit
# secret mount (a .env file) so they never become a persistent layer / image arg.
FROM base AS builder
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN --mount=type=secret,id=vite_env,target=/app/.env.production.local \
    npm run build && \
    if [ ! -f "dist/client/_shell.html" ]; then \
      echo "ERROR: dist/client/_shell.html not found after build!" && exit 1; \
    fi

# Production image - nginx serving the static SPA
FROM nginx:alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Wipe the stock nginx welcome page so it can't shadow the SPA shell.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/dist/client /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
