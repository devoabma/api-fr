## 1. Agendamento por `node-cron`

- [x] 1.1 Trocar o `setTimeout` recursivo de `startAutoCloseSessionsJob()` por `cron.schedule`
- [x] 1.2 Definir a expressão `* * * * *` (5 campos) numa constante `CRON_EXPRESSION` com comentário do formato
- [x] 1.3 Passar `name: 'auto-close-sessions'`, `timezone: env.TIMEZONE` e `noOverlap: true`, como em `delete-weekly-prints.cron.ts`
- [x] 1.4 Ajustar a mensagem de falha transitória de banco, que citava a constante `INTERVAL_MS` removida
- [x] 1.5 Preservar `checkExpiredSessions` e `closeSession` sem alteração de lógica

## 2. Consistência de nomenclatura

- [x] 2.1 Renomear `src/http/jobs/auto-close-sessions.ts` para `auto-close-sessions.cron.ts` via `git mv`
- [x] 2.2 Ajustar o import em `src/http/server.ts`

## 3. Verificação

- [x] 3.1 `npx tsc --noEmit` sem erros
- [x] 3.2 `npx biome check src/` sem issues
- [x] 3.3 Conferir o registro das duas tarefas em `cron.getTasks()` (pattern, status e próximos disparos no fuso configurado)
- [x] 3.4 Confirmar intervalo de 60s entre disparos consecutivos via `getNextRuns(2)`
- [x] 3.5 Observar disparos reais da expressão `* * * * *` e o descarte por `noOverlap` num tick propositalmente lento (evento `execution:overlap`)
- [x] 3.6 Confirmar que a API sobe com o novo caminho do import e responde `GET /health` com `200`
- [x] 3.7 `npx tsup` emitindo `build/http/jobs/auto-close-sessions.cron.js` e o import correto em `build/http/server.js`

## 4. Documentação

- [x] 4.1 Atualizar `docs/ROADMAP.md` (seção 4) com o novo caminho e o agendamento por `node-cron`
- [x] 4.2 Atualizar `docs/DOC.md` (seção Advogados) com a mesma descrição
