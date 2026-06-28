## 1. Caso de uso de retirada de manutenção

- [x] 1.1 Criar `take-out-of-maintenance.ts` com rota `PATCH /computers/maintenance/:id/remove` protegida por `auth`
- [x] 1.2 Identificar o funcionário via `request.getIdCurrentEmployee()`, carregar seu `role` e validar `id` (cuid) no path
- [x] 1.3 Carregar o computador por `id`; para não-ADMIN, restringir às salas vinculadas (`room.employeesRooms.some(employeeId)`); inexistente/fora do escopo → `404`
- [x] 1.4 Rejeitar com `400` quando o computador não estiver em manutenção (`maintenance` nulo)
- [x] 1.5 Persistir `maintenance = null`; responder `200` com `{ message }`

## 2. Registro e verificação

- [x] 2.1 Registrar a rota em `routes/index.ts` sob o prefixo `/computers`
- [x] 2.2 `npx tsc --noEmit` e `biome check` sem erros
- [ ] 2.3 Validar manualmente os fluxos `200`/`400`/`404`/`401` (ADMIN, funcionário da sala, funcionário fora da sala, não em manutenção)
