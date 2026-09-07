FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm ci
RUN DATABASE_URL=postgresql://wikirace@postgres:5432/wikirace npm run prisma:generate && npm run build
ENV HOST=0.0.0.0 PORT=4000 NODE_ENV=production
EXPOSE 4000
CMD ["node", "apps/api/dist/server.js"]
