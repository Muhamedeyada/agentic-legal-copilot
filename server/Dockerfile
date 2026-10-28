# syntax=docker/dockerfile:1
# Multi-stage API image. Corpus is copied in; leave OPENAI_API_KEY empty for mock mode.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
# better-sqlite3 is native: compile it if no prebuilt musl binary matches this Node version.
RUN apk add --no-cache python3 make g++ && npm ci

FROM deps AS build
COPY server ./server
RUN npm run build -w server

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN apk add --no-cache --virtual .native-build python3 make g++ \
  && npm ci --omit=dev \
  && npm cache clean --force \
  && apk del .native-build
COPY --from=build /app/server/dist ./server/dist
COPY data/corpus ./data/corpus
# SQLite database (runs, approvals, audit trail, uploads). Mount a volume here to keep it.
VOLUME /app/data/runtime
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
WORKDIR /app/server
CMD ["node", "dist/main.js"]
