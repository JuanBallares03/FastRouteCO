FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY web/package.json web/package.json
COPY mobile/package.json mobile/package.json
RUN pnpm install --frozen-lockfile --filter web...
COPY web ./web
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_MAP_STYLE_URL
ARG VITE_WOMPI_PUBLIC_KEY
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}
ENV VITE_MAP_STYLE_URL=${VITE_MAP_STYLE_URL}
ENV VITE_WOMPI_PUBLIC_KEY=${VITE_WOMPI_PUBLIC_KEY}
RUN pnpm --filter web build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv
