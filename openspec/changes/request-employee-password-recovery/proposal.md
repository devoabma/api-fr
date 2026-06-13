## Why

Funcionários precisam de uma forma de recuperar o acesso quando esquecem a senha. O roadmap (seção 1) lista "Redefinir senha", "Enviar e-mail para redefinir senha" e "Trocar de senha" como pendentes. Esta change entrega a **primeira etapa** desse fluxo: a solicitação de redefinição, que gera um código de recuperação temporário e o envia por e-mail. A efetivação da troca de senha a partir do código fica para uma change posterior.

## What Changes

- **Novo caso de uso `request-password-recovery.ts`**: rota `POST /employees/password-recovery` que recebe `cpf` + `email`, valida o funcionário e dispara um e-mail com código de recuperação.
- **Geração de código**: novo utilitário `generateRecoveryCode()` em `src/utils/index.ts` — gera um código alfanumérico (A–Z, 0–9) de 6 caracteres por padrão.
- **Persistência do token**: cria um registro em `tokens` com `type: 'PASSWORD_RECOVER'`, vinculado ao funcionário, com expiração de 5 minutos.
- **Template de e-mail `resetPasswordEmail.tsx`**: e-mail React (react-email + Tailwind) com o código, link de redefinição e avisos de segurança.
- **Registro da rota**: `request-password-recovery` adicionado em `src/http/routes/index.ts`.
- **Privacidade**: quando `cpf`/`email` não correspondem a um funcionário, a API responde `400` com mensagem genérica de "Credenciais inválidas".

## Capabilities

### Added Capabilities
- `employee-password-recovery`: solicitação de redefinição de senha de funcionário, com geração de código temporário, persistência de token e envio de e-mail.

## Impact

- Código novo: `src/http/core/employees/request-password-recovery.ts`, `src/utils/index.ts` (`generateRecoveryCode`), `src/utils/emails/resetPasswordEmail.tsx`.
- Código alterado: `src/http/routes/index.ts` (registro da rota).
- Banco: usa a tabela `tokens` já existente (`type: 'PASSWORD_RECOVER'`).
- Rota **pública** (sem `auth`): qualquer cliente pode solicitar a recuperação informando `cpf` + `email`.
- Não cobre ainda a efetivação da troca de senha a partir do código — escopo de change futura.
