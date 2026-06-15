## Why

O roadmap (seção 1) lista "Trocar de senha" como pendente. Diferente do fluxo de [`reset-employee-password`](../reset-employee-password/proposal.md) — que troca a senha de quem **esqueceu** a senha, autenticado pela posse de um código de e-mail —, esta change entrega a troca de senha do funcionário **já autenticado**, que conhece a senha atual e quer substituí-la. No caminho, padroniza a resposta de erro `400` num schema reutilizável, eliminando a repetição de `z.object({ message: z.string() })` espalhada pelas rotas.

## What Changes

- **Novo caso de uso `change-password.ts`**: rota protegida `PATCH /employees/change-password` que recebe `currentPassword`, `newPassword` e `confirmNewPassword`, confirma a senha atual do funcionário autenticado e grava a nova senha.
- **Schema de erro reutilizável `_errors/schemas/error-responses.ts`**: `badRequestSchema` documenta o contrato de resposta `400` do error handler global (`message` obrigatório + `errors[]` opcional de `{ field, message }` nas falhas de validação Zod). As rotas existentes (`authenticate`, `create-account`, `request-password-recovery`, `reset-password`) passam a referenciar esse schema no lugar do `z.object` inline.
- **Padronização do assunto do e-mail de confirmação**: `reset-password.ts` passa a usar `🔑 Confirmação de redefinição de senha`, alinhado ao e-mail emitido pela troca de senha autenticada.

## Capabilities

### New Capabilities
- `employee-password-change`: Troca de senha do funcionário autenticado via `PATCH /employees/change-password`, validando a senha atual e exigindo que a nova seja diferente.

### Modified Capabilities
- `http-error-handling`: o contrato de resposta `400` passa a ser exposto como schema Zod reutilizável (`badRequestSchema`), referenciado pelas rotas para documentar `message` + `errors[]` no OpenAPI.

## Impact

- Código novo: `src/http/core/employees/change-password.ts`, `src/http/_errors/schemas/error-responses.ts`.
- Código alterado: `src/http/routes/index.ts` (registro da rota), `authenticate.ts`, `create-account.ts`, `request-password-recovery.ts`, `reset-password.ts` (usam `badRequestSchema`; `reset-password` também ajusta o assunto do e-mail).
- Banco: usa a tabela `employees` existente (`passwordHash`); nenhuma migração.
- Rota **protegida** (`auth`): só o funcionário autenticado troca a própria senha; a senha atual é a credencial da operação.
