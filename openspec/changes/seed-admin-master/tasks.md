## 1. Variáveis de ambiente

- [x] 1.1 Adicionar `CPF_ADMIN` (validado por `cpfSchema`) em `src/http/env.ts`
- [x] 1.2 Adicionar `EMAIL_ADMIN` (`z.email()`) e `PASSWORD_ADMIN` (`z.string()`)

## 2. Seed idempotente do ADMIN

- [x] 2.1 Criar `prisma/seed.ts` com conexão via `PrismaPg`/`Pool` e `env` validado
- [x] 2.2 Gerar `passwordHash` com bcrypt a partir de `PASSWORD_ADMIN`
- [x] 2.3 Usar `upsert` por `email` (`@unique`): `create` com todos os campos e `role: 'ADMIN'`; `update` mantendo `name`/`cpf`/`passwordHash`/`role`
- [x] 2.4 Encerrar `prisma.$disconnect()` e `pool.end()` no fim e tratar erro com `process.exit(1)`

## 3. Configuração de deploy

- [x] 3.1 Ajustar `prisma.config.ts` para `seed: 'tsx prisma/seed.ts'`
- [x] 3.2 Restaurar `postinstall` para apenas `prisma generate`
- [x] 3.3 Adicionar script `db:deploy` (`prisma migrate deploy && prisma db seed`)

## 4. Verificação

- [x] 4.1 `npx tsc --noEmit` sem erros
- [x] 4.2 `npx biome check` sem issues nos arquivos alterados
- [ ] 4.3 Validar manualmente em produção: `pnpm db:deploy` cria o ADMIN no primeiro deploy e é idempotente nos seguintes
