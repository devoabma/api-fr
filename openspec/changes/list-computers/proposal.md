## Why

Com o cadastro de computadores entregue (`create-computer`), o ADMIN precisa visualizar os computadores existentes para conferir e gerir o parque de máquinas. Faltava um endpoint de listagem, e o app desktop/front web depende dele para montar telas de administração e localizar uma máquina específica por sala ou por descrição.

## What Changes

- **`get-all.ts`** (`GET /computers/get-all`): novo endpoint, restrito a ADMIN, que retorna os computadores com `id`, `macCode`, `number`, `description`, `inUse`, `maintenance` e a `room` vinculada (`id`, `name`).
- Filtros opcionais via **query string**: `roomId` (cuid) filtra por sala e `description` faz busca parcial **case-insensitive** (`contains` + `mode: 'insensitive'`). Sem filtros, retorna todos.
- Rota registrada no roteador com prefixo `/computers`.

## Capabilities

### Added Capabilities
- `computer`: listar computadores (`GET /computers/get-all`), restrito a ADMIN, com filtros opcionais por sala e por descrição.

## Impact

- Código novo: `src/http/core/computers/get-all.ts`; registro em `src/http/routes/index.ts`.
- Banco: usa os modelos `Computers` e `Rooms` já existentes; nenhuma migração.
- Contrato HTTP: `GET /computers/get-all` → `200` com `{ computers: [...] }`; aceita `?roomId=` e `?description=`; sem JWT/permissão → `401`.
- Documentação: `docs/ROADMAP.md` marca a listagem de computadores como entregue.
