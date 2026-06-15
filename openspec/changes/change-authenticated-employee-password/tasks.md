## 1. Schema de erro reutilizável

- [x] 1.1 Criar `src/http/_errors/schemas/error-responses.ts` com `badRequestSchema` (`message` + `errors[]` opcional de `{ field, message }`)
- [x] 1.2 Substituir o `z.object` inline da resposta `400` por `badRequestSchema` em `authenticate.ts`, `create-account.ts`, `request-password-recovery.ts` e `reset-password.ts`

## 2. Caso de uso de troca de senha

- [x] 2.1 Criar `src/http/core/employees/change-password.ts` (`PATCH /employees/change-password`) protegido por `auth`
- [x] 2.2 Validar body com Zod (`currentPassword`, `newPassword`, `confirmNewPassword` ≥ 8, `refine` de igualdade entre nova e confirmação)
- [x] 2.3 Buscar funcionário autenticado via `request.getIdCurrentEmployee()`; inexistente → `400`
- [x] 2.4 Rejeitar senha atual incorreta (`bcrypt.compare`) → `400`
- [x] 2.5 Rejeitar nova senha igual à atual → `400`
- [x] 2.6 Gravar o novo `passwordHash` (`bcrypt.hash`)
- [x] 2.7 Enviar e-mail de confirmação fora da transação e não-fatal (apenas `console.error` em caso de falha)
- [x] 2.8 Registrar a rota em `src/http/routes/index.ts` com prefixo `/employees`

## 3. E-mail de confirmação

- [x] 3.1 Padronizar o assunto `🔑 Confirmação de redefinição de senha` em `reset-password.ts` e `change-password.ts`

## 4. Verificação

- [x] 4.1 `npx tsc --noEmit` sem erros
- [x] 4.2 `biome check` sem issues nos arquivos alterados
- [ ] 4.3 `PATCH /employees/change-password` sem token retorna `401`
- [ ] 4.4 Senha atual correta + nova válida e diferente retorna `200` e troca a senha
- [ ] 4.5 Senha atual incorreta retorna `400`
- [ ] 4.6 Nova senha igual à atual retorna `400`
- [ ] 4.7 `confirmNewPassword` divergente retorna `400` com erro de validação
