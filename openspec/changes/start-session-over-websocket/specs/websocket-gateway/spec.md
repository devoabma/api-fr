## ADDED Requirements

### Requirement: Aviso de abertura de sessão para a estação

Sempre que uma sessão de computador for aberta com sucesso, a API SHALL enviar a mensagem `session_started` pelo canal `/ws/computers` para a estação cujo `macCode` corresponde ao computador daquela sessão, independentemente de quem tenha chamado a rota de liberação.

A mensagem MUST conter `macCode` (normalizado), `sessionId`, `lawyerName`, `startedAt` e `expiresAt` (ISO 8601 em UTC) e `remainingTime` (minutos, inteiro não negativo).

O envio MUST acontecer **depois** de a sessão estar persistida e MUST NOT participar da transação.

Ao receber a mensagem, o Desktop MUST abrir a sessão a partir do conteúdo dela e MUST NOT chamar `POST /lawyers/release-computer` em resposta.

#### Scenario: Liberação feita pelo painel

- **WHEN** um funcionário libera um computador pelo painel informando o `macCode` da máquina
- **THEN** a sessão é gravada e a estação recebe `session_started`
- **AND** o Desktop destrava a máquina e abre a tela de sessão sem que ninguém tenha digitado nada nela

#### Scenario: Liberação feita no próprio quiosque

- **WHEN** o advogado(a) digita os dados na máquina e o Desktop chama a rota de liberação
- **THEN** a estação recebe `session_started` para a sessão que ela mesma acabou de abrir
- **AND** a mensagem pode chegar antes da resposta HTTP

#### Scenario: Liberação com a estação offline

- **WHEN** uma sessão é aberta e nenhuma conexão está registrada para aquele `macCode`
- **THEN** a liberação é concluída normalmente
- **AND** a não entrega é registrada em log como situação esperada, não como erro

### Requirement: Abertura idempotente por sessão

A mensagem `session_started` SHALL repetir no corpo o `macCode` do destinatário e o `sessionId` da sessão aberta.

O Desktop MUST comparar os dois com o próprio estado local, MUST ignorar a mensagem quando o `macCode` não for o da própria máquina e MUST ignorar a mensagem quando o `sessionId` for o da sessão já exibida.

Processar a mesma sessão duas vezes MUST NOT reiniciar a contagem de tempo nem abrir uma segunda tela.

#### Scenario: Eco da liberação pedida pela própria estação

- **WHEN** a estação recebe `session_started` com o `sessionId` da sessão que já está na tela
- **THEN** a mensagem é ignorada em silêncio
- **AND** a contagem em andamento permanece intacta

#### Scenario: Destinatário divergente

- **WHEN** a estação recebe `session_started` cujo `macCode` não é o da própria máquina
- **THEN** a mensagem é ignorada

### Requirement: Contagem de tempo ancorada no relógio do servidor

A mensagem `session_started` SHALL informar em `expiresAt` o instante absoluto, em UTC, em que o servidor encerrará a sessão, e esse instante MUST ser o mesmo devolvido no corpo da resposta HTTP da liberação.

O Desktop MUST desenhar a contagem regressiva a partir de `expiresAt` e MUST NOT derivá-la somando `remainingTime` ao relógio local.

#### Scenario: Estação com o relógio adiantado ou atrasado

- **WHEN** o relógio da máquina diverge do relógio do servidor
- **THEN** a contagem na tela continua terminando no mesmo instante em que o servidor encerra a sessão

### Requirement: Resultado da entrega informado a quem liberou

A resposta `200` de `POST /lawyers/release-computer` SHALL conter o campo booleano `notified`, indicando se o aviso desta operação foi entregue à estação pelo canal.

`notified` MUST refletir apenas a entrega do frame, e MUST NOT ser interpretado como confirmação de que a tela da estação mudou.

Uma falha de entrega MUST NOT alterar o restante da resposta nem impedir a gravação da sessão.

#### Scenario: Painel libera máquina com Desktop offline

- **WHEN** a liberação é gravada e a estação não está conectada
- **THEN** a resposta é `200` com `notified: false`
- **AND** o painel informa ao funcionário que a máquina não destravou sozinha

## MODIFIED Requirements

### Requirement: Motivo do encerramento

A mensagem `session_closed` SHALL informar em `reason` a origem do encerramento, com dois valores possíveis: `manual` (rota `POST /lawyers/close-computer/:sessionId`) e `expired` (cota do dia esgotada).

O `reason` MUST ser descritivo: o Desktop MUST executar a mesma ação de saída em qualquer motivo, variando apenas o texto exibido, de modo que um motivo novo não exija atualizar as máquinas das salas.

#### Scenario: Encerramento pela rota

- **WHEN** o encerramento vem de `POST /lawyers/close-computer/:sessionId`
- **THEN** `reason` é `manual`
- **AND** `remainingTime` é igual ao valor devolvido no corpo da resposta HTTP

#### Scenario: Encerramento pelo cron

- **WHEN** o encerramento vem do job `auto-close-sessions`
- **THEN** `reason` é `expired`
- **AND** `remainingTime` é `0`, coerente com a cota zerada no mesmo encerramento

#### Scenario: Liberação pedida sobre sessão que já estourou o tempo

- **WHEN** chega uma liberação para um advogado(a) cuja sessão em curso já passou do saldo do dia
- **THEN** a sessão é encerrada e a estação recebe `session_closed` com `reason: expired` e `remainingTime: 0`
- **AND** a resposta `200` informa `remainingTime: 0`, que é como o cliente distingue encerramento de liberação concedida

### Requirement: Encerramento não notificado duas vezes

Quando um caminho de encerramento não conseguir marcar a sessão como encerrada por ela já ter sido encerrada por outro caminho, a API MUST NOT enviar `session_closed` para aquela sessão.

Isso vale tanto para o job `auto-close-sessions` quanto para o ramo de sessão estourada da rota de liberação, que MUST condicionar o aviso ao número de registros efetivamente atualizados.

#### Scenario: Corrida entre o cron e o botão de encerrar

- **WHEN** a rota `close-computer` encerra a sessão no mesmo minuto em que o cron a avalia
- **THEN** apenas um `session_closed` é enviado, pelo caminho que efetivamente gravou o encerramento

#### Scenario: Corrida entre o cron e uma liberação sobre sessão vencida

- **WHEN** o cron encerra a sessão vencida e, em seguida, chega uma liberação para o mesmo advogado(a)
- **THEN** a liberação não emite um segundo `session_closed` para aquela sessão
