# syntax = docker/dockerfile:1

ARG NODE_VERSION=24.7.0
FROM node:${NODE_VERSION}-slim AS deps

WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all dependencies (needed for Prisma CLI) and generate Prisma client
RUN npm ci && npx prisma generate

FROM node:${NODE_VERSION}-slim AS runner

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y openssl && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY . .

EXPOSE 8080
CMD ["node", "socket-server.js"]
