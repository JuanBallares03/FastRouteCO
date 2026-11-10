FROM node:22-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY web/package.json web/package.json
COPY mobile/package.json mobile/package.json
RUN pnpm install --frozen-lockfile --filter backend...
COPY backend ./backend
RUN pnpm --filter backend prisma:generate && pnpm --filter backend build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/index.js"]
