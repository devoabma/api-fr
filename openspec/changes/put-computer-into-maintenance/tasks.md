## 1. Caso de uso de manutenção

- [x] 1.1 Criar `put-into-maintenance.ts` com rota `PATCH /computers/maintenance/:id` protegida por `auth`
- [x] 1.2 Validar `id` (cuid) no path
- [x] 1.3 Carregar o computador no escopo do departamento (`room.employeesRooms.some(employeeId)`); inexistente/fora do escopo → `404`
- [x] 1.4 Rejeitar com `400` quando o computador já estiver em manutenção (`maintenance` não-nulo)
- [x] 1.5 Rejeitar com `400` quando o computador estiver em uso (`inUse`), preservando a sessão do advogado
- [x] 1.6 Persistir `maintenance = now()`, `inUse = false` e `currentLawyerId = null`; responder `200` com `{ message }`

## 2. Registro e verificação

- [x] 2.1 Registrar a rota em `routes/index.ts` sob o prefixo `/computers`
- [x] 2.2 `npx tsc --noEmit` e `biome check` sem erros
- [ ] 2.3 Validar manualmente os fluxos `200`/`400`/`404`/`401` (em manutenção, em uso e fora do departamento)
