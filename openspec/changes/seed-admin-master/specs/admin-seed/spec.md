## ADDED Requirements

### Requirement: Seed idempotente do funcionário ADMIN master

A aplicação SHALL fornecer um seed (`prisma/seed.ts`, executado por `prisma db seed`) que garanta a existência de um funcionário com papel `ADMIN` a partir de variáveis de ambiente. O seed MUST validar `CPF_ADMIN`, `EMAIL_ADMIN` e `PASSWORD_ADMIN` via o schema de `env`, MUST gerar o `passwordHash` com bcrypt e MUST identificar o ADMIN pelo `email` (campo `@unique`).

A operação MUST ser idempotente via guard: o seed MUST consultar (`findUnique`) por `email` e, se já existir funcionário, MUST sair sem alterar nada; caso contrário MUST criar com `name`, `cpf`, `email`, `passwordHash` e `role: 'ADMIN'`. O seed NÃO MUST usar `upsert`, justamente para distinguir criação de pré-existência e disparar o e-mail apenas na criação. O seed NÃO MUST rodar durante `pnpm install`; ele MUST ser invocado no passo de release do deploy via `db:deploy` (`prisma migrate deploy && prisma db seed`), garantindo que as migrações sejam aplicadas antes.

Somente quando o ADMIN é criado, o seed MUST enviar um e-mail de confirmação de cadastro para o `EMAIL_ADMIN` (em produção; em ambiente não-produção, para o e-mail de teste), usando o template `SendEmailEmployeeSignUp` via Resend, com `name`, `cpf`, `email`, `tempPassword` e o link de login. O envio MUST ser não-fatal: falha de e-mail MUST ser logada e NÃO MUST interromper o seed nem desfazer a criação.

#### Scenario: Primeiro deploy cria o ADMIN e envia e-mail

- **WHEN** `pnpm db:deploy` roda e não existe funcionário com `EMAIL_ADMIN`
- **THEN** um funcionário é criado com `role: 'ADMIN'`, `cpf`, `email` e senha (hash bcrypt) vindos do ambiente
- **AND** um e-mail de confirmação de cadastro é enviado ao administrador

#### Scenario: Deploys seguintes são idempotentes

- **WHEN** `pnpm db:deploy` roda novamente e já existe funcionário com `EMAIL_ADMIN`
- **THEN** nenhum registro duplicado é criado e nenhum dado existente é alterado
- **AND** nenhum e-mail é enviado

#### Scenario: Falha no envio do e-mail não derruba o seed

- **WHEN** o ADMIN é criado mas o provedor de e-mail retorna erro
- **THEN** o erro é logado
- **AND** a criação do ADMIN é preservada e o seed conclui com sucesso

#### Scenario: Variáveis de ambiente ausentes ou inválidas

- **WHEN** `CPF_ADMIN`, `EMAIL_ADMIN` ou `PASSWORD_ADMIN` estão ausentes ou inválidos
- **THEN** a validação de `env` falha e o seed não executa
