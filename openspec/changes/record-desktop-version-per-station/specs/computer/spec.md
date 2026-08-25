## MODIFIED Requirements

### Requirement: Listagem de computadores restrita a ADMIN

A API SHALL expor `GET /computers/get-all` para listar computadores. A rota MUST registrar o plugin `auth` e MUST exigir, via `request.checkIfEmployeeIsAdmin()`, que o funcionário autenticado tenha papel `ADMIN`.

A rota MUST aceitar filtros opcionais na query string: `roomId` (cuid) filtra por sala via igualdade, e `description` (string) faz busca parcial case-insensitive (`contains` + `mode: 'insensitive'`). Quando um filtro não é informado, ele MUST ser ignorado; sem nenhum filtro, a API MUST retornar todos os computadores.

Os computadores MUST ser ordenados por `createdAt` em ordem decrescente, para que a lista seja estável entre chamadas (sem `orderBy` o banco não garante ordem alguma). Em caso de sucesso, a API MUST responder `200` com `{ computers: [...] }`, onde cada computador traz `id`, `macCode`, `number`, `description`, `inUse`, `maintenance`, `createdAt` (a data de cadastro da máquina, para que o cliente possa exibi-la e reordenar localmente), `appVersion`, `appVersionReportedAt` e a `room` vinculada (`id`, `name`).

#### Scenario: ADMIN lista todos os computadores

- **WHEN** um funcionário ADMIN autenticado chama `GET /computers/get-all` sem filtros
- **THEN** a API responde `200` com `{ computers }` contendo todos os computadores e suas salas
- **AND** a lista vem ordenada por `createdAt` desc

#### Scenario: Data de cadastro do computador no response

- **WHEN** um funcionário ADMIN autenticado chama `GET /computers/get-all`
- **THEN** cada computador devolvido inclui `createdAt` com a data/hora do cadastro da máquina
- **AND** a sequência de `createdAt` acompanha a ordenação decrescente da lista

#### Scenario: Filtro por descrição

- **WHEN** a chamada inclui `?description=` com um termo
- **THEN** a API retorna apenas os computadores cuja `description` contém o termo, ignorando maiúsculas/minúsculas

#### Scenario: Filtro por sala

- **WHEN** a chamada inclui `?roomId=` com um cuid de sala
- **THEN** a API retorna apenas os computadores daquela sala

#### Scenario: Funcionário sem permissão

- **WHEN** a chamada é feita por um funcionário não-ADMIN
- **THEN** a API responde `401`

#### Scenario: Requisição sem autorização

- **WHEN** a chamada chega sem JWT ou com token inválido/expirado
- **THEN** a API responde `401`

## ADDED Requirements

### Requirement: Versão do Desktop instalada na estação

O computador SHALL guardar a última versão do aplicativo Desktop que a estação informou (`appVersion`) e o instante em que ela foi informada (`appVersionReportedAt`).

A versão SHALL ser tratada como **texto** (`"1.0.7"` — três números separados por ponto, sem prefixo; o `V` que o aplicativo desenha no canto da tela é decoração e nunca entra no dado). A API MUST NOT ordenar nem comparar o campo como número ou como texto simples: `'1.0.10'` precede `'1.0.7'` em ordem alfabética, de modo que qualquer comparação MUST ser feita segmento a segmento, no cliente.

`null` em qualquer um dos dois campos SHALL significar "esta máquina nunca informou" — porque não se registrou desde que a API passou a guardar, ou porque o envio está desligado na configuração local dela. `null` MUST NOT ser lido como falha, pendência de cadastro ou máquina com problema.

`appVersionReportedAt` SHALL registrar quando a estação **informou**, e MUST NOT ser usado como prova de presença ou de última atividade: a versão só é enviada no registro do canal, então máquina que permanece conectada mantém carimbo antigo, e máquina desligada mantém o que informou da última vez que esteve no ar — que é exatamente o dado que o suporte precisa antes de ligar para a unidade.

As duas listagens que descrevem o inventário — `GET /computers/get-all` (ADMIN) e `GET /rooms/get-all` (por papel) — MUST devolver os dois campos em cada computador, para que o painel responda em que versão está cada sala e quantas máquinas ainda estão em uma versão que se pretende tirar de campo.

#### Scenario: Máquina que informou a versão

- **WHEN** uma estação registrou-se informando `1.0.7` e o inventário é consultado
- **THEN** o computador é devolvido com `appVersion: "1.0.7"` e `appVersionReportedAt` preenchido

#### Scenario: Máquina que nunca informou

- **WHEN** um computador cadastrado nunca teve registro com versão
- **THEN** ele é devolvido com `appVersion: null` e `appVersionReportedAt: null`
- **AND** isso não impede nenhuma operação sobre a máquina

#### Scenario: Máquina desligada

- **WHEN** uma estação está fora do ar e o inventário da sala é consultado
- **THEN** o computador continua devolvendo a versão que informou da última vez que se registrou
- **AND** o carimbo continua sendo o daquele registro

#### Scenario: Versão na listagem por papel

- **WHEN** um funcionário MEMBER chama `GET /rooms/get-all`
- **THEN** cada computador das salas dele traz `appVersion` e `appVersionReportedAt`
- **AND** o escopo por papel da rota não muda por causa dos campos novos
