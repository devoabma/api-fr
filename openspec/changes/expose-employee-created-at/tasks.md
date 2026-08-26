## 1. Expor a data de cadastro do funcionário

- [x] 1.1 Adicionar `createdAt: true` ao `select` do `prisma.employees.findMany` em `get-all.ts`
- [x] 1.2 Adicionar `createdAt: z.date()` ao schema Zod de resposta 200

## 2. Tornar a ordem da listagem determinística

- [x] 2.1 Adicionar `orderBy: { createdAt: 'desc' }` à consulta, seguindo o padrão das demais listagens

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check` sem issues
- [x] 3.3 Confirmar que a exigência de ADMIN (`checkIfEmployeeIsAdmin`) e os campos públicos continuam intactos, sem vazar hash de senha
- [ ] 3.4 Validar manualmente: chamar `GET /employees/get-all` e conferir `createdAt` em cada funcionário, coerente com a ordenação desc

## 4. Documentação

- [x] 4.1 Atualizar `docs/DOC.md` (item de listagem de funcionários)
- [x] 4.2 Atualizar `docs/ROADMAP.md` (item de listagem de funcionários)
