## 1. Atualizar dependências

- [x] 1.1 Subir `package.json` e `pnpm-lock.yaml` para as versões mais recentes dentro das faixas `^` já declaradas
- [x] 1.2 Confirmar que nenhum salto é major (sem mudança de faixa semver)
- [x] 1.3 Limpar o comentário redundante do `.gitignore` mantendo `.env` ignorado

## 2. Verificação

- [x] 2.1 `npx tsc --noEmit` sem erros
- [x] 2.2 `npx biome check src` sem issues
- [x] 2.3 `pnpm build` (tsup) concluindo com sucesso
- [x] 2.4 Smoke test: subir `node build/http/server.js` e confirmar o boot completo — HTTP na porta, WebSocket em `/ws/computers`, cron de encerramento de sessões e cron de limpeza de impressões
- [ ] 2.5 Validar em produção após o deploy: `prisma generate` do `postinstall` gerando o client 7.9.1 e uma liberação real de computador ponta a ponta
