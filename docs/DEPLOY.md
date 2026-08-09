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
`NODE_ENV`, `API_PORT`, `TIMEZONE`, `TRUST_PROXY`, `WEB_URL`, `DOMAIN_URL`,
`TOKEN_COOKIE_NAME`, `CPF_ADMIN`, `PASSWORD_ADMIN`, `EMAIL_ADMIN`,
`ALLOW_DEFAULTING_LAWYERS` (opcional — ver seção abaixo),
`DATABASE_URL`, `RESEND_API_KEY`, `JWT_SECRET`, `PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `API_PROTHEUS_DATA_URL`.

`TIMEZONE` é o fuso da seccional (IANA, ex: `America/Fortaleza`). Ele governa o
cálculo de tempo das sessões e o horário dos jobs agendados — não o fuso do
servidor. Se não for definido, cai no default `America/Fortaleza`; se vier um
valor inválido, a API não sobe (falha no boot em vez de errar horário calado).

`DATABASE_URL` aponta pra um Postgres externo (Neon), então não depende de
rede interna do Docker — funciona igual em dev e em produção.

### `ALLOW_DEFAULTING_LAWYERS` — liberação geral por determinação da OAB

Normalmente **não existe** nas variáveis do Coolify (ausente = `false` = só
adimplente libera computador). Ela só entra em cena quando a diretoria
determina liberação geral, adimplentes e inadimplentes.

Para ligar: criar a variável com o valor `true` e **reiniciar** o container
(ela é lida uma única vez, no boot). Não precisa de build nem de migração.
Para desligar: apagar a variável (ou pôr `false`) e reiniciar de novo.

| Valor | Efeito |
| --- | --- |
| ausente / `false` | ✅ operação normal — inadimplente recebe `400` |
| `true` | ⚠️ inadimplente libera computador |
| `1`, `sim`, `yes`, `on` | ✅ tratado como `false` — só a string `true` liga |

A última linha é proposital: um valor ambíguo lido como `true` liberaria
inadimplentes sem ninguém ter pedido e passaria meses despercebido, enquanto
lido como `false` alguém reclama no mesmo dia que a determinação não pegou.

A exceção suspende **apenas** a pendência financeira. Advogado(a) com registro
fora das situações liberadas (inativo, cancelado) continua barrado, e as demais
regras — conferência de CPF/OAB/nascimento, cota diária, sala ativa,
computador livre — seguem valendo.

Enquanto estiver ligada, todo boot imprime um aviso vermelho nos logs do
container. É o único ponto do sistema que anuncia a exceção: vale marcar no
calendário a data em que a determinação vence, porque a variável não expira
sozinha.

### `TRUST_PROXY` — o valor muda entre dev e produção

**Em produção precisa ser `loopback,uniquelocal`.** É a única variável cujo
valor local (`false`) está errado aqui, e o erro é silencioso: não quebra o
boot, não gera log — só faz o rate limit contar todo mundo junto.

O motivo é a arquitetura do topo deste documento. Quem abre a conexão TCP com o
container é sempre o **Traefik**, no mesmo IP da rede interna do Docker. O IP
real do cliente vem no header `X-Forwarded-For`, que é uma **lista** onde cada
proxy anexa à direita quem falou com ele:

```
X-Forwarded-For: 203.0.113.50, 172.18.0.9
                 └─ cliente     └─ cloudflared
                    (posto pela Cloudflare)
```

O que cada valor faz, com essa cadeia (`req.ip` que o rate limit enxerga):

| `TRUST_PROXY` | Normal | Se o cliente forjar o header | Veredito |
| --- | --- | --- | --- |
| `false` | `172.18.0.9` (Traefik) | `172.18.0.9` | ❌ todos no mesmo balde |
| `true` | `203.0.113.50` | **`8.8.8.8`** | ❌ spoofável |
| `1` | `172.18.0.9` | `172.18.0.9` | ❌ hop errado |
| `2` | `203.0.113.50` | `203.0.113.50` | ⚠️ funciona, mas frágil |
| `loopback,uniquelocal` | `203.0.113.50` | `203.0.113.50` | ✅ |

- **`false`** ignora o header: toda requisição do planeta chega com o IP do
  Traefik. O teto global de 300/min vira 300/min para a API inteira, e
  `password-recovery` vira 5 pedidos a cada 15 min **no total**. Pior: qualquer
  um de fora derruba o acesso de todos gastando o balde compartilhado.
- **`true`** confia na lista inteira e pega o item mais à esquerda — justamente
  a parte que o cliente escreve. A Cloudflare **não apaga** o que o cliente
  mandou, ela anexa o IP real depois (`8.8.8.8, 203.0.113.50, 172.18.0.9`).
  Trocando o header a cada requisição, o atacante ganha um balde novo sempre.
- **`2`** conta hops da direita pra esquerda e acerta hoje, mas quebra calado no
  dia em que entrar ou sair um proxy do caminho.
- **`loopback,uniquelocal`** lê da direita pra esquerda descartando faixas
  privadas (`10.x`, `172.16-31.x`, `192.168.x`, `127.x`) e para no primeiro IP
  público — o real. A mentira do cliente fica à esquerda e é ignorada, e o
  valor não depende de contar hops.

Em desenvolvimento fica `false`: sem proxy na frente, o IP da conexão já é o
verdadeiro. Efeito colateral local: tudo vem de `127.0.0.1`, então front,
Insomnia e app desktop dividem o mesmo balde (reiniciar a API zera os
contadores — o store é em memória).

> Como conferir no primeiro deploy: a tabela acima assume o comportamento
> padrão do cloudflared. Para validar com tráfego real, estoure de propósito um
> limite barato (ex.: 61 chamadas em rotas inexistentes, teto de 60/min) de duas
> redes diferentes — celular no 4G e máquina na rede da OAB. Se as duas caírem
> no `429` juntas, o IP não está chegando e o `TRUST_PROXY` precisa de ajuste.
> Se cada uma tiver seu próprio contador, está correto.
>
> Plano B, se o `X-Forwarded-For` não trouxer o IP público: a Cloudflare também
> manda `CF-Connecting-IP`, com o IP do cliente puro, sem lista. Nesse caso o
> ajuste é no `ipKey()` de `src/http/rate-limit.ts`. Só é seguro porque a origem
> não é acessível fora do túnel — se alguém alcançasse o container direto, esse
> header seria forjável.

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
| Usuários tomando `429` sem motivo / login e recuperação de senha bloqueados pra todo mundo ao mesmo tempo | `TRUST_PROXY` em `false` (ou ausente) em produção: o rate limit está contando todos os clientes como um IP só. Ver seção acima. |
| Determinação de liberação geral não pegou — inadimplente continua recebendo `400` | `ALLOW_DEFAULTING_LAWYERS` com valor diferente da string `true` (ex: `1`, `sim`), ou container não reiniciado depois de criar a variável. Confirmar o aviso vermelho nos logs do boot. |
| Inadimplente liberando computador sem determinação vigente | `ALLOW_DEFAULTING_LAWYERS=true` esquecida de uma determinação anterior. Apagar a variável e reiniciar. |
