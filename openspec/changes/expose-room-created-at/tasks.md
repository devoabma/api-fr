## 1. Expor a data de criação da sala

- [x] 1.1 Adicionar `createdAt: true` ao `select` do `prisma.rooms.findMany` em `get-all.ts`
- [x] 1.2 Adicionar `createdAt: z.date()` ao schema Zod de resposta 200

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `npx biome check` sem issues
- [x] 2.3 Confirmar que o campo aparece para ADMIN e para MEMBER (mesmo `select` para os dois papéis)
- [ ] 2.4 Validar manualmente: chamar `GET /rooms/get-all` e conferir `createdAt` em cada sala, coerente com a ordenação desc
