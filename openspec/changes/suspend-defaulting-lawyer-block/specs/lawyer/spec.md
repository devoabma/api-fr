## MODIFIED Requirements

### Requirement: Liberação de computador pelo advogado(a)

A API SHALL expor `POST /lawyers/release-computer` para o advogado(a) abrir uma sessão de uso. A rota é pública (sem JWT de funcionário) e o corpo MUST conter `cpf`, `oab`, `birth` e `macCode`.

O `macCode` MUST ser normalizado via `formattedCodeMac`; resultado com menos de 17 caracteres MUST ser rejeitado com `400`. A API MUST consultar a API do Protheus por CPF; falha de rede ou payload fora do formato esperado MUST responder `404`.

O advogado(a) consultado MUST ter `situacao` dentre as situações liberadas, caso contrário `400`. Essa validação é incondicional: ausência de habilitação não é questão financeira e MUST NOT ser suspensa por configuração.

O advogado(a) consultado MUST estar adimplente, caso contrário `400` — **salvo** quando a instância estiver configurada para liberação geral (`ALLOW_DEFAULTING_LAWYERS`), caso em que a exigência de adimplência MUST ser ignorada e a liberação MUST prosseguir. A suspensão MUST alcançar apenas a pendência financeira; todas as demais validações da rota MUST permanecer em vigor. Quando o advogado(a) estiver simultaneamente fora das situações liberadas e inadimplente, a resposta MUST informar a situação do registro, ainda que a liberação geral esteja vigente.

CPF, OAB e data de nascimento informados MUST conferir com os dados retornados pela API, caso contrário `400`.

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

#### Scenario: Advogado(a) inativo

- **WHEN** a `situacao` consultada não está entre as situações liberadas
- **THEN** a API responde `400` e nenhuma sessão é criada, independente da configuração de liberação geral

#### Scenario: Advogado(a) inadimplente com o bloqueio vigente

- **WHEN** o advogado(a) não está adimplente e a instância NÃO está configurada para liberação geral
- **THEN** a API responde `400` orientando a regularização financeira e nenhuma sessão é criada

#### Scenario: Advogado(a) inadimplente sob liberação geral

- **WHEN** o advogado(a) não está adimplente, está em situação liberada e a instância está configurada para liberação geral
- **THEN** a API prossegue com as demais validações e abre a sessão normalmente

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
