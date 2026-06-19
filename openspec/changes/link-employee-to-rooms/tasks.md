## 1. Vínculo funcionário-salas (concluída)

- [x] 1.1 Criar `link-with-rooms.ts` com rota `POST /employees/link-with-rooms` protegida por `auth`
- [x] 1.2 `checkIfEmployeeIsAdmin()` como primeira etapa do handler
- [x] 1.3 Body validado por Zod (`employeeId: cuid2`, `roomIds: cuid2[]`)
- [x] 1.4 `404` quando o funcionário não existe
- [x] 1.5 `400` quando uma ou mais salas não são encontradas
- [x] 1.6 `400` quando alguma sala-alvo está inativa (lista os nomes)
- [x] 1.7 `400` quando já existe vínculo para alguma sala (lista os nomes)
- [x] 1.8 Criar os vínculos em `employees_rooms` via `prisma.$transaction` e responder `200`

## 2. Registro e verificação

- [x] 2.1 Registrar a rota em `routes/index.ts` sob o prefixo `/employees`
- [x] 2.2 `npx tsc --noEmit` sem erros
- [x] 2.3 `npx biome check` sem issues
- [ ] 2.4 Validar manualmente os fluxos `200`/`400`/`404`/`401`
