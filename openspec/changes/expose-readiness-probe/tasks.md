## 1. Sonda de prontidão

- [x] 1.1 Criar `isDatabaseReachable()` em `src/http/app.ts`, sondando o banco com `prisma.$queryRaw\`SELECT 1\``
- [x] 1.2 Definir `DATABASE_PROBE_TIMEOUT_IN_MS = 3_000` como constante nomeada, em vez de número solto no `race`
- [x] 1.3 Correr sonda contra timeout com `Promise.race`, garantindo que **as duas pontas resolvem** (`.then(ok, err)`) para o perdedor não virar `unhandledRejection`
- [x] 1.4 Aplicar `unref()` no timer, para um timeout pendente não segurar o processo no encerramento

## 2. Rota `GET /ready`

- [x] 2.1 Declarar a rota **dentro do `.after()`** do registro do rate limit — em nível de raiz ela não seria vista pelo hook `onRoute` do plugin e ficaria sem teto
- [x] 2.2 Dar teto próprio de 60/min por IP via `config.rateLimit` (e não `preHandler`, que só é necessário no 404 por ele não ser rota registrada)
- [x] 2.3 Responder `200 { status: 'ok', database: 'up' }` quando a sonda passa
- [x] 2.4 Responder `503 { status: 'error', database: 'down' }` quando a sonda falha ou estoura o tempo

## 3. Preservar a vivacidade

- [x] 3.1 Manter `GET /health` sem tocar no banco e sem teto — quem o consome é o `HEALTHCHECK`, e para o orquestrador "não saudável" significa reiniciar o contêiner
- [x] 3.2 Manter o `HEALTHCHECK` do Dockerfile apontando para `/health`, sem alteração
- [x] 3.3 Documentar em docstring por que `/health` não deve crescer e para onde vai quem quer saber de prontidão

## 4. Verificação

- [x] 4.1 `GET /ready` com banco no ar → `200 {"status":"ok","database":"up"}`
- [x] 4.2 65 chamadas seguidas a `/ready` → primeiro `429` na 61ª (teto próprio valendo)
- [x] 4.3 `GET /health` → `200` sem nenhum header `x-ratelimit-*` (segue isento)
- [x] 4.4 `GET /ready` com `DATABASE_URL` inalcançável → `503` em 3.04s, não nos 15s do `connectionTimeoutMillis`
- [x] 4.5 Confirmar ausência de `unhandledRejection` após o timeout, com listener dedicado
- [x] 4.6 Confirmar CORS a partir de `WEB_URL`: `GET` com `access-control-allow-origin` + `credentials: true`, preflight `OPTIONS` em `204`
- [x] 4.7 Confirmar que a rota inexistente segue com `404` e teto próprio de 60/min
- [x] 4.8 `tsc --noEmit`, `biome check` e `pnpm build` limpos

## 5. Documentação

- [x] 5.1 Reescrever a seção **Health check** de `docs/DEPLOY.md` separando vivacidade de prontidão, com o porquê de o `HEALTHCHECK` não migrar
- [x] 5.2 Adicionar RNF em `docs/DOC.md` descrevendo as duas rotas e o que o painel deve fazer com o `503`
- [x] 5.3 Incluir `/ready` na tabela de tetos de `docs/DOC.md` e corrigir a frase de isenção
- [x] 5.4 Marcar o item em `docs/ROADMAP.md` (seção 0 — Infraestrutura / Fundação)
