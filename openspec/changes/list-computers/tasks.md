## 1. Listagem de computadores

- [x] 1.1 Criar `get-all.ts` com `GET /computers/get-all`, plugin `auth` e `request.checkIfEmployeeIsAdmin()`
- [x] 1.2 Definir filtros opcionais na `querystring` (Zod): `roomId` (cuid) e `description` (string)
- [x] 1.3 Aplicar filtros no Prisma: `roomId` por igualdade e `description` com `contains` + `mode: 'insensitive'`
- [x] 1.4 Definir o `select` e o schema de resposta `200` (computers com `room` vinculada)
- [x] 1.5 Registrar a rota com prefixo `/computers` em `src/http/routes/index.ts`

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [ ] 2.2 Validar manualmente: `?description=` e `?roomId=` filtram corretamente; sem filtros retorna todos; não-ADMIN/sem JWT → `401`
