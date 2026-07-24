## Why

O roadmap (seção 5) lista "Listar arquivos pendentes da(s) sala(s) do funcionário" como pendente. O caso de uso `send-to-print` já cria os registros em `printers`, mas não havia forma de consultá-los — o funcionário vinculado à sala precisa ver os documentos enviados pelos advogados para providenciar a impressão, no mesmo recorte de visibilidade por papel já usado em `GET /rooms/get-all` e `GET /lawyers/get-all-releases`.

## What Changes

- **Novo caso de uso `get-all.ts`** (`GET /printers/get-all/:roomId?`): rota autenticada (JWT de funcionário via `auth`), no mesmo estilo de `get-all-releases.ts`.
  - `roomId` (param opcional, cuid2): filtra por uma sala específica.
  - Querystring opcional: `lawyer` (nome, busca parcial case-insensitive), `startDate`/`endDate` (intervalo por `createdAt`).
  - Visibilidade por papel via `getCurrentEmployee()`: ADMIN vê impressões de qualquer sala; MEMBER só vê impressões das salas em que está vinculado (`employeesRooms`) — mesmo padrão de [[rota-única-por-papel]].
  - Cada item retorna `id`, `fileUrl`, `createdAt`, `lawyer` (`id`, `name`), `room` (`id`, `name`) e `computer` (`id`, `description`).
  - Não há filtro por status de download/impressão nesta entrega — o modelo `Printers` ainda não possui `downloaded_at`/`printed_at` (item opcional do roadmap, fora de escopo aqui). Todos os registros são retornados como pendentes.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/printers`.

## Capabilities

### Added Capabilities
- `printer`: listagem das impressões enviadas, com filtros e recorte de visibilidade por papel (ADMIN todas, MEMBER apenas das salas vinculadas).

## Impact

- Código novo: `src/http/core/printers/get-all.ts`.
- Alterado: `src/http/routes/index.ts` (registro da rota).
- Contrato HTTP: `GET /printers/get-all/:roomId?` → `200` com `{ printers: [...] }`, cada item com `id`, `fileUrl`, `createdAt`, `lawyer`, `room`, `computer`.
- Banco: apenas leitura no modelo `Printers` já existente; nenhuma migração.
- Documentação: `docs/ROADMAP.md` marca "Listar arquivos pendentes da(s) sala(s) do funcionário" como concluído.
