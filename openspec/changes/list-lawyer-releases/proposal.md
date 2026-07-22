## Why

O roadmap (seção 4 — Advogados e Sessões) marcava como pendente "Buscar todas as sessões (paginado)". Funcionários e ADMIN precisam visualizar o histórico de liberações (sessões de uso) para acompanhar advogados em uso e consultar sessões passadas, com o mesmo recorte de visibilidade por papel já usado em `GET /rooms/get-all` (ADMIN vê tudo, MEMBER só vê as salas em que está vinculado).

## What Changes

- **Novo caso de uso `get-all-releases.ts`** (`GET /lawyers/get-all-releases/:roomId?`): rota autenticada (JWT de funcionário via `auth`).
  - `roomId` (param opcional, cuid2): filtra por uma sala específica.
  - Querystring opcional: `lawyer` (nome, busca parcial case-insensitive), `startDate`/`endDate` (intervalo por `startedAt`).
  - Visibilidade por papel via `getCurrentEmployee()`: ADMIN vê sessões de qualquer sala; MEMBER só vê sessões de salas em que está vinculado (`employeesRooms`) — mesmo padrão de [[rota-única-por-papel]].
  - Para cada sessão retorna também o `computer` usado (`id`, `description` — o modelo `Computers` não tem campo `name`), `usedMinutes` (tempo decorrido desde `startedAt`, usando `endedAt` ou o momento atual se ainda em andamento), `remainingMinutes` (`standardTime` da sala menos `usedMinutes`, nunca negativo) e `usedAllTime` (booleano).
- **`app.ts`**: adiciona `setNotFoundHandler` para retornar `404` com `{ message, route }` em rotas inexistentes, em vez do 404 padrão do Fastify.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/lawyers`.

## Capabilities

### Added Capabilities
- `lawyer`: listagem das sessões de liberação (histórico), com filtros e cálculo de tempo usado/restante por sessão.

## Impact

- Código novo: `src/http/core/lawyers/get-all-releases.ts`.
- Alterado: `src/http/routes/index.ts` (registro da rota), `src/http/app.ts` (`setNotFoundHandler`).
- Contrato HTTP: `GET /lawyers/get-all-releases/:roomId?` → `200` com array de sessões (`id`, `startDate`, `endDate`, `lawyer`, `room`, `computer`, `usedMinutes`, `remainingMinutes`, `usedAllTime`).
- Banco: apenas leitura em `computerSessions`/`computers`/`lawyers`/`rooms` já existentes; nenhuma migração.
- Documentação: `docs/ROADMAP.md` marca "Buscar todas as sessões" como `[~]` (paginação ainda pendente).
