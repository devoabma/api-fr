## 1. Expor a data de cadastro do computador

- [x] 1.1 Adicionar `createdAt: true` ao `select` do `prisma.computers.findMany` em `get-all.ts`
- [x] 1.2 Adicionar `createdAt: z.date()` ao schema Zod de resposta 200

## 2. Tornar a ordem da listagem determinística

- [x] 2.1 Adicionar `orderBy: { createdAt: 'desc' }` à consulta, seguindo o padrão das demais listagens

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check` sem issues
- [x] 3.3 Confirmar que filtros (`roomId`, `description`) e a exigência de ADMIN continuam intactos
- [ ] 3.4 Validar manualmente: chamar `GET /computers/get-all` e conferir `createdAt` em cada máquina, coerente com a ordenação desc
