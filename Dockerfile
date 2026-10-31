# syntax=docker/dockerfile:1
# Alpine is smaller than slim; sharp 0.35.5 ships prebuilt Linux musl binaries.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build \
 && find dist -type f \( -name '*.map' -o -name '*.d.ts' \) -delete

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --no-audit --no-fund
# Nothing below is loaded at run time: type declarations, source maps, docs, and the compiler that came in transitively.
RUN rm -rf node_modules/typescript node_modules/@types \
 && find node_modules -type f \( -name '*.map' -o -name '*.md' -o -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' \) -delete
RUN node -e "require('sharp')({create:{width:1,height:1,channels:3,background:'#ffffff'}}).webp().toBuffer().then(() => console.log('sharp prebuilt binary OK')).catch(error => { console.error(error); process.exit(1); })"

FROM deps AS migrate
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY certs ./certs
USER node
CMD ["npm", "run", "db:migrate"]

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# A 384 MiB V8 old-space cap leaves room in 512 MiB for native code and buffers.
ENV NODE_OPTIONS=--max-old-space-size=384
COPY --from=build /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY certs ./certs
RUN mkdir -p storage-data && chown node:node storage-data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const req = require('node:http').get({host:'127.0.0.1',port:process.env.PORT || 3000,path:'/health'}, res => { res.resume(); process.exit(res.statusCode === 200 ? 0 : 1); }); req.setTimeout(4000, () => req.destroy()); req.on('error', () => process.exit(1));"
CMD ["node", "dist/main"]
