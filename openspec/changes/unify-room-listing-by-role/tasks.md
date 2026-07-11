## 1. Helper de papel sem bloqueio

- [x] 1.1 Adicionar `request.getCurrentEmployee()` em `auth.ts` retornando `{ id, role }` numa única query
- [x] 1.2 Lançar `401` quando o token é válido mas o funcionário não existe mais
- [x] 1.3 Reescrever `checkIfEmployeeIsAdmin()` reusando `getCurrentEmployee()`
- [x] 1.4 Declarar a assinatura de `getCurrentEmployee()` em `src/types/fastify.d.ts`

## 2. Listagem por papel em get-all

- [x] 2.1 Trocar `checkIfEmployeeIsAdmin()` por `getCurrentEmployee()` em `get-all.ts`
- [x] 2.2 Montar `where` por papel: ADMIN `{}`; MEMBER `{ inactive: null, employeesRooms: { some: { employeeId } } }`
- [x] 2.3 Atualizar o `summary` do schema para refletir a visão por papel
- [x] 2.4 Padronizar os ids do response schema em `z.cuid2()` (evita deprecação de `z.cuid()`)

## 3. Remoção da rota do membro

- [x] 3.1 Excluir `src/http/core/rooms/get-member-rooms.ts`
- [x] 3.2 Remover o import e o `app.register(getMemberRooms, ...)` de `routes/index.ts`

## 4. Verificação

- [x] 4.1 `npx tsc --noEmit` sem erros
- [x] 4.2 `npx biome check` sem issues
- [ ] 4.3 Validar manualmente: ADMIN vê todas as salas; MEMBER vê só as próprias salas ativas; sem JWT → `401`
