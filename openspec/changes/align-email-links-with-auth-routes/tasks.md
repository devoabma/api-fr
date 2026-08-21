## 1. Links dos e-mails

- [x] 1.1 `create-account.ts`: apontar o link de boas-vindas para `${env.WEB_URL}/auth/sign-in`
- [x] 1.2 `request-password-recovery.ts`: apontar o link de redefinição para `${env.WEB_URL}/auth/reset-password?code=${code}`, preservando a query `code`
- [x] 1.3 `prisma/seed.ts`: apontar o e-mail do administrador semeado para `${env.WEB_URL}/auth/sign-in`
- [x] 1.4 `env.ts`: atualizar o exemplo no comentário do `webUrlSchema` para o caminho real
- [x] 1.5 Varrer o projeto por outras concatenações de `WEB_URL` e confirmar que `change-password.ts` e `reset-password.ts` apontam para a raiz de propósito

## 2. Verificação

- [x] 2.1 `pnpm exec tsc --noEmit` sem erros
- [x] 2.2 `pnpm exec biome check` sem apontamentos
- [x] 2.3 `pnpm build` concluindo
- [ ] 2.4 Validar manualmente: cadastrar funcionário e conferir que o botão do e-mail abre `/auth/sign-in`; pedir recuperação e conferir que o botão abre `/auth/reset-password?code=...` com o código preenchido

## 3. Documentação

- [x] 3.1 `docs/DOC.md`: registrar os caminhos do front usados nos links dos e-mails
