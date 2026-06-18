## Why

Após a criação de salas (change `create-room`), o roadmap (seção 2 — Salas) ainda lista "Buscar todas as salas" e "Editar sala" como pendentes. Sem esses casos de uso, o ADMIN não consegue visualizar o catálogo de salas (com seus computadores) nem corrigir dados de uma sala já cadastrada. Esta change entrega a listagem e a edição de salas, ambas restritas a ADMIN.

## What Changes

- **Novo caso de uso `get-all.ts`** (`GET /rooms/get-all`): rota protegida que recupera todas as salas cadastradas, ordenadas por `createdAt` desc, incluindo os computadores vinculados a cada sala.
- **Novo caso de uso `update.ts`** (`PATCH /rooms/update/:id`): rota protegida que atualiza uma sala por `id`. Edição parcial — o ADMIN envia apenas os campos que deseja alterar (`name`, `standardTime`, `description`).
- **Slug recalculado e único na edição**: quando o `name` muda, o `name` é normalizado para maiúsculas e o `slug` é regerado via `slugify`; a checagem de duplicidade ignora a própria sala (`id: { not: id }`) e rejeita com `400` se outra sala já tiver o mesmo slug. Se o nome não muda, o slug não é tocado.
- **Somente ADMIN**: ambas as rotas chamam `request.checkIfEmployeeIsAdmin()`; funcionário não-ADMIN ou sem JWT recebe `401`.
- **`routes/index.ts`**: registra as duas novas rotas sob o prefixo `/rooms`.

## Capabilities

### Modified Capabilities
- `room`: além do cadastro, a capability passa a cobrir a listagem de todas as salas (com computadores) e a edição parcial de uma sala, ambas restritas a ADMIN, com slug único preservado na edição.

## Impact

- Código novo: `src/http/core/rooms/get-all.ts` e `src/http/core/rooms/update.ts`; alteração em `src/http/routes/index.ts`.
- Banco: usa os modelos `rooms` e `computers` já existentes; nenhuma migração.
- Contrato HTTP:
  - `GET /rooms/get-all` → `200` com `{ rooms: [...] }` (cada sala com seus `computers`); sem JWT/permissão → `401`.
  - `PATCH /rooms/update/:id` → `200` com `{ message }`; `id` inexistente → `404`; nome duplicado → `400`; sem JWT/permissão → `401`.
- Documentação: `docs/ROADMAP.md` e `docs/DOC.md` marcam "Buscar todas as salas" e "Editar sala" como concluídos e a RN de ADMIN sobre salas como parcial.
