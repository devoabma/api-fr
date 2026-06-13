## Why

A change [`request-employee-password-recovery`](../request-employee-password-recovery/proposal.md) entregou apenas a **primeira etapa** do fluxo de recuperação: gerar um código e enviá-lo por e-mail. Faltava a **segunda etapa** — a efetivação da troca de senha a partir desse código. O roadmap (seção 1) lista "Redefinir senha" como pendente. Esta change fecha o fluxo de "esqueci minha senha" ponta a ponta e, no processo, ajusta a etapa de solicitação para garantir um único código ativo por funcionário.

## What Changes

- **Novo caso de uso `reset-password.ts`**: rota pública `POST /employees/reset-password` que recebe `code`, `password` e `confirmPassword`, valida o token de recuperação (existência e expiração), grava a nova senha e invalida o token.
- **Confirmação por e-mail `sendConfirmationChangedPassword.tsx`**: template react-email (Tailwind) avisando o funcionário de que a senha foi alterada, com alerta de segurança caso não reconheça a ação.
- **Revisão da atomicidade em `request-password-recovery.ts`**: o envio do e-mail passa para **fora** da `$transaction` (enviado primeiro; se falhar, lança `400` sem criar token). A transação agora **apaga tokens `PASSWORD_RECOVER` anteriores** do funcionário antes de criar o novo, garantindo um único código ativo por vez. Datas de expiração passam a usar `dayjs`.
- **Dependência `dayjs`**: adicionada para cálculo e comparação de datas (`expiresAt`).
- **OpenAPI**: `get-profile.ts` passa a declarar `security: [{ bearerAuth: [] }]`, refletindo no Swagger que a rota exige token.

## Capabilities

### Modified Capabilities
- `employee-password-recovery`: adiciona a efetivação da redefinição de senha a partir do código e revisa a estratégia de atomicidade da solicitação (e-mail fora da transação + token único ativo).

## Impact

- Código novo: `src/http/core/employees/reset-password.ts`, `src/utils/emails/sendConfirmationChangedPassword.tsx`.
- Código alterado: `src/http/core/employees/request-password-recovery.ts` (atomicidade/token único), `src/http/routes/index.ts` (registro da rota), `src/http/core/employees/get-profile.ts` (security OpenAPI).
- Dependências: `dayjs` adicionado.
- Banco: usa a tabela `tokens` existente (`type: 'PASSWORD_RECOVER'`); `deleteMany` remove tokens anteriores na solicitação e `delete` invalida o token na redefinição.
- Rota **pública** (sem `auth`): quem redefine a senha não está autenticado — a posse do código é a credencial.
