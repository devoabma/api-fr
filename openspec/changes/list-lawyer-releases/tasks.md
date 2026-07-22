## 1. Listar sessões de liberação

- [x] 1.1 Criar `get-all-releases.ts` com rota `GET /lawyers/get-all-releases/:roomId?` (autenticada via `auth`)
- [x] 1.2 Filtrar por papel: ADMIN vê todas as salas (ou filtra via `roomId`); MEMBER só vê salas em que está vinculado
- [x] 1.3 Suportar filtros opcionais de querystring: `lawyer` (nome, contains case-insensitive), `startDate`/`endDate`
- [x] 1.4 Calcular `usedMinutes`, `remainingMinutes` (nunca negativo) e `usedAllTime` por sessão
- [x] 1.5 Registrar a rota em `routes/index.ts` sob o prefixo `/lawyers`

## 2. Infraestrutura

- [x] 2.1 Adicionar `setNotFoundHandler` em `app.ts` (`404` com `{ message, route }`)

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check` sem issues
