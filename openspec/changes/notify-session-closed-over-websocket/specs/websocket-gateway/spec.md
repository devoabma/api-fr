## ADDED Requirements

### Requirement: Aviso de encerramento de sessão para a estação

Sempre que uma sessão de computador for encerrada com sucesso, a API SHALL enviar a mensagem `session_closed` pelo canal `/ws/computers` para a estação cujo `macCode` corresponde ao computador daquela sessão.

A mensagem MUST conter `macCode` (normalizado), `sessionId`, `reason`, `closedAt` (ISO 8601 em UTC) e `remainingTime` (minutos, inteiro não negativo).

O envio MUST acontecer **depois** de o encerramento estar persistido e MUST NOT participar da transação.

A API MUST NOT tentar reenviar a mensagem: entrega não é garantida enquanto não houver snapshot na reconexão.

#### Scenario: Sessão encerrada com a estação conectada

- **WHEN** uma sessão é encerrada e o Desktop daquele computador está registrado no canal
- **THEN** a estação recebe `session_closed` com o `sessionId` da sessão encerrada
- **AND** o `closedAt` é o mesmo instante gravado em `endedAt`

#### Scenario: Sessão encerrada com a estação offline

- **WHEN** uma sessão é encerrada e nenhuma conexão está registrada para aquele `macCode`
- **THEN** o encerramento é concluído normalmente
- **AND** a não entrega é registrada em log como situação esperada, não como erro

### Requirement: Motivo do encerramento

A mensagem `session_closed` SHALL informar em `reason` a origem do encerramento, com dois valores possíveis: `manual` (rota `POST /lawyers/close-computer/:sessionId`) e `expired` (job `auto-close-sessions`).

O `reason` MUST ser descritivo: o Desktop MUST executar a mesma ação de saída em qualquer motivo, variando apenas o texto exibido, de modo que um motivo novo não exija atualizar as máquinas das salas.

#### Scenario: Encerramento pela rota

- **WHEN** o encerramento vem de `POST /lawyers/close-computer/:sessionId`
- **THEN** `reason` é `manual`
- **AND** `remainingTime` é igual ao valor devolvido no corpo da resposta HTTP

#### Scenario: Encerramento pelo cron

- **WHEN** o encerramento vem do job `auto-close-sessions`
- **THEN** `reason` é `expired`
- **AND** `remainingTime` é `0`, coerente com a cota zerada no mesmo encerramento

### Requirement: Destinatário e sessão conferíveis pelo cliente

A mensagem `session_closed` SHALL repetir no corpo o `macCode` do destinatário e o `sessionId` da sessão encerrada, ainda que ambos sejam redundantes com o roteamento.

O Desktop MUST comparar os dois com o próprio estado local e MUST ignorar a mensagem quando qualquer um não corresponder.

#### Scenario: Evento atrasado após nova liberação

- **WHEN** a estação recebe um `session_closed` cujo `sessionId` não é o da sessão aberta naquele momento
- **THEN** a mensagem é ignorada
- **AND** a sessão em andamento continua intacta

#### Scenario: Destinatário divergente

- **WHEN** a estação recebe um `session_closed` cujo `macCode` não é o da própria máquina
- **THEN** a mensagem é ignorada

### Requirement: Encerramento não notificado duas vezes

Quando o job `auto-close-sessions` não conseguir marcar a sessão como encerrada por ela já ter sido encerrada por outro caminho, a API MUST NOT enviar `session_closed` para aquela sessão.

#### Scenario: Corrida entre o cron e o botão de encerrar

- **WHEN** a rota `close-computer` encerra a sessão no mesmo minuto em que o cron a avalia
- **THEN** apenas um `session_closed` é enviado, pelo caminho que efetivamente gravou o encerramento

### Requirement: Falha de entrega não afeta a operação

A camada de notificação SHALL ser o ponto único por onde rotas e jobs falam com as estações, e MUST NOT lançar exceção em nenhuma circunstância.

Uma falha de transporte MUST NOT alterar a resposta HTTP de quem pediu o encerramento nem interromper o laço do job.

#### Scenario: Socket em estado inválido no momento do envio

- **WHEN** o envio falha por qualquer motivo de transporte
- **THEN** a falha é registrada em log
- **AND** a rota responde `200` normalmente
- **AND** o job segue para a próxima sessão expirada
