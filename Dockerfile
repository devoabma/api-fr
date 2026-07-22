# syntax=docker/dockerfile:1

FROM node:24-slim AS base
# libssl precisa estar presente ANTES do `pnpm install`, para o Prisma detectar
# a versão correta (libssl3 no Debian bookworm) e baixar o engine certo.
# Instalar só na etapa runtime faria o `prisma generate` (etapa deps) cair no
# fallback openssl-1.1.x, incompatível com a lib instalada aqui.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
# Fixa a versão do pnpm no build (evita o Corepack baixar o binário da
# internet a cada `docker run`/restart do container em produção). O cache
# fica em local fixo porque o usuário `node` (runtime) tem HOME diferente
# do `root` (build), então o cache padrão em $HOME não seria reaproveitado.
ENV COREPACK_HOME=/usr/local/share/corepack
RUN corepack enable && corepack prepare pnpm@11.13.0 --activate
WORKDIR /app

# ---- deps: instala dependências (dev + prod) e gera o Prisma Client ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- runtime: imagem final que sobe a API ----
FROM base AS runtime
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/generated ./generated
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && chown -R node:node /app
USER node

EXPOSE 3333

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["pnpm", "start"]
