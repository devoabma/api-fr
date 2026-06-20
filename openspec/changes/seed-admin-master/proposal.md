## Why

O roadmap (seção 0 — Infraestrutura) lista "Seed do usuário ADMIN master" como pendente. Sem ele, ao subir a aplicação para produção (VPS via Coolify) não existe nenhum funcionário com papel `ADMIN`, e como o cadastro de funcionários é restrito a ADMIN (`restrict-account-creation-to-admin`), o sistema nasceria sem ninguém capaz de operá-lo. Esta change cria o ADMIN master automaticamente a partir de variáveis de ambiente, de forma idempotente, para rodar no passo de release de cada deploy.

## What Changes

- **Novo seed `prisma/seed.ts`**: cria/garante o funcionário ADMIN master via `prisma.employees.upsert`, identificado pelo `email` (`@unique`). O `create` grava `name`, `cpf`, `email`, `passwordHash` (bcrypt) e `role: 'ADMIN'`; o `update` mantém `name`, `cpf`, `passwordHash` e `role` em sincronia com o `.env` (o `email` não é reescrito por ser o critério de busca). Operação idempotente — pode rodar a cada deploy.
- **Novas variáveis de ambiente** em `src/http/env.ts`: `CPF_ADMIN` (validado por `cpfSchema`), `EMAIL_ADMIN` (`z.email()`) e `PASSWORD_ADMIN` (`z.string()`).
- **`prisma.config.ts`**: o comando de seed passa a apontar para o arquivo real `tsx prisma/seed.ts` (antes apontava para `prisma/seed/index.ts`, inexistente).
- **`package.json`**: o `postinstall` volta a fazer só `prisma generate`; o seed sai do install e passa a integrar um novo script `db:deploy` (`prisma migrate deploy && prisma db seed`), executado no passo de release do deploy (Pre-deployment Command do Coolify), garantindo a ordem correta: migrar → semear.

## Capabilities

### Added Capabilities
- `admin-seed`: a aplicação passa a garantir, de forma idempotente e a partir de variáveis de ambiente, a existência de um funcionário ADMIN master, executado no passo de release do deploy.

## Impact

- Código novo: `prisma/seed.ts`; alterações em `src/http/env.ts`, `prisma.config.ts` e `package.json`.
- Banco: usa o modelo `Employees` já existente; nenhuma migração nova. O seed escreve em `employees`.
- Variáveis de ambiente novas (obrigatórias): `CPF_ADMIN`, `EMAIL_ADMIN`, `PASSWORD_ADMIN` — devem estar configuradas no Coolify.
- Deploy: o seed NÃO roda mais no `pnpm install`. O passo de release deve executar `pnpm db:deploy` (migrate + seed), com o CLI `prisma` e o `tsx` disponíveis em runtime.
- Documentação: `docs/ROADMAP.md` marca "Seed do usuário ADMIN master" como concluído.
