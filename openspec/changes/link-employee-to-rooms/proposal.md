## Why

O roadmap (seção 1 — Funcionários) lista "Vincular funcionário a uma ou várias salas" e a regra de negócio "Não vincular funcionário a uma sala inativa" como pendentes. O modelo `EmployeesRooms` (tabela de junção com `@@unique([employeeId, roomId])`) já existe no schema, mas não havia caso de uso para popular esse vínculo. Sem ele, o ADMIN não consegue definir quais salas cada funcionário pode operar — base para as etapas seguintes (liberação de computador, arquivos pendentes da sala etc.).

## What Changes

- **`link-with-rooms.ts`** (`POST /employees/link-with-rooms`): nova rota protegida que vincula um funcionário a uma ou mais salas, gravando registros em `employees_rooms`. Exige ADMIN via `checkIfEmployeeIsAdmin()`.
- Validações antes da escrita: `404` se o funcionário não existir; `400` se uma ou mais salas não forem encontradas; `400` se alguma sala-alvo estiver inativa; `400` se o funcionário já estiver vinculado a alguma das salas informadas.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/employees`.
- A rota declara `security: [{ bearerAuth: [] }]` na doc OpenAPI e executa `checkIfEmployeeIsAdmin()` como primeira etapa do handler.

## Capabilities

### Added Capabilities
- `employee-room-link`: vínculo entre funcionário e salas (criação em lote por ADMIN), com guardas contra funcionário inexistente, sala inexistente, sala inativa e vínculo duplicado.

## Impact

- Código novo: `src/http/core/employees/link-with-rooms.ts`; alteração em `src/http/routes/index.ts` (registro da rota).
- Banco: usa o modelo `EmployeesRooms` já existente (`@@unique([employeeId, roomId])`); nenhuma migração.
- Contrato HTTP:
  - `POST /employees/link-with-rooms` com `{ employeeId, roomIds }` → `200` com `{ message }`; funcionário inexistente → `404`; sala inexistente/inativa/já vinculada → `400`; sem JWT/permissão → `401`.
- Documentação: `docs/ROADMAP.md` marca "Vincular funcionário a uma ou várias salas" e a RN "Não vincular funcionário a uma sala inativa" como concluídos.
