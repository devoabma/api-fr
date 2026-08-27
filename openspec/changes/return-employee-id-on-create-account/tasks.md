## 1. Devolver o id do funcionário criado

- [x] 1.1 Adicionar `select: { id: true }` ao `prisma.employees.create` em `create-account.ts`, capturando o registro criado
- [x] 1.2 Adicionar `employeeId: z.cuid2()` ao schema Zod da resposta `201`
- [x] 1.3 Devolver `employeeId` no `reply.status(201).send(...)`, junto da mensagem existente

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `npx biome check` sem issues
- [x] 2.3 Confirmar que `checkIfEmployeeIsAdmin()` segue como primeira etapa do handler
- [x] 2.4 Confirmar que o `select` impede o `passwordHash` de voltar do Prisma para o handler
- [x] 2.5 Confirmar que a falha do Resend continua não-fatal e que o `201` (com `employeeId`) é enviado mesmo assim
- [ ] 2.6 Validar manualmente: cadastrar um funcionário e usar o `employeeId` devolvido direto em `POST /employees/link-with-rooms`

## 3. Documentação

- [x] 3.1 Atualizar `docs/DOC.md` (item de cadastro de funcionários)
- [x] 3.2 Atualizar `docs/ROADMAP.md` (item de criação de funcionário)
