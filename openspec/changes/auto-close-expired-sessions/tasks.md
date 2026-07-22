## 1. Job de encerramento automático

- [x] 1.1 Criar `checkExpiredSessions` que busca sessões ativas (`endedAt: null`) e calcula o limite (`remainingTime` do advogado(a) ou `standardTime` da sala)
- [x] 1.2 Criar `closeSession` com update condicional (`endedAt: null` no where) para evitar corrida com encerramento manual/reativo
- [x] 1.3 Liberar o computador somente se ainda vinculado ao mesmo advogado(a) (`currentLawyerId`)
- [x] 1.4 Zerar `remainingTime` e atualizar `lastAccess` do advogado(a) ao encerrar por tempo
- [x] 1.5 Tratar erros por sessão isoladamente (não interromper o loop) e logar erros transitórios de conexão como aviso
- [x] 1.6 Agendar o próximo tick (60s) somente após o tick atual terminar (`setTimeout` recursivo, não `setInterval`)

## 2. Integração

- [x] 2.1 Iniciar o job em `server.ts` após `app.listen` resolver com sucesso

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check` sem issues
- [ ] 3.3 Validar manualmente em produção que sessões esquecidas são encerradas dentro da janela esperada
