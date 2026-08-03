# Design

## 1. Por que trocar um loop que funcionava

O `setTimeout` recursivo não estava errado — para um intervalo puro, ele é até mais previsível que cron. O que pesou foi ter **dois agendadores** para dois jobs num projeto pequeno: quem for criar o terceiro job precisa escolher entre dois padrões, e quem for depurar precisa saber que só um deles aparece nas ferramentas do `node-cron`.

Com `cron.schedule`, o job passa a ser inspecionável em runtime pela mesma API do job semanal: `cron.getTasks()`, `getNextRuns(n)`, `getStatus()`, `isBusy()`, `lastRun()` e eventos (`execution:started`, `execution:overlap`, `execution:failed`). Isso é o que torna possível verificar o agendamento sem executar o job — foi exatamente assim que esta entrega foi validada contra o banco de produção sem disparar nenhum tick real.

## 2. `noOverlap` é o equivalente do "só reagenda depois de terminar"

O comentário original do loop (`← só agenda o próximo DEPOIS de terminar`) descrevia a propriedade que realmente importa: nunca dois ticks simultâneos varrendo as mesmas sessões. `noOverlap: true` mantém isso, com uma diferença de semântica que vale registrar:

- **`setTimeout` encadeado**: um tick de 90s empurra o próximo para 90s + 60s. A cadência se degrada, mas nenhum tick é perdido.
- **`noOverlap`**: um tick de 90s faz o disparo do minuto seguinte ser **descartado** (log `execution:overlap`); o próximo válido é o minuto seguinte a esse. A cadência se mantém ancorada no relógio, mas o tick coincidente é pulado.

Para este job, descartar é o comportamento correto: os ticks não acumulam trabalho pendente. Cada varredura lê o estado atual de todas as sessões ativas — pular uma varredura só adia o encerramento em um minuto, nunca deixa uma sessão sem processar.

## 3. Expressão de 5 campos, não 6

`delete-weekly-prints` usa 6 campos (`59 59 23 * * 5`) porque precisa de precisão de segundo. Aqui, `* * * * *` (5 campos) basta e deixa explícito que o disparo é na virada do minuto. Usar `0 * * * * *` produziria o mesmo agendamento com um campo a mais para interpretar errado.

## 4. `timezone` num job que roda a cada minuto

Um job de intervalo fixo não depende de fuso — "a cada minuto" é a cada minuto em qualquer lugar. O `timezone: env.TIMEZONE` é passado mesmo assim por consistência com o outro job e para que os horários calculados por `getNextRun()` saiam no horário de parede da seccional, que é o que alguém depurando espera ler. Como a expressão não fixa hora nem dia, a mudança de horário de verão não tem efeito sobre ela.

Vale notar que a lógica *dentro* do job já dependia do fuso: `checkExpiredSessions` usa `dayjs().tz()`, que herda `env.TIMEZONE` via `src/lib/dayjs.ts`. Isso não mudou.

## 5. Renomear o arquivo em vez de deixar a divergência

O sufixo `.cron.ts` sinaliza, na própria árvore de arquivos, que aquele módulo registra uma tarefa agendada no boot — informação útil porque jobs não aparecem em nenhuma rota. O rename foi feito com `git mv` para preservar o histórico, e a única referência no código (`src/http/server.ts`) foi ajustada. As changes já existentes em `openspec/changes/` **não** foram reescritas: elas descrevem o estado do projeto no momento em que foram propostas, incluindo o `design.md` de `weekly-print-cleanup`, que justifica a adoção do `node-cron` comparando-o com o loop que agora deixou de existir.
