## Why

O roadmap (seção 1 — Funcionários) lista "Desvincular funcionário de uma ou várias salas" como pendente, complementando o vínculo já entregue em `link-with-rooms.ts`. Sem a operação inversa, o ADMIN consegue criar vínculos em `employees_rooms` mas não removê-los — deixando o controle de quais salas cada funcionário pode operar incompleto.

## What Changes

- **`unlink-with-rooms.ts`** (`POST /employees/unlink-with-rooms`): nova rota protegida que remove o vínculo de um funcionário com uma ou mais salas, apagando registros em `employees_rooms`. Exige ADMIN via `checkIfEmployeeIsAdmin()`.
- Validações: `404` se o funcionário não existir; `404` se nenhum vínculo for encontrado entre o funcionário e as salas informadas. A remoção usa `deleteMany` e mede o resultado pelo `count` retornado.
- **`routes/index.ts`**: registra a nova rota sob o prefixo `/employees`.
- **Verbo HTTP `POST`** (e não `DELETE`): a rota carrega a lista `roomIds` no corpo da requisição. Body em `DELETE` tem semântica indefinida pela RFC 9110 e pode ser descartado por proxies/CDNs, então a operação usa `POST` para garantir que o corpo sempre chegue à API.

## Capabilities

### Modified Capabilities
- `employee-room-link`: passa a contemplar também a remoção de vínculos (não só a criação), restrita a ADMIN, com guardas contra funcionário inexistente e ausência de vínculos.

## Impact

- Código novo: `src/http/core/employees/unlink-with-rooms.ts`; alteração em `src/http/routes/index.ts` (registro da rota).
- Banco: usa o modelo `EmployeesRooms` já existente; nenhuma migração.
- Contrato HTTP:
  - `POST /employees/unlink-with-rooms` com `{ employeeId, roomIds }` → `200` com `{ message }`; funcionário inexistente ou sem nenhum vínculo nas salas informadas → `404`; lista vazia / IDs inválidos → `400`; sem JWT/permissão → `401`.
- Documentação: `docs/ROADMAP.md` marca "Desvincular funcionário de uma ou várias salas" como concluído.
