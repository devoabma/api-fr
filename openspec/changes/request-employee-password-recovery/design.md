## Contexto

O fluxo de "esqueci minha senha" tem duas etapas: (1) **solicitar** a recuperação — validar o funcionário e enviar um código por e-mail; (2) **redefinir** — validar o código e gravar a nova senha. Esta change entrega apenas a etapa (1). A tabela `tokens` (modelo Prisma) já existe e suporta `type: 'PASSWORD_RECOVER'`, `employeeId`, `code` e `expiresAt`.

## Decisões

### Rota pública (sem `auth`)

Diferente de `create-account.ts` e `get-profile.ts`, a rota `password-recovery` **não** registra o plugin `auth`: quem esqueceu a senha não tem como autenticar. A identificação é feita por `cpf` + `email` juntos, exigindo que ambos batam com o mesmo registro (`findUnique` com os dois campos).

### Mensagem genérica em falha de identificação

Quando o par `cpf`/`email` não corresponde a um funcionário, a resposta é `400` com "Credenciais inválidas. Verifique suas informações e tente novamente." — não revela se foi o CPF ou o e-mail que não bateu, reduzindo enumeração de contas.

### Token + e-mail dentro de uma transação

A criação do token e o envio do e-mail ficam dentro de `prisma.$transaction`: se o Resend retornar erro, lança-se `BadRequestError` e a transação faz rollback, **não** deixando token órfão. Esta é uma decisão diferente do cadastro de funcionário (onde o e-mail é não-fatal e fica fora da transação), porque aqui o código de recuperação só tem valor se o e-mail chegar — sem e-mail entregue, o token é inútil.

### Código de recuperação

`generateRecoveryCode(length = 6)` sorteia caracteres de `A–Z0–9`. Expira em 5 minutos (`Date.now() + 5 * 60 * 1000`). O código também compõe o link de redefinição (`${WEB_URL}/employees/reset-password?code=...`), atendendo tanto o app desktop (digitar o código) quanto o front web (clicar no link).

### Destino do e-mail por ambiente

Em produção envia para o e-mail do funcionário; fora de produção, redireciona para um e-mail de teste fixo e, em `dev`, loga o código no console — padrão já adotado no cadastro.

## Fluxo

1. Recebe `cpf` + `email` (validados por Zod; `cpf` via `cpfSchema`).
2. `findUnique` busca o funcionário pelo par. Não achou → `400` genérico.
3. `$transaction`: cria `token` (`PASSWORD_RECOVER`, expira em 5 min) e envia o e-mail.
4. Erro no envio → `BadRequestError` (`400`) e rollback do token.
5. Sucesso → `200` com mensagem de confirmação.
