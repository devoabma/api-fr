## ADDED Requirements

### Requirement: Liberação de computador pelo advogado(a)

A API SHALL expor `POST /lawyers/release-computer` para o advogado(a) abrir uma sessão de uso. A rota é pública (sem JWT de funcionário) e o corpo MUST conter `cpf`, `oab`, `birth` e `macCode`.

O `macCode` MUST ser normalizado via `formattedCodeMac`; resultado com menos de 17 caracteres MUST ser rejeitado com `400`. A API MUST consultar a API do Protheus por CPF; falha de rede ou payload fora do formato esperado MUST responder `404`. O advogado(a) consultado MUST ter `situacao` dentre as situações liberadas e MUST estar adimplente, caso contrário `400`. CPF, OAB e data de nascimento informados MUST conferir com os dados retornados pela API, caso contrário `400`.

O computador referenciado pelo `macCode` MUST existir (`404` se não), MUST pertencer a uma sala ativa e MUST NOT estar em manutenção (`400` nos dois casos). A API MUST criar o registro em `lawyers` na primeira liberação, ou atualizá-lo quando nome/OAB/e-mail/data de nascimento/categoria retornados pela API divergirem do registro salvo.

A API MUST calcular a cota diária global do advogado(a) (mesma sala do dia, consumida em qualquer sala) antes de decidir:
- Se houver sessão ativa em OUTRO computador, MUST rejeitar com `400`.
- Se houver sessão ativa no MESMO computador e o tempo decorrido atingir o saldo diário restante, a API MUST encerrar essa sessão, liberar o computador e responder `200` informando o encerramento por tempo.
- Se houver sessão ativa no MESMO computador com saldo restante, MUST rejeitar com `400` informando os minutos restantes.
- Se a cota diária estiver zerada, MUST rejeitar com `400`.
- Se o computador já estiver em uso, MUST rejeitar com `400`.

Não havendo sessão ativa e havendo saldo diário e computador livre, a API MUST abrir uma nova sessão em transação (`computerSessions.create`, `computers.update` com `inUse: true`/`currentLawyerId`, `lawyers.update` com `remainingTime`/`lastAccess`) e responder `200` com `{ message, sessionId }`.

#### Scenario: Liberação com sucesso

- **WHEN** o advogado(a) informa CPF/OAB/nascimento válidos e um `macCode` de computador livre em sala ativa
- **THEN** a API cria/atualiza o registro em `lawyers`, abre uma nova sessão e responde `200` com `{ message, sessionId }`

#### Scenario: Mac Code inválido

- **WHEN** o `macCode` normalizado resulta em menos de 17 caracteres
- **THEN** a API responde `400` e nenhuma consulta é feita

#### Scenario: Advogado(a) não encontrado ou API indisponível

- **WHEN** a consulta à API do Protheus falha ou o payload não corresponde ao schema esperado
- **THEN** a API responde `404`

#### Scenario: Advogado(a) inativo ou inadimplente

- **WHEN** a `situacao` consultada não está entre as situações liberadas, ou o advogado(a) não está adimplente
- **THEN** a API responde `400` e nenhuma sessão é criada

#### Scenario: Dados informados não conferem

- **WHEN** o CPF, OAB ou data de nascimento informados divergem dos dados retornados pela API
- **THEN** a API responde `400`

#### Scenario: Computador inválido

- **WHEN** o computador não existe, pertence a uma sala inativa, ou está em manutenção
- **THEN** a API responde `404` (computador inexistente) ou `400` (sala inativa/manutenção)

#### Scenario: Sessão ativa em outro computador

- **WHEN** o advogado(a) já possui uma sessão ativa em um computador diferente do informado
- **THEN** a API responde `400` e nenhuma nova sessão é criada

#### Scenario: Sessão no mesmo computador expira pelo tempo

- **WHEN** o advogado(a) tem sessão ativa no mesmo computador e o tempo decorrido atinge o saldo diário restante
- **THEN** a API encerra a sessão, libera o computador e responde `200` informando o encerramento por tempo

#### Scenario: Sessão no mesmo computador ainda com saldo

- **WHEN** o advogado(a) tem sessão ativa no mesmo computador e ainda há saldo diário
- **THEN** a API responde `400` informando os minutos restantes

#### Scenario: Cota diária esgotada

- **WHEN** o saldo diário global do advogado(a) é zero ou negativo
- **THEN** a API responde `400` e nenhuma sessão é criada

#### Scenario: Computador já em uso

- **WHEN** o computador informado já está com `inUse: true` por outro advogado(a)
- **THEN** a API responde `400`

### Requirement: Encerramento de sessão

A API SHALL expor `POST /lawyers/close-computer/:sessionId` para encerrar uma sessão de uso ativa. O `sessionId` (cuid2) MUST identificar uma sessão existente e ainda não encerrada; caso contrário a API MUST rejeitar com `400`.

A API MUST recalcular a cota diária global do advogado(a), somando o tempo já decorrido na sessão em curso, e MUST encerrar a sessão (`endedAt`), liberar o computador (`inUse: false`, `currentLawyerId: null`) e atualizar `lawyers.remainingTime`/`lastAccess` em uma única transação. Em caso de sucesso, a API MUST responder `200` com `{ message, remainingTime }`.

#### Scenario: Encerramento com sucesso

- **WHEN** um `sessionId` válido e ainda ativo é informado
- **THEN** a sessão é encerrada, o computador é liberado, `lawyers.remainingTime` reflete o saldo restante do dia
- **AND** a API responde `200` com `{ message, remainingTime }`

#### Scenario: Sessão inexistente

- **WHEN** o `sessionId` não corresponde a nenhuma sessão
- **THEN** a API responde `400`

#### Scenario: Sessão já encerrada

- **WHEN** o `sessionId` corresponde a uma sessão que já possui `endedAt`
- **THEN** a API responde `400` e nenhuma alteração é feita

### Requirement: Cota diária global por advogado(a)

A cota diária de uso MUST ser definida pela sala onde o advogado(a) abriu a PRIMEIRA sessão finalizada do dia (`standardTime` dessa sala) e MUST ser consumida globalmente — usar computadores em salas diferentes no mesmo dia MUST descontar do mesmo saldo, não gerar cotas independentes. Quando ainda não houver sessão finalizada no dia, a cota MUST usar como referência o `standardTime` da sala do computador que está sendo liberado/encerrado no momento. O saldo restante MUST NUNCA ser negativo.

#### Scenario: Troca de sala no mesmo dia consome a mesma cota

- **WHEN** um advogado(a) finaliza uma sessão em uma sala e, no mesmo dia, abre outra sessão em sala diferente
- **THEN** o saldo diário restante considera o tempo já consumido na primeira sala, usando a cota da sala da primeira sessão do dia
