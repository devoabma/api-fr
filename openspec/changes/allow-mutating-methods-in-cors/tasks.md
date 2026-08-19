## 1. Métodos permitidos no preflight

- [x] 1.1 Adicionar `methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']` ao registro do `@fastify/cors` em `app.ts`
- [x] 1.2 Comentar no código o default do plugin (só safelisted) e por que a falha é silenciosa do lado da API

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `npx biome check src/` sem issues
- [x] 2.3 Confirmar no código do `@fastify/cors@11.3.0` que o default é `'GET,HEAD,POST'`
- [x] 2.4 Reproduzir via `app.inject()` o preflight `OPTIONS` com `access-control-request-method: PATCH` **sem** a opção — responde `204` com `allow-methods: GET,HEAD,POST` (por isso o erro parecia não ser CORS)
- [x] 2.5 Repetir **com** a opção — `204` com `allow-methods: GET, HEAD, POST, PUT, PATCH, DELETE`, mantendo `allow-origin` e `allow-credentials: true`
- [x] 2.6 Confirmar que `GET /health` sem header `Origin` segue `200` nos dois cenários
- [ ] 2.7 Validar no navegador: editar um funcionário (`PUT`) e colocar um computador em manutenção (`PATCH`) pelo front, sem erro de rede

## 3. Documentação

- [x] 3.1 Atualizar a política de CORS em `docs/ROADMAP.md` (seção 0 — Infraestrutura)
- [x] 3.2 Documentar em `docs/DOC.md` os métodos aceitos no preflight
- [x] 3.3 Acrescentar linha na tabela de troubleshooting de `docs/DEPLOY.md` para o sintoma "só as rotas de escrita falham"
