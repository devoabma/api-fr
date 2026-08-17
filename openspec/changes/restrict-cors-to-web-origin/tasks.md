## 1. Política de CORS

- [x] 1.1 Trocar `origin: '*'` por `origin: env.WEB_URL` no registro do `@fastify/cors`
- [x] 1.2 Ligar `credentials: true`, sem o qual o navegador não anexa nem aceita o cookie de sessão
- [x] 1.3 Comentar no `app.ts` por que a origem precisa ser explícita quando há credenciais

## 2. Endurecimento do `WEB_URL`

- [x] 2.1 Criar `webUrlSchema` em `src/http/env.ts` com `z.url()` — valor sem esquema passa a derrubar o boot
- [x] 2.2 Cortar barras finais no `transform`, já que o header `Origin` nunca as tem e a comparação é byte a byte
- [x] 2.3 Documentar no schema as duas exigências que a variável atende (CORS e link de e-mail)

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `pnpm exec biome check src/` sem issues
- [x] 3.3 Confirmar via `app.inject()` que `WEB_URL='https://sala.oabma.org.br/'` chega em `env` sem a barra final
- [x] 3.4 Confirmar que o preflight da origem correta responde `204` com `access-control-allow-origin` exato e `access-control-allow-credentials: true`
- [x] 3.5 Confirmar que o preflight de origem estranha recebe o `allow-origin` da origem legítima — quem bloqueia é o navegador, não a API
- [x] 3.6 Confirmar que requisição sem header `Origin` (`GET /health`) segue respondendo `200`, provando que desktop e Insomnia não regridem
- [x] 3.7 Confirmar que `WEB_URL="sala.oabma.org.br"` (sem esquema) derruba o boot

## 4. Documentação

- [x] 4.1 Registrar a política de CORS em `docs/ROADMAP.md` (seção 0 — Infraestrutura)
- [x] 4.2 Documentar em `docs/DOC.md` o que o front web precisa fazer (`credentials: 'include'`) e por que o desktop não é afetado
- [x] 4.3 Documentar `WEB_URL` em `docs/DEPLOY.md`: formato exigido, sintoma da barra final e linha na tabela de troubleshooting
- [x] 4.4 Anotar em `.env.example` que o valor é a origem exata do front, sem barra final
