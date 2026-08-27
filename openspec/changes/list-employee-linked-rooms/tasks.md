## 1. Expor as salas vinculadas ao funcionário

- [x] 1.1 Adicionar `employeesRooms` ao `select` do `prisma.employees.findMany` em `get-all.ts`, trazendo `rooms` com `id`, `name`, `uf` e `inactive`
- [x] 1.2 Adicionar `employeesRooms` ao schema Zod de resposta 200, no formato aninhado pela tabela de junção
- [x] 1.3 Ordenar os vínculos por `rooms.name` asc, para que a lista seja estável entre chamadas

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `npx biome check` sem issues
- [x] 2.3 Confirmar que a exigência de ADMIN (`checkIfEmployeeIsAdmin`) e os campos públicos continuam intactos, sem vazar hash de senha
- [x] 2.4 Confirmar que vínculo com sala **inativa** continua sendo devolvido (é o que evita o 400 de `link-with-rooms` em vínculo repetido)
- [ ] 2.5 Validar manualmente: chamar `GET /employees/get-all` e conferir as salas de um funcionário vinculado, de um sem vínculo (array vazio) e de um desativado

## 3. Documentação

- [x] 3.1 Atualizar `docs/DOC.md` (item de listagem de funcionários)
- [x] 3.2 Atualizar `docs/ROADMAP.md` (item de listagem de funcionários)
