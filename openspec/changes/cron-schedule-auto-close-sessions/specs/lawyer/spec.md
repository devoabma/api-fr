## MODIFIED Requirements

### Requirement: Encerramento automático de sessões expiradas

O sistema SHALL executar um job em background, agendado por `node-cron` com a expressão `* * * * *` (um disparo a cada minuto, na virada do minuto), que verifica todas as sessões de uso ativas (`endedAt: null`) e encerra automaticamente as que ultrapassaram o limite de tempo, sem depender de uma nova tentativa de liberação no mesmo computador.

A tarefa MUST ser registrada com `name: 'auto-close-sessions'` e `timezone: env.TIMEZONE`, e MUST usar `noOverlap: true`: se uma execução ainda estiver em andamento no disparo seguinte, esse disparo MUST ser descartado em vez de executado em paralelo. Uma execução descartada MUST NOT deixar trabalho pendente — cada execução lê o estado atual de todas as sessões ativas, de modo que o efeito é adiar o encerramento até a execução seguinte.

O limite de tempo de cada sessão MUST ser o `remainingTime` do advogado(a) quando definido, ou o `standardTime` da sala do computador como fallback. Uma sessão MUST ser encerrada quando o tempo decorrido desde `startedAt` atingir esse limite.

O encerramento MUST usar um update condicional que só afeta a sessão se ela ainda estiver ativa (`endedAt: null`), evitando conflito com um encerramento manual (`close-computer`) ou reativo (`release-computer`) ocorrido entre a leitura e a escrita do job. Se a sessão já tiver sido encerrada por outro caminho, o job MUST NOT sobrescrevê-la.

Ao encerrar, o job MUST liberar o computador (`inUse: false`, `currentLawyerId: null`) somente se ele ainda estiver vinculado ao mesmo advogado(a) — evitando derrubar uma sessão nova caso o computador já tenha sido reatribuído. O job MUST zerar `lawyers.remainingTime` e atualizar `lastAccess` para o instante do encerramento, mesma semântica do encerramento forçado por tempo em `release-computer.ts`.

Um erro ao processar uma sessão individual MUST NOT interromper o processamento das demais sessões da execução. Erros transitórios de conexão com o banco (timeout, `ECONNRESET`, `P1001`, `P1017`) MUST ser registrados como aviso (warning), não como erro, e o job MUST continuar tentando na execução seguinte.

#### Scenario: Sessão esquecida é encerrada automaticamente

- **WHEN** uma sessão ativa ultrapassa o limite de tempo (`remainingTime` do advogado(a) ou `standardTime` da sala) sem que ninguém tente liberar o computador novamente
- **THEN** o job encerra a sessão, libera o computador e zera o `remainingTime` do advogado(a) na execução seguinte

#### Scenario: Corrida com encerramento manual

- **WHEN** a sessão é encerrada manualmente (`close-computer`) ou reaberta (`release-computer`) entre a leitura e a escrita de uma execução do job
- **THEN** o update condicional do job não afeta nenhuma linha e a sessão permanece como foi encerrada/reaberta pelo outro fluxo

#### Scenario: Computador já reatribuído

- **WHEN** o computador da sessão expirada já foi liberado e vinculado a outro advogado(a) antes do job processar o encerramento
- **THEN** o job encerra a sessão original mas NÃO altera o vínculo atual do computador

#### Scenario: Falha transitória de conexão

- **WHEN** o job falha ao consultar o banco por um erro transitório de conexão
- **THEN** o erro é registrado como aviso e o job tenta novamente na execução seguinte, sem derrubar o processo

#### Scenario: Execução se arrasta além do disparo seguinte

- **WHEN** uma execução do job ainda está em andamento no momento do disparo do minuto seguinte
- **THEN** esse disparo é descartado (`noOverlap`), nenhuma varredura concorrente é iniciada e a próxima varredura ocorre no minuto seguinte ao término

#### Scenario: Primeira varredura após o boot

- **WHEN** a API sobe e registra o job
- **THEN** a primeira varredura ocorre na virada do minuto seguinte, e não no instante do boot
