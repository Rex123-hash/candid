# Candid production image for Google Cloud Run.
# Secrets are never baked in: they arrive as environment variables at runtime.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0
RUN addgroup -S candid && adduser -S candid -G candid
COPY --from=build --chown=candid:candid /app/.next/standalone ./
COPY --from=build --chown=candid:candid /app/.next/static ./.next/static
COPY --from=build --chown=candid:candid /app/public ./public
USER candid
EXPOSE 8080
CMD ["node", "server.js"]
