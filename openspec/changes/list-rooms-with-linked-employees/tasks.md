## 1. Funcionários vinculados na listagem de salas

- [x] 1.1 Estender o `select` de `get-all.ts` com `employeesRooms.select.employees.select` (`id`, `name`, `imageUrl`)
- [x] 1.2 Estender o schema de resposta `200` (Zod) com `employeesRooms` espelhando o `select`
- [x] 1.3 Manter a rota restrita a ADMIN e a ordenação por `createdAt` desc

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `npx biome check` sem issues nos arquivos alterados
- [ ] 2.3 Validar manualmente: `200` retorna `employeesRooms` por sala; não-ADMIN/sem JWT → `401`
