## Why

Após a criação da conta (capability `employee-account-creation`), o funcionário precisa de uma forma de provar sua identidade para acessar a aplicação. Esta etapa fecha o fluxo de acesso: troca CPF + senha por um token JWT que autoriza as próximas requisições, atendendo tanto o app desktop (token no corpo) quanto o front web (cookie httpOnly).

## What Changes

- Novo endpoint `POST /employees/session/auth` que autentica um funcionário a partir de `cpf` e `password`.
- Validação de entrada com Zod: CPF via `cpfSchema` e senha com mínimo de 8 caracteres.
- Busca do funcionário por CPF; bloqueio de acesso quando o funcionário está inativo (`inactive` preenchido).
- Verificação da senha com `bcrypt.compare` contra o `passwordHash` armazenado.
- Geração de JWT (`@fastify/jwt`) contendo `sub` (id) e `role`, com expiração de 1 dia.
- Retorno do token de duas formas: no corpo da resposta `200` e em cookie httpOnly (`TOKEN_COOKIE_NAME`), com flags `secure`/`sameSite` ajustadas por ambiente.
- Mensagem de erro genérica ("Credenciais inválidas") para CPF inexistente e senha incorreta, evitando enumeração de usuários.

## Capabilities

### New Capabilities
- `employee-authentication`: Autenticação de funcionário por CPF e senha, com emissão de token JWT entregue via corpo e cookie httpOnly, e bloqueio de funcionários inativos.

### Modified Capabilities
<!-- Nenhuma capability existente tem requisitos alterados. -->

## Impact

- Código: `src/http/core/employees/authenticate.ts` (novo), registro da rota em `src/http/routes/index.ts` com prefixo `/employees`.
- Infra/HTTP: depende de `@fastify/jwt` e `@fastify/cookie` já registrados em `src/http/app.ts`.
- Env: usa `JWT_SECRET`, `TOKEN_COOKIE_NAME`, `DOMAIN_URL` e `NODE_ENV`.
