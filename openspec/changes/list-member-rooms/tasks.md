## 1. Listagem das salas do funcionário

- [x] 1.1 Criar `get-member-rooms.ts` com rota `GET /rooms/get-member-rooms` protegida por `auth`
- [x] 1.2 Escopar pelo funcionário autenticado via `request.getIdCurrentEmployee()` e filtro `employeesRooms: { some: { employeeId } }`
- [x] 1.3 Retornar somente salas ativas (`inactive: null`)
- [x] 1.4 Incluir os `computers` de cada sala com `id`, `macCode`, `number`, `description`, `inUse` e `maintenance`
- [x] 1.5 Ordenar por `createdAt` desc e responder `200` com `{ rooms }`

## 2. Disponibilidade na listagem de ADMIN

- [x] 2.1 Incluir `inUse` e `maintenance` em cada computador no `select` e no response schema de `get-all.ts`

## 3. Registro e verificação

- [x] 3.1 Registrar a rota em `routes/index.ts` sob o prefixo `/rooms`
- [x] 3.2 `npx tsc --noEmit` sem erros
- [x] 3.3 `npx biome check` sem issues
- [ ] 3.4 Validar manualmente os fluxos `200`/`401` (membro vê só as próprias salas ativas)
