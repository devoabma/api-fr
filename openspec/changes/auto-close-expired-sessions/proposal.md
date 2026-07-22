## Why

O roadmap (seção 4 — Advogados e Sessões) marcava como pendente o "Cron job que encerra sessões expiradas e libera o computador": hoje o encerramento por tempo esgotado só acontece de forma reativa, quando alguém tenta liberar novamente o mesmo computador em `release-computer.ts`. Uma sessão esquecida (advogado(a) que nunca mais volta ao computador) fica com `inUse: true` indefinidamente, prendendo o computador mesmo sem ninguém usando.

## What Changes

- **Novo módulo `src/http/jobs/auto-close-sessions.ts`**: job in-process que roda em loop (`setTimeout` recursivo, tick a cada 60s, só reagenda após terminar o tick anterior).
  - `checkExpiredSessions`: busca todas as `computerSessions` ativas (`endedAt: null`) com o `remainingTime` do advogado(a) e o `standardTime` da sala do computador; calcula o tempo decorrido desde `startedAt` e compara com o limite (`remainingTime` do advogado(a) quando definido, senão `standardTime` da sala).
  - `closeSession`: update condicional (`updateMany` com `endedAt: null` no where) para não sobrescrever uma sessão já encerrada por `/close-computer` ou `/release-computer` entre a leitura e a escrita do tick; libera o computador só se ele ainda estiver vinculado ao mesmo advogado(a) (`currentLawyerId`); zera `lawyers.remainingTime` e atualiza `lastAccess` — mesma semântica do encerramento forçado por tempo já usada em `release-computer.ts`.
  - Erros por sessão são isolados (não interrompem as demais); erros transitórios de conexão com o banco (timeout, `ECONNRESET`, `P1001`, `P1017`) são logados como aviso, não como erro.
- **`server.ts`**: importa e inicia `startAutoCloseSessionsJob()` após o `app.listen` resolver com sucesso, com log informando o monitoramento.

## Capabilities

### Added Capabilities
- `lawyer`: encerramento automático (background job) de sessões cujo tempo se esgotou, sem depender de uma nova tentativa de liberação no mesmo computador.

## Impact

- Código novo: `src/http/jobs/auto-close-sessions.ts`.
- Alterado: `src/http/server.ts` (inicia o job após o listen).
- Banco: nenhuma migração; usa `computerSessions`/`computers`/`lawyers` já existentes.
- Documentação: `docs/ROADMAP.md` e `docs/DOC.md` marcam o item do cron job como `[x]`.
