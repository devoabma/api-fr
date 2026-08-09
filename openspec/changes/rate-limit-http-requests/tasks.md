## 1. Fundação do rate limit

- [x] 1.1 Adicionar `@fastify/rate-limit@^11.2.0` às dependências
- [x] 1.2 Criar `src/http/rate-limit.ts` concentrando a política (`globalRateLimit` + `rateLimits` por rota)
- [x] 1.3 Definir o teto global de 300/min por IP no hook `onRequest`
- [x] 1.4 Isentar `/health` e `/docs` via `allowList`, comparando o caminho sem query string
- [x] 1.5 Ligar `skipOnError: true` para que falha do store não derrube a API
- [x] 1.6 Registrar o plugin em `src/http/app.ts` antes de `appRoutes`

## 2. Contrato de erro `429`

- [x] 2.1 Criar `TooManyRequestsError` em `src/http/_errors/too-many-requests.ts`
- [x] 2.2 Tratar `TooManyRequestsError` no `errorHandler` global, respondendo `429`
- [x] 2.3 Criar `tooManyRequestsSchema` (`{ message, retryAfterInSeconds }`) em `error-responses.ts`
- [x] 2.4 Usar `errorResponseBuilder` devolvendo `TooManyRequestsError` com `Math.ceil(context.ttl / 1000)`
- [x] 2.5 Declarar `429: tooManyRequestsSchema` no schema das 6 rotas limitadas

## 3. Tetos por rota

- [x] 3.1 `POST /employees/session/auth` — 5 / 10 min por IP + CPF, em `preValidation`
- [x] 3.2 `POST /employees/password-recovery` — 5 / 15 min por IP, com `continueExceeding`
- [x] 3.3 `POST /employees/reset-password` — 10 / 10 min por IP
- [x] 3.4 `POST /lawyers/release-computer` — 10 / 1 min por IP + macCode, em `preValidation`
- [x] 3.5 `POST /lawyers/close-computer/:sessionId` — 30 / 1 min por IP
- [x] 3.6 `POST /printers/send-to-print/:macCode` — 15 / 5 min por IP + macCode
- [x] 3.7 Dar limitador próprio (60 / 1 min) ao `setNotFoundHandler`, via `preHandler` dentro de `.after()`

## 4. IP real do cliente

- [x] 4.1 Adicionar `TRUST_PROXY` ao schema do `env`, aceitando `"true"`, `"false"`, nº de hops ou lista de CIDRs
- [x] 4.2 Passar `trustProxy: env.TRUST_PROXY` na criação da instância Fastify
- [x] 4.3 Documentar a variável em `.env.example` com o valor de produção

## 5. Geração do código de recuperação

- [x] 5.1 Trocar `Math.random()` por `crypto.randomInt` em `generateRecoveryCode`

## 6. Correções encontradas na revisão

- [x] 6.1 Prefixar a chave de `release-computer` e `send-to-print` com o IP — a chave só com macCode permitia a qualquer um de fora estourar o balde de um terminal conhecido e trancar o advogado na frente da máquina
- [x] 6.2 Cortar a query string antes de comparar com a `allowList` — `/health?x=1` não era isento e contava no balde global

## 7. Verificação

- [x] 7.1 `npx tsc --noEmit` sem erros
- [x] 7.2 `pnpm exec biome check src/` sem issues
- [x] 7.3 Confirmar via `app.inject()` que `/health?probe=1` responde `200` nas 400 chamadas (allowList com query string)
- [x] 7.4 Confirmar que rota inexistente responde `404` 60 vezes e `429` em seguida
- [x] 7.5 Conferir o corpo do `429` (`{ message, retryAfterInSeconds: 60 }`) e os headers `retry-after` / `x-ratelimit-limit`
- [x] 7.6 Confirmar no login: 5 × `401` e depois `429`; trocar o CPF no mesmo IP abre balde novo
- [x] 7.7 Reproduzir o DoS de `send-to-print` com a chave antiga (terminal legítimo recebendo `429`) e confirmar que a chave com IP o elimina
- [x] 7.8 Confirmar que a rajada do atacante é barrada na 16ª chamada (teto de 15 / 5 min)

## 8. Documentação

- [x] 8.1 Documentar `TRUST_PROXY` em `docs/DEPLOY.md`: tabela dos quatro valores, o que cada um faz com `x-forwarded-for` forjado, teste de validação no primeiro deploy e plano B com `CF-Connecting-IP`
- [x] 8.2 Adicionar linha na tabela de troubleshooting do `docs/DEPLOY.md` para o sintoma de `TRUST_PROXY` errado
- [x] 8.3 Registrar o rate limit em `docs/ROADMAP.md` (seção 0 — Infraestrutura)
- [x] 8.4 Registrar o rate limit nos RNFs de `docs/DOC.md`
