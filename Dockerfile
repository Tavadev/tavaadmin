FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV AUTH_PATH=/data/baileys-auth \
    NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=256

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p /data/baileys-auth

EXPOSE 3000
CMD ["node", "index.js"]
