## Why

Com o cadastro (`employee-account-creation`) e o login (`employee-authentication`) prontos, faltava a fundação que sustenta as próximas rotas: (1) um tratamento de erro centralizado para padronizar as respostas da API e parar de repetir `reply.status(...).send(...)` em cada caso de uso, e (2) uma forma de proteger rotas, lendo o funcionário autenticado a partir do JWT. Esta change entrega essa fundação e estreia seu primeiro consumidor: o endpoint de perfil do funcionário logado.

## What Changes

- **Error handler global** (`app.setErrorHandler`) que mapeia erros de domínio e de validação para respostas HTTP consistentes:
  - `hasZodFastifySchemaValidationErrors` → `400` com lista de `{ field, message }`.
  - `BadRequestError` → `400`; `NotFoundError` → `404`; `UnauthorizedError` → `401`.
  - `AxiosError` → `404` (consulta externa indisponível ou advogado não encontrado).
  - Fallback `500` para erros não previstos, com log no servidor.
- **Classes de erro de domínio** em `src/http/_errors/`: `BadRequestError`, `NotFoundError`, `UnauthorizedError` (esta com mensagem padrão).
- **Middleware de autenticação** (`src/http/middleware/auth.ts`) via `fastify-plugin`, que decora `request` com:
  - `getIdCurrentEmployee()` — valida o JWT (`jwtVerify`) e retorna o `sub`; lança `UnauthorizedError` se inválido.
  - `checkIfEmployeeIsAdmin()` — garante que o funcionário autenticado tem `role: 'ADMIN'`, lançando `UnauthorizedError` caso contrário.
- **Augmentação de tipos** (`src/types/fastify.d.ts`) declarando os dois métodos em `FastifyRequest`.
- **Novo endpoint** `GET /employees/profile` que retorna o perfil do funcionário autenticado (`id`, `name`, `cpf`, `email`, `imageUrl`, `role`).
- **Refactor de `authenticate.ts`**: substitui os `reply.status(400)` inline por `throw new UnauthorizedError(...)`, passando a responder `401` para credenciais inválidas e funcionário inativo.
- **Refactor de `create-account.ts`**: usa `BadRequestError` para CPF/e-mail duplicados; remove o `$transaction` e passa a enviar o e-mail de boas-vindas **fora da transação** e de forma **não-fatal** (falha de envio apenas loga via `request.log.error`, sem rollback do cadastro).
- **Dependências**: adiciona `axios` (consumo futuro da API externa e tratamento de `AxiosError`) e `fastify-plugin`.

## Capabilities

### New Capabilities
- `http-error-handling`: Tratamento global de erros que converte erros de validação Zod, erros de domínio e `AxiosError` em respostas HTTP padronizadas, com fallback `500`.
- `request-authorization`: Decoradores de request para identificar o funcionário autenticado (`getIdCurrentEmployee`) e exigir papel ADMIN (`checkIfEmployeeIsAdmin`) a partir do JWT.
- `employee-profile`: Recuperação do perfil do funcionário autenticado via `GET /employees/profile`.

### Modified Capabilities
- `employee-authentication`: credenciais inválidas e funcionário inativo passam a responder `401` (antes `400`), agora via `UnauthorizedError` tratado pelo error handler global.
- `employee-account-creation`: o e-mail de boas-vindas passa a ser enviado fora da transação e de forma não-fatal; a falha de envio não causa mais rollback do cadastro.

## Impact

- Código novo: `src/http/_errors/{index,bad-request,not-found,unauthorized}.ts`, `src/http/middleware/auth.ts`, `src/types/fastify.d.ts`, `src/http/core/employees/get-profile.ts`.
- Código alterado: `src/http/app.ts` (registra `errorHandler`), `src/http/routes/index.ts` (registra `getProfile`), `src/http/core/employees/authenticate.ts` e `create-account.ts` (passam a lançar erros de domínio).
- Dependências: `axios`, `fastify-plugin` (refletidas em `package.json`/`pnpm-lock.yaml`).
- Contrato HTTP: clientes que tratavam `400` para credenciais inválidas devem passar a tratar `401`.
