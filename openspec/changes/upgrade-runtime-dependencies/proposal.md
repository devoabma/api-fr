## Why

O projeto entrou em produção com o lockfile congelado em versões de janeiro/fevereiro e, desde então, Fastify, Prisma, os plugins `@fastify/*`, o SDK do Supabase e o Resend publicaram correções de bug e de segurança. Manter a defasagem tem dois custos: a API deixa de receber patches do runtime que sustenta o WebSocket dos Desktops e o pool de conexões do Postgres, e cada dia de atraso torna o salto futuro mais arriscado — quanto maior a distância entre versões, menor a chance de o upgrade ser trivial. Este é um incremento de manutenção: sobe todo o grafo de dependências dentro das faixas semver já declaradas, sem tocar em regra de negócio.

## What Changes

- **Runtime HTTP**: `fastify` 5.9.0 → 5.12.0; `@fastify/cookie` 11.0.2 → 11.1.2; `@fastify/cors` 11.2.0 → 11.3.0; `@fastify/jwt` 10.1.0 → 10.2.2; `@fastify/multipart` 10.0.0 → 10.1.1; `@fastify/swagger` 9.7.0 → 9.8.1.
- **Banco**: `prisma`, `@prisma/client` e `@prisma/adapter-pg` 7.8.0 → 7.9.1; `pg` 8.22.0 → 8.23.0 (`@types/pg` 8.20.0 → 8.23.1).
- **Integrações**: `@supabase/supabase-js` 2.110.0 → 2.112.3; `resend` 6.17.1 → 6.20.0; `axios` 1.18.1 → 1.19.0; `dayjs` 1.11.21 → 1.11.23.
- **Documentação e e-mails**: `@scalar/fastify-api-reference` 1.62.4 → 1.65.1; `react-email` e `@react-email/ui` 6.6.6 → 6.9.2; `react`/`react-dom` 19.2.7 → 19.2.8.
- **Ferramentas**: `tsx` 4.23.0 → 4.23.12 e os `@types/*` de Node e React.
- **`.gitignore`**: remove um comentário redundante acima de `.env`; a regra de ignorar o arquivo continua idêntica.
- Nenhuma linha de `src/` muda. Não há alteração de contrato HTTP, de schema Prisma nem de comportamento observável — por isso esta change **não carrega delta de spec**.

## Capabilities

Nenhuma capacidade é adicionada, modificada ou removida. Change de manutenção (`chore`).

## Impact

- Código: `package.json`, `pnpm-lock.yaml` e `.gitignore`. Nenhum arquivo em `src/`.
- Banco: nenhuma migração. O `prisma generate` do `postinstall` regenera o client 7.9.1 em `/generated/prisma` no deploy.
- Deploy: a esteira já roda `pnpm install --frozen-lockfile`; o lockfile atualizado é a única entrada nova. Vale conferir a versão do Prisma Client gerada no servidor após o primeiro deploy.
- Risco: baixo — todos os saltos são patch/minor dentro das faixas `^` já declaradas, sem major.
