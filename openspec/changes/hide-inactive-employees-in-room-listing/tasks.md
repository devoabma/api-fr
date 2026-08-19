## 1. Filtrar a equipe da sala

- [x] 1.1 Adicionar `where: { employees: { inactive: null } }` ao `select.employeesRooms` em `get-all.ts`
- [x] 1.2 Comentar o motivo no código (soft delete mantém o vínculo na tabela de junção)

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `npx biome check` sem issues
- [x] 2.3 Confirmar que as demais consultas com `employeesRooms` são filtros de permissão e não precisam do ajuste
- [ ] 2.4 Validar manualmente: inativar um funcionário vinculado e conferir que ele some de `employeesRooms` na listagem, sem afetar as outras salas
