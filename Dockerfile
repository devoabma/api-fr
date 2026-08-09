# syntax=docker/dockerfile:1

FROM node:24-slim AS base
# libssl precisa estar presente ANTES do `pnpm install`, para o Prisma detectar
# a versão correta (libssl3 no Debian bookworm) e baixar o engine certo.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
# COREPACK_HOME precisa ser gravável pelo usuário node: se a versão do pnpm
# divergir do campo packageManager, o Corepack tenta baixar e escrever aqui.
ENV COREPACK_HOME=/usr/local/share/corepack
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable \
    && corepack prepare pnpm@11.18.0 --activate \
    && mkdir -p "$COREPACK_HOME" \
    && chown -R node:node "$COREPACK_HOME"
WORKDIR /app

# ---- deps: instala dependências (dev + prod) e gera o Prisma Client ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build: compila o TypeScript para JS via tsup ----
FROM deps AS build
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN pnpm build

# ---- runtime: imagem final, só com o necessário para rodar ----
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/generated ./generated
COPY --from=build --chown=node:node /app/build ./build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
# src/ é necessário em runtime porque `prisma db seed` roda via tsx
# (prisma/seed.ts) direto do TypeScript fonte, não do bundle em build/.
COPY src ./src
COPY --chmod=755 docker-entrypoint.sh ./

RUN chown node:node /app
USER node

EXPOSE 3333

# start-period generoso: migrations + seed rodam antes da porta 3333 abrir.
HEALTHCHECK --interval=10s --timeout=5s --start-period=90s --retries=3 \
    CMD node -e "fetch('http://localhost:3333/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "build/http/server.js"]