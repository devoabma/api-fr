## Why

O encerramento automático de sessões (`auto-close-expired-sessions`) foi entregue antes de `node-cron` entrar no projeto, então usa um `setTimeout` recursivo que se reagenda a cada 60s. Depois disso, `weekly-print-cleanup` trouxe `node-cron` e estabeleceu o padrão de agendamento da API: expressão cron, `timezone: env.TIMEZONE`, `noOverlap: true` e `name` da tarefa.

Com dois jobs no projeto agendados de formas diferentes, o custo é de manutenção e observabilidade: o loop manual não aparece em `cron.getTasks()`, não expõe próximo disparo (`getNextRun`), não emite eventos de execução e não pode ser parado/inspecionado — enquanto o job semanal oferece tudo isso. A convenção de nome de arquivo também divergia (`*.cron.ts` só no job semanal).

Nenhuma regra de negócio do encerramento muda nesta entrega: a mudança é do agendador em volta de `checkExpiredSessions`, não da lógica dentro dele.

## What Changes

- **`src/http/jobs/auto-close-sessions.ts` renomeado para `src/http/jobs/auto-close-sessions.cron.ts`**, alinhando com `delete-weekly-prints.cron.ts` (`git mv`, preservando o histórico do arquivo).
- **`startAutoCloseSessionsJob()` passa a usar `cron.schedule`** no lugar do `setTimeout` recursivo:
  - Expressão `* * * * *` (5 campos, sem segundos) — um disparo a cada minuto, ancorado na virada do minuto.
  - `timezone: env.TIMEZONE` e `name: 'auto-close-sessions'`, como no job semanal.
  - `noOverlap: true` preserva a garantia que o `setTimeout` encadeado dava: um tick que se arraste além de 1 minuto faz o disparo seguinte ser **descartado**, nunca executado em paralelo.
- **Ajuste de log**: o aviso de falha transitória de banco dizia "tentando de novo em ${INTERVAL_MS / 1000}s"; a constante deixou de existir e a mensagem passa a citar o próximo minuto.
- `checkExpiredSessions`, `closeSession` e o tratamento de erro transitório permanecem **inalterados**.

## Capabilities

### Modified Capabilities
- `lawyer`: o encerramento automático de sessões expiradas passa a ser agendado por `node-cron` (a cada minuto, no fuso configurado, sem sobreposição) em vez de um loop de `setTimeout` in-process.

## Impact

- Renomeado: `src/http/jobs/auto-close-sessions.ts` → `src/http/jobs/auto-close-sessions.cron.ts`.
- Alterado: o corpo de `startAutoCloseSessionsJob()` e o import em `src/http/server.ts`.
- Contrato HTTP: nenhum endpoint novo ou alterado.
- Banco: nenhuma migração; as queries do job são as mesmas.
- Dependências: nenhuma nova (`node-cron` já era dependência desde `weekly-print-cleanup`).
- Documentação: `docs/ROADMAP.md` (seção 4) e `docs/DOC.md` (seção Advogados) passam a descrever o agendamento por `node-cron`.

## Behavior Change

A primeira varredura deixa de ocorrer no instante do boot e passa a ocorrer na virada do minuto seguinte. O atraso máximo até uma sessão expirada ser encerrada continua sendo de ~1 minuto, então o efeito prático é nulo; fica registrado porque é a única diferença observável de comportamento.

## Known Limitation

Permanece a limitação já registrada em `weekly-print-cleanup`: o job roda in-process e, com mais de uma réplica da API, todas as instâncias disparariam no mesmo minuto. Aqui o dano seria contido pelos updates condicionais de `closeSession` (a segunda instância não afetaria nenhuma linha), mas o desperdício de consultas se manteria. `node-cron` oferece `distributed`/`runCoordinator` para esse cenário — não adotado agora porque o deploy no Coolify usa instância única.
