## Why

A change `list-and-update-rooms` entregou a listagem e a edição de salas, mas o roadmap (seção 2 — Salas) ainda listava "Inativar sala" e "Ativar sala" como pendentes. Sem esses casos de uso, o ADMIN não consegue tirar de circulação uma sala fora de uso (mantendo o histórico) nem reativá-la depois. Além disso, a listagem de salas não expunha o status `inactive`, impedindo o app desktop/front web de diferenciar salas ativas de inativas. Esta change adiciona a alternância de status e passa a expor `inactive` na listagem.

## What Changes

- **`activate.ts`** (`PATCH /rooms/activate/:id`): nova rota protegida que reativa uma sala zerando a coluna `inactive` (`null`). Exige ADMIN via `checkIfEmployeeIsAdmin()`. Bloqueia com `400` se a sala já estiver ativa e responde `404` se a sala não existir.
- **`deactivate.ts`** (`PATCH /rooms/deactivate/:id`): nova rota protegida que inativa uma sala gravando `inactive` com a data/hora atual. Bloqueia com `400` se já estiver inativa e responde `404` se a sala não existir.
- **`get-all.ts`** (`GET /rooms/get-all`): a listagem passa a selecionar e expor o campo `inactive` (timestamp anulável) de cada sala.
- **`routes/index.ts`**: registra as duas novas rotas sob o prefixo `/rooms`.
- Ambos os endpoints declaram `security: [{ bearerAuth: [] }]` na doc OpenAPI e executam `checkIfEmployeeIsAdmin()` como primeira etapa do handler.

## Capabilities

### Modified Capabilities
- `room`: além do cadastro, listagem e edição, a capability passa a cobrir a ativação e a inativação de salas por ADMIN (coluna `inactive` como fonte de verdade do status), e a listagem passa a expor o campo `inactive`.

## Impact

- Código novo: `src/http/core/rooms/activate.ts` e `src/http/core/rooms/deactivate.ts`; alteração em `src/http/core/rooms/get-all.ts` (campo `inactive`) e em `src/http/routes/index.ts` (registro das rotas).
- Banco: usa a coluna `inactive` já existente no modelo `rooms`; nenhuma migração.
- Contrato HTTP:
  - `PATCH /rooms/activate/:id` → `200` com `{ message }`; sala inexistente → `404`; já ativa → `400`; sem JWT/permissão → `401`.
  - `PATCH /rooms/deactivate/:id` → `200` com `{ message }`; sala inexistente → `404`; já inativa → `400`; sem JWT/permissão → `401`.
  - `GET /rooms/get-all` → cada sala passa a incluir `inactive` na resposta.
- Documentação: `docs/ROADMAP.md` marca "Inativar sala" e "Ativar sala" como concluídos e a RN de ADMIN sobre salas como completa.
