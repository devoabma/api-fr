# Deploy — Coolify + Cloudflare Tunnel

> Runbook de como a API vai pro ar em produção. Servidor Coolify roda localmente
> (`192.168.1.4`) e é exposto ao público via Cloudflare Tunnel no domínio `hit.dev.br`.

---

## Arquitetura

```
Internet → Cloudflare (TLS) → cloudflared (túnel local)
         → coolify-proxy (Traefik, host 192.168.1.4:80/443)
         → container da API (rede interna "coolify", porta 3333)
```

- **Traefik** (`coolify-proxy`) é quem faz o roteamento por `Host` header entre as
  aplicações do Coolify — não expõe cada app numa porta própria do host.
- O dashboard do Coolify (`coolify.hit.dev.br`) é exceção: roda com porta própria
  mapeada (`8000:8080`), fora do Traefik.
- `api-fr.hit.dev.br` (assim como `n8n`, `crm`, `supabase`) passa pelo Traefik.

---

## Dockerfile

Build multi-stage (`node:24-slim`), 3 estágios:

1. **base** — instala `openssl` (Prisma precisa disso presente *antes* do
   `pnpm install` pra detectar o engine certo — senão cai no fallback
   `openssl-1.1.x`, incompatível) e fixa `pnpm@11.13.0` via Corepack.
2. **deps** — `pnpm install --frozen-lockfile` (dev + prod) e `prisma generate`
   (via `postinstall`).
3. **build** — roda `pnpm build` (tsup), gera `build/http/server.js` (ESM).
4. **runtime** — imagem final. Copia `node_modules`, `generated/` (Prisma
   Client), `build/`, **e também** `prisma.config.ts`, `tsconfig.json` e `src/`.

### Por que `src/`, `tsconfig.json` e `prisma.config.ts` também vão pro runtime

O `build/` (bundle tsup) só cobre o **servidor**. O entrypoint roda
`pnpm db:deploy` (`prisma migrate deploy && prisma db seed`) **antes** de subir
o servidor, e isso depende de:

- **`prisma.config.ts`** — desde o Prisma 7, `schema.prisma` não tem mais
  `url` no bloco `datasource` (só `provider = "postgresql"`). Quem resolve a
  URL é `prisma.config.ts` via `env('DATABASE_URL')`. Sem esse arquivo na
  imagem, `prisma migrate deploy` falha com
  `The datasource.url property is required in your Prisma config file`.
- **`tsconfig.json` + `src/`** — `prisma db seed` roda `tsx prisma/seed.ts`
  direto do TypeScript fonte (não do bundle), e `seed.ts` importa via alias
  `@/*` (`@/http/env`, `@/lib/resend` etc.), resolvido pelo `paths` do
  `tsconfig.json`. Sem `src/` na imagem, o `tsx` não acha os módulos.

Isso deixa a imagem de runtime maior do que um Node "puro" rodando só o
bundle, mas é o trade-off de reaproveitar `tsx` para migrations/seed em vez de
compilar o script de seed separadamente.

### `docker-entrypoint.sh`

```sh
pnpm run db:deploy   # prisma migrate deploy && prisma db seed
exec "$@"             # CMD: pnpm start → node build/http/server.js
```

Roda a cada boot do container. `migrate deploy` é idempotente (só aplica
migrations pendentes) e o seed do admin é idempotente por guard
(`prisma/seed.ts` — não recria se o e-mail já existir).

---

## Configuração no Coolify

1. **Resource** → repositório `devoabma/api-fr`, branch `main`.
2. **Build Pack**: `Dockerfile` (não Nixpacks).
3. **Ports Exposes**: `3333` (bate com `EXPOSE 3333` do Dockerfile e com o
   label do Traefik `loadbalancer.server.port=3333`).
4. **Port Mappings**: vazio — não precisa, o Traefik acessa via rede Docker
   interna (`caddy_ingress_network=coolify` / labels Traefik nas configs do
   app), não por porta publicada no host.
5. **Domains**: `http://api-fr.hit.dev.br`.

### Environment Variables — Buildtime vs Runtime

O Dockerfile **não usa nenhuma env var no build** (só `pnpm install` +
`pnpm build`, sem `ARG` nenhum nos estágios `deps`/`build`). Por isso, **toda**
variável deve ficar marcada só como **"Available at Runtime"**, com
**"Available at Buildtime" desmarcado**.

> ⚠️ Se "Available at Buildtime" ficar marcado, o Coolify injeta a variável
> como `ARG` no Dockerfile gerado — e o valor fica **gravado em texto puro**
> nas camadas da imagem (visível em `docker history` / no próprio log de
> build do Coolify). Isso já aconteceu uma vez em deploy anterior com
> `JWT_SECRET`, `PASSWORD_ADMIN`, `RESEND_API_KEY`,
> `SUPABASE_SERVICE_ROLE_KEY` e a senha do `DATABASE_URL` expostos no log.
> Corrigido desmarcando o toggle pra cada variável.

Variáveis necessárias (mesmas do `.env.example`, com valores de produção):
`NODE_ENV`, `API_PORT`, `WEB_URL`, `DOMAIN_URL`, `TOKEN_COOKIE_NAME`,
`CPF_ADMIN`, `PASSWORD_ADMIN`, `EMAIL_ADMIN`, `DATABASE_URL`,
`RESEND_API_KEY`, `JWT_SECRET`, `PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `API_PROTHEUS_DATA_URL`.

`DATABASE_URL` aponta pra um Postgres externo (Neon), então não depende de
rede interna do Docker — funciona igual em dev e em produção.

### Health check

A API expõe `GET /health` (sem auth, sem tocar no banco — só confirma que o
processo Node/Fastify está respondendo). O Dockerfile já define um
`HEALTHCHECK` usando o `fetch` nativo do Node (sem precisar de `curl`/`wget`
na imagem):

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://localhost:3333/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

Isso é o suficiente pro Coolify parar de mostrar `Running (unknown)` e passar
a reportar `Healthy`/`Unhealthy` de verdade — não precisa configurar nada a
mais na aba **Healthcheck** do Coolify, ele lê o `HEALTHCHECK` da imagem
automaticamente.

---

## Cloudflare Tunnel

Rota publicada em **Networks → Tunnels & Mesh → coolify → Published
application routes**:

| Campo | Valor |
| --- | --- |
| Hostname | `api-fr.hit.dev.br` |
| Type | `HTTP` |
| Service URL | `192.168.1.4:80` |

> ⚠️ **Não usar a porta `8000`** — essa é a porta do dashboard do Coolify
> (`coolify` container, mapeado `8000:8080`), não do Traefik. Apontar a rota
> pra `8000` faz o domínio da API cair na tela de login do Coolify. A porta
> certa pra qualquer app hospedado no Coolify (roteado pelo Traefik) é `80`
> (ou `443` se preferir HTTPS na origem).

---

## Checklist de um novo deploy

- [ ] Alterações commitadas e pushadas em `main`.
- [ ] No Coolify: **Deploy**.
- [ ] Acompanhar o log: build (se o commit mudou) → `docker-entrypoint.sh`
      (`No pending migrations` ou lista de migrations aplicadas + seed) →
      `Servidor iniciado com sucesso!`.
- [ ] Conferir status do container: `Running`/`Healthy`, não `Restarting`.
- [ ] Testar `https://api-fr.hit.dev.br/docs` (deve retornar `200` e abrir o
      Scalar).

## Troubleshooting

| Sintoma | Causa provável |
| --- | --- |
| Container em `Restarting` em loop | Ver `docker logs <container>` — geralmente erro do `prisma migrate deploy`/`db seed` no entrypoint. |
| `The datasource.url property is required...` | `prisma.config.ts` não está na imagem de runtime (ver seção Dockerfile acima). |
| `Cannot find module '@/...'` no seed | `src/` ou `tsconfig.json` faltando na imagem de runtime. |
| Domínio público cai na tela do Coolify em vez da API | Rota do Cloudflare Tunnel apontando pra porta `8000` em vez de `80`. |
| Secrets aparecem em texto puro no log de build do Coolify | Variável marcada como "Available at Buildtime" — desmarcar, deixar só "Available at Runtime". |
