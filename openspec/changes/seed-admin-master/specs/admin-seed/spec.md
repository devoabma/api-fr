## ADDED Requirements

### Requirement: Seed idempotente do funcionário ADMIN master

A aplicação SHALL fornecer um seed (`prisma/seed.ts`, executado por `prisma db seed`) que garanta a existência de um funcionário com papel `ADMIN` a partir de variáveis de ambiente. O seed MUST validar `CPF_ADMIN`, `EMAIL_ADMIN` e `PASSWORD_ADMIN` via o schema de `env`, MUST gerar o `passwordHash` com bcrypt e MUST identificar o ADMIN pelo `email` (campo `@unique`).

A operação MUST ser idempotente, usando `upsert`: quando não existe funcionário com o `email` informado, MUST criar com `name`, `cpf`, `email`, `passwordHash` e `role: 'ADMIN'`; quando já existe, MUST atualizar `name`, `cpf`, `passwordHash` e `role`, sem reescrever o `email`. O seed NÃO MUST rodar durante `pnpm install`; ele MUST ser invocado no passo de release do deploy via `db:deploy` (`prisma migrate deploy && prisma db seed`), garantindo que as migrações sejam aplicadas antes.

#### Scenario: Primeiro deploy cria o ADMIN

- **WHEN** `pnpm db:deploy` roda e não existe funcionário com `EMAIL_ADMIN`
- **THEN** um funcionário é criado com `role: 'ADMIN'`, `cpf`, `email` e senha (hash bcrypt) vindos do ambiente

#### Scenario: Deploys seguintes são idempotentes

- **WHEN** `pnpm db:deploy` roda novamente e já existe funcionário com `EMAIL_ADMIN`
- **THEN** nenhum registro duplicado é criado
- **AND** `name`, `cpf`, `passwordHash` e `role` são sincronizados com os valores do ambiente

#### Scenario: Variáveis de ambiente ausentes ou inválidas

- **WHEN** `CPF_ADMIN`, `EMAIL_ADMIN` ou `PASSWORD_ADMIN` estão ausentes ou inválidos
- **THEN** a validação de `env` falha e o seed não executa
