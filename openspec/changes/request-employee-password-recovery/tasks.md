## 1. Geração de código

- [x] 1.1 Criar `generateRecoveryCode(length = 6)` em `src/utils/index.ts` (alfanumérico A–Z0–9)

## 2. Template de e-mail

- [x] 2.1 Criar `src/utils/emails/resetPasswordEmail.tsx` (react-email + Tailwind) com código, link e avisos de segurança
- [x] 2.2 Definir `PreviewProps` para o `email dev`

## 3. Caso de uso

- [x] 3.1 Criar `src/http/core/employees/request-password-recovery.ts` (`POST /employees/password-recovery`)
- [x] 3.2 Validar body com Zod (`cpf` via `cpfSchema`, `email`)
- [x] 3.3 Buscar funcionário por `cpf` + `email`; falha → `400` genérico
- [x] 3.4 Criar token `PASSWORD_RECOVER` (expira em 5 min) e enviar e-mail dentro de `$transaction`
- [x] 3.5 Erro de envio → `BadRequestError` e rollback
- [x] 3.6 Registrar a rota em `src/http/routes/index.ts`

## 4. Verificação

- [x] 4.1 `npx tsc --noEmit` sem erros
- [x] 4.2 `npx biome check` sem issues nos arquivos alterados
- [ ] 4.3 `POST /employees/password-recovery` com `cpf`/`email` válidos retorna `200` e envia e-mail
- [ ] 4.4 `cpf`/`email` inexistentes retornam `400` genérico
- [ ] 4.5 Token criado com `type: 'PASSWORD_RECOVER'` e `expiresAt` de 5 min
