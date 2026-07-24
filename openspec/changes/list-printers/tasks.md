## 1. Listar impressões enviadas

- [x] 1.1 Criar `get-all.ts` com rota `GET /printers/get-all/:roomId?` (autenticada via `auth`)
- [x] 1.2 Filtrar por papel: ADMIN vê todas as salas (ou filtra via `roomId`); MEMBER só vê salas em que está vinculado
- [x] 1.3 Suportar filtros opcionais de querystring: `lawyer` (nome, contains case-insensitive), `startDate`/`endDate` (sobre `createdAt`)
- [x] 1.4 Retornar `lawyer`, `room` e `computer` resolvidos para cada impressão
- [x] 1.5 Registrar a rota em `routes/index.ts` sob o prefixo `/printers`

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `npx biome check` sem issues
