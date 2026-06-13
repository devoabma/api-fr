## 1. Dependência

- [x] 1.1 Adicionar `dayjs` ao projeto

## 2. Template de e-mail de confirmação

- [x] 2.1 Criar `src/utils/emails/sendConfirmationChangedPassword.tsx` (react-email + Tailwind) com confirmação e alerta de segurança
- [x] 2.2 Definir `PreviewProps` para o email dev

## 3. Caso de uso de redefinição

- [x] 3.1 Criar `src/http/core/employees/reset-password.ts` (`POST /employees/reset-password`)
- [x] 3.2 Validar body com Zod (`code`, `password`, `confirmPassword` ≥ 8, `refine` de igualdade)
- [x] 3.3 Buscar token (`code` + `PASSWORD_RECOVER`); inexistente → `400`
- [x] 3.4 Rejeitar token expirado via `dayjs().isAfter(expiresAt)` → `400`
- [x] 3.5 Rejeitar nova senha igual à atual (`bcrypt.compare`) → `400`
- [x] 3.6 `$transaction`: apagar token e gravar novo `passwordHash`
- [x] 3.7 Enviar e-mail de confirmação fora da transação (não-fatal)
- [x] 3.8 Registrar a rota em `src/http/routes/index.ts`

## 4. Revisão da solicitação

- [x] 4.1 Mover envio do e-mail para fora da `$transaction` em `request-password-recovery.ts`
- [x] 4.2 `deleteMany` dos tokens `PASSWORD_RECOVER` anteriores antes de criar o novo (token único ativo)
- [x] 4.3 Usar `dayjs().add(5, 'minutes')` para `expiresAt`

## 5. OpenAPI

- [x] 5.1 Declarar `security: [{ bearerAuth: [] }]` em `get-profile.ts`

## 6. Verificação

- [x] 6.1 `npx tsc --noEmit` sem erros
- [x] 6.2 `biome check` sem issues nos arquivos alterados
- [ ] 6.3 `POST /employees/reset-password` com código válido retorna `200`, troca a senha e invalida o token
- [ ] 6.4 Código inexistente ou expirado retorna `400`
- [ ] 6.5 Nova senha igual à anterior retorna `400`
- [ ] 6.6 Solicitação repetida invalida o código anterior (apenas um token ativo)
